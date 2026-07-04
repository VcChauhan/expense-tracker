import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import mongoose from 'mongoose';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const expense = await Expense.findByIdAndUpdate(id, body, { new: true });
    if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(expense);
  } catch (error) {
    console.error('PUT /api/expenses/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/expenses/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
