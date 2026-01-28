/**
 * GET /api/chat/conversations
 * 
 * Get all conversations (for sidebar/list view).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/chat/store';

export async function GET(request: NextRequest) {
  try {
    const conversations = await store.getConversations();
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Chat conversations error:', error);
    return NextResponse.json(
      { error: 'Failed to get conversations', details: String(error) },
      { status: 500 }
    );
  }
}
