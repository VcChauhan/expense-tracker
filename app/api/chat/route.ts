import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectMongo from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import Settings from '@/lib/models/Settings';
import RateLimit from '@/lib/models/RateLimit';
import ChatHistory from '@/lib/models/ChatHistory';
import OpenAI from "openai";

const ALLOWED_ACTIONS = ['query_expenses', 'top_expenses', 'affordability_check', 'general_advice', 'add_expense'];

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export async function POST(req: Request) {
  try {
    // 1. Explicit Auth Check
    const secret = process.env.AUTH_SECRET;
    const authHeader = req.headers.get('authorization');
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('iq-session')?.value;

    if ((!authHeader || authHeader !== `Bearer ${secret}`) && (!sessionCookie || sessionCookie !== secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = 'admin'; // Single-user context for now

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ 
        role: 'ai', 
        content: "To enable Chat, please add a GROQ_API_KEY to your environment variables.",
        metadata: {}
      });
    }

    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    await connectMongo();

    // 2. Rate Limiting (10 msgs per minute)
    const now = new Date();
    const minuteBucket = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    const rl = await RateLimit.findOneAndUpdate(
      { identifier: userId, minuteBucket },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (rl.count > 10) {
      return NextResponse.json({ 
        role: 'ai', 
        content: "You're chatting too fast! Please wait a minute before sending another message.",
        metadata: {}
      });
    }

    // Save user message to history
    await ChatHistory.create({ userId, role: 'user', content: message });

    // 3. System Prompt & Tool Calling
    const settings = await Settings.findOne();
    const categoriesList = settings?.categories?.map((c: any) => `${c.name} (ID: ${c.id})`).join(', ') || 'No categories';
    const systemPrompt = `
You are a highly intelligent personal finance assistant integrated into an Expense Tracker app.
You only have read-only access to the user's finances. You CANNOT execute budget changes or write actions.

When the user asks a question, you must respond strictly with a JSON object containing an "action" and "filters" or "params".
The "action" must be EXACTLY one of: [${ALLOWED_ACTIONS.join(', ')}].

Schemas:
1. query_expenses: For asking how much was spent on something.
{ "action": "query_expenses", "filters": { "keyword": "optional search term", "category": "optional category name", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }, "aggregation": "sum" | "list" }

2. top_expenses: For asking what the biggest expenses are.
{ "action": "top_expenses", "filters": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }, "limit": 5 }

You are a highly intelligent and helpful personal finance assistant.
Your goal is to help the user understand their expenses and manage their budget.

Rules:
- The user's exact categories are: ${categoriesList}.
- IMPORTANT: If the user asks about a general topic (like "food", "dining"), you MUST intuitively map it to the closest matching category ID (like "Groceries"). Do NOT just use the keyword as a category filter.
- ONLY use exact category names from the list for the "category" filter.
- If the user asks for "highest", "biggest", or "top" expenses, you MUST use the "top_expenses" action.
- If the user asks a question relative to time (e.g. "this year", "last month"), use today's date (${now.toISOString().split('T')[0]}) to calculate exact YYYY-MM-DD start/end dates.
- Do NOT include any text outside the JSON object.
- The user's message is: "${message}"

Action Schema:
{
  "action": "string",
  "filters": { ... },
  "params": { 
     "add_expense": {
        "type": "object",
        "description": "Call this to add a new expense to the database. Useful when the user says 'I spent X on Y' or pastes a bank SMS.",
        "properties": {
          "amount": { "type": "number", "description": "The amount spent." },
          "note": { "type": "string", "description": "A short note or vendor name (max 4 words)." },
          "categoryId": { "type": "string", "description": "The closest matching category ID from the user's categories list." },
          "date": { "type": "string", "description": "The date of the transaction in YYYY-MM-DD format. Defaults to today." }
        },
        "required": ["amount", "categoryId"]
      }
   }
}
`;

    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: systemPrompt }],
      response_format: { type: "json_object" }
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) throw new Error("Empty AI response");

    const parsed = JSON.parse(responseContent);
    const action = parsed.action;
    
    console.log(`Chat action [context]:`, action, parsed.filters || parsed.params);

    if (!ALLOWED_ACTIONS.includes(action)) {
      throw new Error(`Invalid action returned by AI: ${action}`);
    }

    // 4. Secure Backend Execution
    let finalContent = "";
    let finalMetadata = {};

    if (action === 'query_expenses') {
      const filters = parsed.filters || {};
      const query: any = {};
      
      if (filters.keyword) {
        const matchingCats = settings?.categories?.filter((c: any) => c.name.toLowerCase().includes(filters.keyword.toLowerCase())) || [];
        const catIds = matchingCats.map((c: any) => c.id);

        query.$or = [
          { notes: { $regex: escapeRegExp(filters.keyword), $options: 'i' } }
        ];
        if (catIds.length > 0) {
          query.$or.push({ categoryId: { $in: catIds } });
        }
      }
      if (filters.category) {
        const cat = settings?.categories?.find((c: any) => c.name.toLowerCase() === filters.category.toLowerCase());
        if (cat) query.categoryId = cat.id;
      }
      if (filters.startDate || filters.endDate) {
        query.date = {};
        if (filters.startDate) query.date.$gte = filters.startDate;
        if (filters.endDate) query.date.$lte = filters.endDate;
      }

      if (parsed.aggregation === 'sum') {
        const results = await Expense.find(query);
        const total = results.reduce((sum, e) => sum + e.amount, 0);
        finalContent = `You spent ₹${total} based on your query.`;
        if (results.length > 0) {
           finalMetadata = { type: 'transactions', data: results.slice(0, 100) }; // cap at 100 for safety
        }
      } else {
        const results = await Expense.find(query).limit(100).sort({ date: -1 });
        finalContent = `Here are the transactions matching your query${results.length === 100 ? ' (showing top 100)' : ''}:`;
        finalMetadata = { type: 'transactions', data: results };
      }
    } 
    else if (action === 'top_expenses') {
      const filters = parsed.filters || {};
      const query: any = {};
      if (filters.startDate || filters.endDate) {
        query.date = {};
        if (filters.startDate) query.date.$gte = filters.startDate;
        if (filters.endDate) query.date.$lte = filters.endDate;
      }
      const limit = Math.min(parsed.limit || 5, 100); // hard cap
      const results = await Expense.find(query).sort({ amount: -1 }).limit(limit);
      finalContent = `Here are your top ${results.length} highest expenses:`;
      finalMetadata = { type: 'transactions', data: results };
    }
    else if (action === 'affordability_check') {
      const { targetAmount, targetDate } = parsed.params;
      const salary = settings?.monthlySalary || 0;
      // Fetch current month expenses
      const monthStr = now.getMonth() + 1 < 10 ? `0${now.getMonth() + 1}` : `${now.getMonth() + 1}`;
      const year = now.getFullYear();
      const currentExpenses = await Expense.find({ date: { $regex: new RegExp(`^${year}-${monthStr}`) } });
      const spentSoFar = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
      const remainingMonthBudget = salary - spentSoFar;

      if (targetAmount > remainingMonthBudget) {
        finalContent = `You might want to hold off. You have ₹${remainingMonthBudget} remaining from this month's income, and the target is ₹${targetAmount}.`;
      } else {
        finalContent = `Yes, you can afford it! You have ₹${remainingMonthBudget} remaining this month, which covers the ₹${targetAmount} target.`;
      }
      finalMetadata = { type: 'affordability', data: { remaining: remainingMonthBudget, target: targetAmount } };
    }
    else if (action === 'general_advice') {
      finalContent = parsed.params?.response || "I'm here to help with your finances!";
    }
    else if (action === 'add_expense') {
      const { amount, note, categoryId, date } = parsed.params;
      
      const cat = settings?.categories?.find((c: any) => c.id === categoryId);
      const categoryName = cat ? cat.name : (settings?.categories?.[0]?.name || 'Unknown');
      const emoji = cat ? cat.emoji : '📝';

      finalContent = "I've drafted an expense for you. Please confirm the details below.";
      finalMetadata = { 
        type: 'draft_expense', 
        data: { 
          amount: parseFloat(amount) || 0, 
          note: note || 'Expense', 
          categoryId: cat ? cat.id : (settings?.categories?.[0]?.id || ''),
          categoryName,
          emoji,
          date: date || now.toISOString().split('T')[0] 
        } 
      };
    }

    // Save AI response
    await ChatHistory.create({ userId, role: 'ai', content: finalContent, metadata: finalMetadata });

    return NextResponse.json({ role: 'ai', content: finalContent, metadata: finalMetadata });

  } catch (error: any) {
    console.error('Error generating chat response:', error);
    return NextResponse.json({ 
      role: 'ai', 
      content: "Sorry, I couldn't process that — try rephrasing.",
      metadata: {} 
    });
  }
}
