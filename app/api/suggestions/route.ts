import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Suggestion from '@/lib/models/Suggestion';
import Settings from '@/lib/models/Settings';
import Expense from '@/lib/models/Expense';
import { GoogleGenAI, Type } from '@google/genai';

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

    // Use Gemini if API key is present
    if (process.env.GEMINI_API_KEY) {
      try {
        const settings = await Settings.findOne();
        const categories = settings?.categories || [];
        const recentExpenses = await Expense.find().sort({ createdAt: -1 }).limit(50);

        const categoriesString = categories.map((c: any) => `${c.name} (ID: ${c.id})`).join(', ');
        const habitsString = recentExpenses.map(e => `Amount: ${e.amount}, Note: ${e.note}, CategoryID: ${e.categoryId}`).join('\n');

        const prompt = `
Analyze this incoming SMS transaction:
SMS Body: "${data.smsBody}"
Amount: ${data.amount}

Available Categories to choose from:
${categoriesString}

User's recent transaction habits:
${habitsString}

Task:
1. Determine if this transaction is an actual expense. If it is a credit card bill payment, a transfer to another of the user's own accounts, or an investment, it is NOT an expense (set "isExpense": false).
2. If it is an expense, select the most appropriate Category ID from the available list based on the SMS text and past habits.
3. Generate a short, crisp label/note (max 4 words) describing the transaction (e.g. "Swiggy Order", "Uber Ride", "Netflix Subscription").

Respond strictly with JSON matching this schema.
`;

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isExpense: { type: Type.BOOLEAN, description: "False if this is a credit card bill, self-transfer, or non-expense" },
                categoryId: { type: Type.STRING },
                label: { type: Type.STRING }
              },
              required: ["isExpense"]
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          
          // If Gemini determines it's not a real expense, abort suggestion creation silently
          if (parsed.isExpense === false) {
            return NextResponse.json({ message: 'Ignored non-expense transaction' }, { status: 200 });
          }

          suggestedCategory = parsed.categoryId;
          suggestedLabel = parsed.label;
        }
      } catch (aiError) {
        console.error('Gemini AI failed, skipping auto-categorization:', aiError);
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
