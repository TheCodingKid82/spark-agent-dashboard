/**
 * Messages API (Task Comments)
 * 
 * GET /api/messages?taskId=xxx - Get messages for a task
 * POST /api/messages - Create a new message/comment
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql, type Message } from '@/lib/db';

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/messages - Get messages for a task
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const authorId = searchParams.get('authorId');
    
    if (taskId) {
      const messages = await sql<Message>`
        SELECT * FROM mc_messages 
        WHERE task_id = ${taskId} 
        ORDER BY created_at ASC
      `;
      return NextResponse.json({ success: true, messages });
    }
    
    if (authorId) {
      const messages = await sql<Message>`
        SELECT * FROM mc_messages 
        WHERE author_id = ${authorId} 
        ORDER BY created_at DESC
        LIMIT 100
      `;
      return NextResponse.json({ success: true, messages });
    }
    
    return NextResponse.json(
      { success: false, error: 'Missing taskId or authorId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Messages GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get messages', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/messages - Create a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.task_id || !body.content || !body.author_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: task_id, content, author_id' },
        { status: 400 }
      );
    }
    
    // Extract @mentions
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(body.content)) !== null) {
      mentions.push(match[1]);
    }
    
    const id = generateId();
    const message = await sql<Message>`
      INSERT INTO mc_messages (id, task_id, author_id, author_type, content, message_type, parent_id, mentions)
      VALUES (${id}, ${body.task_id}, ${body.author_id}, ${body.author_type || 'agent'}, ${body.content}, ${body.message_type || 'comment'}, ${body.parent_id || null}, ${mentions})
      RETURNING *
    `;
    
    // Log activity
    await sql`
      INSERT INTO mc_activities (id, actor_id, actor_type, action, target_type, target_id, metadata)
      VALUES (
        ${`act-${Date.now()}`}, 
        ${body.author_id}, 
        ${body.author_type || 'agent'}, 
        'commented', 
        'task', 
        ${body.task_id}, 
        ${JSON.stringify({ message_id: id, mentions })}
      )
    `;
    
    // Create notifications for @mentions
    for (const mention of mentions) {
      if (mention !== body.author_id) {
        await sql`
          INSERT INTO mc_notifications (id, recipient_id, sender_id, type, title, message, target_type, target_id)
          VALUES (
            ${`ntf-${Date.now()}-${mention}`}, 
            ${mention}, 
            ${body.author_id}, 
            'mention', 
            'You were mentioned', 
            ${body.content.slice(0, 100)}, 
            'task', 
            ${body.task_id}
          )
        `;
      }
    }
    
    // Auto-subscribe commenter
    await sql`
      INSERT INTO mc_subscriptions (id, subscriber_id, target_type, target_id, auto_subscribed)
      VALUES (${`sub-${Date.now()}`}, ${body.author_id}, 'task', ${body.task_id}, true)
      ON CONFLICT (subscriber_id, target_type, target_id) DO NOTHING
    `;
    
    // Notify other subscribers about the comment
    const subscribers = await sql<{ subscriber_id: string }>`
      SELECT subscriber_id FROM mc_subscriptions 
      WHERE target_type = 'task' AND target_id = ${body.task_id}
    `;
    
    for (const sub of subscribers) {
      if (sub.subscriber_id !== body.author_id && !mentions.includes(sub.subscriber_id)) {
        await sql`
          INSERT INTO mc_notifications (id, recipient_id, sender_id, type, title, message, target_type, target_id)
          VALUES (
            ${`ntf-${Date.now()}-${sub.subscriber_id}`}, 
            ${sub.subscriber_id}, 
            ${body.author_id}, 
            'comment', 
            'New comment on task', 
            ${body.content.slice(0, 100)}, 
            'task', 
            ${body.task_id}
          )
        `;
      }
    }
    
    return NextResponse.json({ success: true, message: message[0] });
  } catch (error) {
    console.error('Messages POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create message', details: String(error) },
      { status: 500 }
    );
  }
}
