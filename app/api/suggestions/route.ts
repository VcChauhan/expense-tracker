import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Suggestion from '@/lib/models/Suggestion';
import Settings from '@/lib/models/Settings';
import Expense from '@/lib/models/Expense';
import OpenAI from "openai";

function scrubSms(text: string): string {
  if (!text) return text;
  return text
    // Redact masked account numbers (e.g., XX1234, XXXXX1234)
    .replace(/[Xx]{2,}\d+/g, '[ACCOUNT]')
    // Redact long sequences of digits (8+ digits: phone numbers, customer IDs, etc.)
    .replace(/\b\d{8,}\b/g, '[ID]')
    // Redact UPI routing strings (e.g. UPI/P2A/367680408468/)
    .replace(/UPI\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\/?/gi, 'UPI/[REDACTED]/');
}

export async function GET() {
  try {
    await connectMongo();
    const suggestions = await Suggestion.find({ status: 'pending' }).sort({ date: -1 });
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.AUTH_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
    }

    await connectMongo();

    let suggestedCategory = undefined;
    let suggestedLabel = undefined;

    // Use Groq if API key is present
    if (process.env.GROQ_API_KEY) {
      try {
        const settings = await Settings.findOne();
        const categories = settings?.categories || [];
        const recentExpenses = await Expense.find().sort({ createdAt: -1 }).limit(50);

        const categoriesString = categories.map((c: any) => `${c.name} (ID: ${c.id})`).join(', ');
        const habitsString = recentExpenses.map(e => `Amount: ${e.amount}, Note: ${e.note}, CategoryID: ${e.categoryId}`).join('\n');
        const safeSms = scrubSms(data.smsBody);

        const prompt = `
Analyze this incoming SMS transaction:
SMS Body: "${safeSms}"
Amount: ${data.amount}

Available Categories to choose from:
${categoriesString}

User's recent transaction habits:
${habitsString}

Task:
1. Determine if this transaction is an actual expense. If it is a credit card bill payment, a transfer to another of the user's own accounts, or an investment, it is NOT an expense (set "isExpense": false).
2. If it is an expense, select the most appropriate Category ID from the available list based on the SMS text and past habits.
3. Generate a short, crisp label/note (max 4 words) describing the transaction (e.g. "Swiggy Order", "Uber Ride", "Netflix Subscription").

Respond strictly with JSON matching this schema:
{
  "isExpense": boolean,
  "categoryId": string,
  "label": string
}
`;

        const client = new OpenAI({
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1",
        });

        const response = await client.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" }
        });

        const responseContent = response.choices[0]?.message?.content;
        
        if (responseContent) {
          const parsed = JSON.parse(responseContent);
          
          suggestedCategory = parsed.categoryId;
          suggestedLabel = parsed.isExpense === false 
            ? `⚠️ Ignore: ${parsed.label}` 
            : parsed.label;
        }
      } catch (aiError) {
        console.error('Groq AI failed, skipping auto-categorization:', aiError);
      }
    }

    const suggestion = await Suggestion.create({
      smsBody: data.smsBody,
      sender: data.sender,
      amount: data.amount,
      date: data.date,
      status: 'pending',
      suggestedCategory,
      suggestedLabel,
    });

    return NextResponse.json(suggestion, { status: 201 });
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 });
  }
}
