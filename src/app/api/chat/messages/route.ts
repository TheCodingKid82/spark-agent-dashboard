/**
 * GET /api/chat/messages
 * 
 * Get chat messages. Query params:
 * - participant1: Required - one participant
 * - participant2: Optional - other participant (for specific conversation)
 * - limit: Optional - max messages (default 100)
 * - all: Optional - if 'true', get all messages (Andrew's observer view)
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/chat/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all') === 'true';
    const participant1 = searchParams.get('participant1');
    const participant2 = searchParams.get('participant2');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (all) {
      // Andrew's observer view - see all messages
      const messages = await store.getAllMessages(limit);
      return NextResponse.json({ messages });
    }

    if (!participant1) {
      return NextResponse.json(
        { error: 'participant1 is required (or use all=true)' },
        { status: 400 }
      );
    }

    const messages = await store.getMessages(participant1, participant2 || undefined, limit);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Chat messages error:', error);
    return NextResponse.json(
      { error: 'Failed to get messages', details: String(error) },
      { status: 500 }
    );
  }
}
