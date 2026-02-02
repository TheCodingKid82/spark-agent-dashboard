/**
 * Subscriptions API
 * 
 * GET /api/subscriptions - Get subscriptions for a user
 * POST /api/subscriptions - Subscribe to a task/document
 * DELETE /api/subscriptions - Unsubscribe
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql, type Subscription } from '@/lib/db';

function generateId(): string {
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/subscriptions - Get subscriptions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriberId = searchParams.get('subscriberId');
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    
    if (subscriberId) {
      const subscriptions = await sql<Subscription>`
        SELECT * FROM mc_subscriptions 
        WHERE subscriber_id = ${subscriberId}
        ORDER BY created_at DESC
      `;
      return NextResponse.json({ success: true, subscriptions });
    }
    
    if (targetType && targetId) {
      const subscriptions = await sql<Subscription>`
        SELECT * FROM mc_subscriptions 
        WHERE target_type = ${targetType} AND target_id = ${targetId}
        ORDER BY created_at DESC
      `;
      return NextResponse.json({ success: true, subscriptions });
    }
    
    return NextResponse.json(
      { success: false, error: 'Missing subscriberId or targetType/targetId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Subscriptions GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get subscriptions', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions - Subscribe
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.subscriber_id || !body.target_type || !body.target_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: subscriber_id, target_type, target_id' },
        { status: 400 }
      );
    }
    
    const id = generateId();
    const subscription = await sql<Subscription>`
      INSERT INTO mc_subscriptions (id, subscriber_id, target_type, target_id, auto_subscribed)
      VALUES (${id}, ${body.subscriber_id}, ${body.target_type}, ${body.target_id}, ${body.auto_subscribed || false})
      ON CONFLICT (subscriber_id, target_type, target_id) DO UPDATE SET
        auto_subscribed = EXCLUDED.auto_subscribed
      RETURNING *
    `;
    
    return NextResponse.json({ success: true, subscription: subscription[0] });
  } catch (error) {
    console.error('Subscriptions POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/subscriptions - Unsubscribe
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const subscriberId = searchParams.get('subscriberId');
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    
    if (id) {
      await sql`DELETE FROM mc_subscriptions WHERE id = ${id}`;
      return NextResponse.json({ success: true, deleted: id });
    }
    
    if (subscriberId && targetType && targetId) {
      await sql`
        DELETE FROM mc_subscriptions 
        WHERE subscriber_id = ${subscriberId} AND target_type = ${targetType} AND target_id = ${targetId}
      `;
      return NextResponse.json({ success: true, deleted: true });
    }
    
    return NextResponse.json(
      { success: false, error: 'Missing id or subscriberId/targetType/targetId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Subscriptions DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete subscription', details: String(error) },
      { status: 500 }
    );
  }
}
