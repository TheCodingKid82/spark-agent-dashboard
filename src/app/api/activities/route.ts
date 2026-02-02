/**
 * Activities API
 * 
 * GET /api/activities - Get activity feed (real-time stream)
 * POST /api/activities - Log a new activity
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql, query, type Activity } from '@/lib/db';

function generateId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/activities - Get activity feed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const actorId = searchParams.get('actorId');
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    
    let sqlQuery = `
      SELECT * FROM mc_activities 
      WHERE 1=1
    `;
    const params: unknown[] = [];
    
    if (actorId) {
      params.push(actorId);
      sqlQuery += ` AND actor_id = $${params.length}`;
    }
    
    if (targetType) {
      params.push(targetType);
      sqlQuery += ` AND target_type = $${params.length}`;
    }
    
    if (targetId) {
      params.push(targetId);
      sqlQuery += ` AND target_id = $${params.length}`;
    }
    
    params.push(limit);
    sqlQuery += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    
    if (offset > 0) {
      params.push(offset);
      sqlQuery += ` OFFSET $${params.length}`;
    }
    
    const activities = await query<Activity>(sqlQuery, params);
    
    return NextResponse.json({ 
      success: true, 
      activities,
      count: activities.length,
      hasMore: activities.length === limit
    });
  } catch (error) {
    console.error('Activities GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get activities', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/activities - Log a new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.actor_id || !body.action || !body.target_type || !body.target_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: actor_id, action, target_type, target_id' },
        { status: 400 }
      );
    }
    
    const id = generateId();
    const activity = await sql<Activity>`
      INSERT INTO mc_activities (id, actor_id, actor_type, action, target_type, target_id, metadata)
      VALUES (${id}, ${body.actor_id}, ${body.actor_type || 'agent'}, ${body.action}, ${body.target_type}, ${body.target_id}, ${body.metadata ? JSON.stringify(body.metadata) : null})
      RETURNING *
    `;
    
    return NextResponse.json({ success: true, activity: activity[0] });
  } catch (error) {
    console.error('Activities POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log activity', details: String(error) },
      { status: 500 }
    );
  }
}
