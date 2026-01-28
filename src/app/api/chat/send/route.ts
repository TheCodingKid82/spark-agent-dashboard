/**
 * POST /api/chat/send
 * 
 * Send a message to an agent or between agents.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sendMessage } from '@/lib/chat/router';
import { SendMessageRequest } from '@/lib/chat/types';

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();
    
    if (!body.from || !body.to || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: from, to, content' },
        { status: 400 }
      );
    }

    const result = await sendMessage(body);
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error('Chat send error:', error);
    return NextResponse.json(
      { error: 'Failed to send message', details: String(error) },
      { status: 500 }
    );
  }
}
