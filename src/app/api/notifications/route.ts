/**
 * Notifications API
 * 
 * GET /api/notifications - Get notifications for current user
 * POST /api/notifications - Create a notification
 * PATCH /api/notifications - Mark notifications as read
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql, type Notification } from '@/lib/db';

function generateId(): string {
  return `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/notifications - Get notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get('recipientId');
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!recipientId) {
      return NextResponse.json(
        { success: false, error: 'Missing recipientId' },
        { status: 400 }
      );
    }
    
    let query = sql<Notification>`
      SELECT * FROM mc_notifications 
      WHERE recipient_id = ${recipientId}
    `;
    
    if (unreadOnly) {
      query = sql<Notification>`
        SELECT * FROM mc_notifications 
        WHERE recipient_id = ${recipientId} AND read = false
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql<Notification>`
        SELECT * FROM mc_notifications 
        WHERE recipient_id = ${recipientId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }
    
    const notifications = await query;
    const unreadCount = await sql<{ count: number }>`
      SELECT COUNT(*) as count FROM mc_notifications 
      WHERE recipient_id = ${recipientId} AND read = false
    `;
    
    return NextResponse.json({ 
      success: true, 
      notifications,
      unreadCount: unreadCount[0]?.count || 0
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get notifications', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Create notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.recipient_id || !body.type || !body.title || !body.message || !body.target_type || !body.target_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const id = generateId();
    const notification = await sql<Notification>`
      INSERT INTO mc_notifications (id, recipient_id, sender_id, type, title, message, target_type, target_id)
      VALUES (${id}, ${body.recipient_id}, ${body.sender_id || null}, ${body.type}, ${body.title}, ${body.message}, ${body.target_type}, ${body.target_id})
      RETURNING *
    `;
    
    return NextResponse.json({ success: true, notification: notification[0] });
  } catch (error) {
    console.error('Notifications POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Mark as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.id) {
      // Mark single notification as read
      const notification = await sql<Notification>`
        UPDATE mc_notifications 
        SET read = true
        WHERE id = ${body.id}
        RETURNING *
      `;
      return NextResponse.json({ success: true, notification: notification[0] });
    } else if (body.recipient_id) {
      // Mark all as read for recipient
      await sql`
        UPDATE mc_notifications 
        SET read = true
        WHERE recipient_id = ${body.recipient_id}
      `;
      return NextResponse.json({ success: true, markedAll: true });
    }
    
    return NextResponse.json(
      { success: false, error: 'Missing id or recipient_id' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notification', details: String(error) },
      { status: 500 }
    );
  }
}
