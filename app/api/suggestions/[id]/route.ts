import { NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import Suggestion from '@/lib/models/Suggestion';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    await connectMongo();
    
    const updates: Record<string, any> = {};
    if (body.status && ['approved', 'rejected', 'pending'].includes(body.status)) updates.status = body.status;
    if (body.suggestedNote !== undefined) updates.suggestedNote = body.suggestedNote;
    if (body.suggestedLabel !== undefined) updates.suggestedLabel = body.suggestedLabel;
    if (body.suggestedCategory !== undefined) updates.suggestedCategory = body.suggestedCategory;
    if (body.suggestedTags !== undefined) updates.suggestedTags = body.suggestedTags;
    if (body.amount !== undefined) updates.amount = body.amount;

    const suggestion = await Suggestion.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }

    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('Error updating suggestion:', error);
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectMongo();
    const deleted = await Suggestion.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting suggestion:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
