import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30s timeout on Vercel

const EXTRACTION_PROMPT = `You are an expert financial assistant analyzing a screenshot of an investment holding or dashboard from Groww or Indian broker apps.
Extract the exact values:
1. holdingName: The full name of the mutual fund scheme, stock, or gold asset (e.g. "SBI ELSS Tax Saver Fund Direct Growth"). DO NOT split multi-line names into separate funds. If this is a single holding screen, there is only ONE holding.
2. totalInvested: The total amount invested in INR (number only). Look for the "Invested" label amount (e.g. 29999). NEVER use Folio numbers (e.g. 49251872) or NAV decimals.
3. currentValue: The current value in INR (number only). Look for the "Current" label amount (e.g. 30365). NEVER use Current NAV (e.g. 458.52) as current value.
4. totalGain: Returns / gain in INR (number only, can be positive or negative, e.g. 367).
5. gainPercent: Returns percentage as a number (e.g. 1.22).
6. units: Balanced units or shares (number, e.g. 66.224).
7. buyPrice: Current NAV or buy price (number, e.g. 458.52).
8. portfolioType: "mutual_funds" | "stocks" | "gold".
9. funds: Array of funds/stocks. If single holding screen, include exactly 1 item with the holding details. If a multi-holding dashboard, include all items.

Respond ONLY with valid parseable JSON:
{
  "holdingName": string,
  "totalInvested": number,
  "currentValue": number,
  "totalGain": number,
  "gainPercent": number,
  "units": number,
  "buyPrice": number,
  "portfolioType": "mutual_funds" | "stocks" | "gold",
  "funds": [
    {
      "name": string,
      "invested": number,
      "current": number,
      "gain": number,
      "gainPercent": number,
      "units": number,
      "buyPrice": number
    }
  ]
}
Return raw JSON only without commentary.`;

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
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
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
          // Try fallback to gemini-1.5-flash
          const gemini15Res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: EXTRACTION_PROMPT },
                      { inline_data: { mime_type: detectedMime, data: base64Clean } },
                    ],
                  },
                ],
                generationConfig: { temperature: 0.1, response_mime_type: 'application/json' },
              }),
            }
          );
          if (gemini15Res.ok) {
            const d15 = await gemini15Res.json();
            rawJsonText = d15.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini Vision API call failed, falling back if possible:', geminiErr);
      }
    }

    // 2. Fallback to Groq Vision if Gemini not used or failed
    if (!rawJsonText && groqKey) {
      try {
        const dataUri = `data:${detectedMime};base64,${base64Clean}`;
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
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
          }),
        });

        if (groqRes.ok) {
          const completion = await groqRes.json();
          rawJsonText = completion.choices?.[0]?.message?.content || '';
        }
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
