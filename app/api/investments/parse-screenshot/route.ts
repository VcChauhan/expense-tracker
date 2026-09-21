import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30s timeout on Vercel

const EXTRACTION_PROMPT = `You are an expert financial assistant analyzing a screenshot of an investment portfolio dashboard from Groww (Indian mutual funds and stocks app).
Extract the following information:
- totalInvested: The total amount invested by the user in INR (number only, strip ₹ and commas).
- currentValue: The current value of the portfolio in INR (number only, strip ₹ and commas).
- totalGain: Total returns / profit or loss amount in INR (can be positive or negative, number only). If not directly stated, compute currentValue - totalInvested.
- gainPercent: Returns percentage as a number (e.g. 14.5 or -2.3).
- funds: Array of any mutual funds or stocks visible in the list:
  [
    {
      "name": "Name of fund or stock",
      "invested": number,
      "current": number,
      "gain": number,
      "gainPercent": number
    }
  ]

Respond ONLY with a valid JSON object:
{
  "totalInvested": number,
  "currentValue": number,
  "totalGain": number,
  "gainPercent": number,
  "funds": [
    {
      "name": string,
      "invested": number,
      "current": number,
      "gain": number,
      "gainPercent": number
    }
  ]
}
Do not wrap in markdown or backticks if possible, or wrap in \`\`\`json. Return valid parseable JSON.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image, mimeType = 'image/png' } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    // Strip prefix if base64 data URL
    let base64Clean = image;
    let detectedMime = mimeType;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        base64Clean = match[2];
      } else {
        base64Clean = image.split(',')[1] || image;
      }
    }

    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;

    const groqKey = process.env.GROQ_API_KEY;

    let rawJsonText = '';

    // 1. Try Gemini Vision API first if key provided
    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: EXTRACTION_PROMPT },
                    {
                      inline_data: {
                        mime_type: detectedMime,
                        data: base64Clean,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                response_mime_type: 'application/json',
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
          const errText = await geminiRes.text();
          console.warn('Gemini Vision API error response:', errText);
        }
      } catch (geminiErr) {
        console.warn('Gemini Vision API call failed, falling back if possible:', geminiErr);
      }
    }

    // 2. Fallback to Groq Vision if Gemini not used or failed
    if (!rawJsonText && groqKey) {
      try {
        const groq = new OpenAI({
          apiKey: groqKey,
          baseURL: 'https://api.groq.com/openai/v1',
        });

        const dataUri = `data:${detectedMime};base64,${base64Clean}`;
        const completion = await groq.chat.completions.create({
          model: 'llama-3.2-11b-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: EXTRACTION_PROMPT },
                {
                  type: 'image_url',
                  image_url: { url: dataUri },
                },
              ],
            },
          ],
          temperature: 0.1,
        });

        rawJsonText = completion.choices[0]?.message?.content || '';
      } catch (groqErr) {
        console.warn('Groq Vision API call failed:', groqErr);
      }
    }

    if (!rawJsonText) {
      if (!geminiKey && !groqKey) {
        return NextResponse.json(
          {
            error: 'MISSING_API_KEY',
            message:
              'No Vision API key configured. Please add GEMINI_API_KEY in Vercel environment variables or enter values manually.',
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: 'PARSE_FAILED',
          message:
            'Could not extract data from screenshot. You can enter the portfolio numbers manually.',
        },
        { status: 422 }
      );
    }

    // Clean markdown wrappers if returned
    let cleaned = rawJsonText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);

    const totalInvested = Number(parsed.totalInvested) || 0;
    const currentValue = Number(parsed.currentValue) || 0;
    const totalGain =
      parsed.totalGain !== undefined
        ? Number(parsed.totalGain)
        : currentValue - totalInvested;
    const gainPercent =
      parsed.gainPercent !== undefined
        ? Number(parsed.gainPercent)
        : totalInvested > 0
        ? Number(((totalGain / totalInvested) * 100).toFixed(2))
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalInvested,
        currentValue,
        totalGain,
        gainPercent,
        funds: Array.isArray(parsed.funds) ? parsed.funds : [],
      },
    });
  } catch (error: any) {
    console.error('parse-screenshot error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse screenshot' },
      { status: 500 }
    );
  }
}
