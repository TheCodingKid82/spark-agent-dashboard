import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * GET /api/activity/logs
 * Get agent activity logs with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const eventType = searchParams.get('eventType');
    const limit = parseInt(searchParams.get('limit') || '100');
    const since = searchParams.get('since'); // ISO timestamp
    
    let logs;
    if (agentId && since) {
      logs = await sql`
        SELECT * FROM agent_activity 
        WHERE agent_id = ${agentId} AND timestamp > ${since}
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `;
    } else if (agentId) {
      logs = await sql`
        SELECT * FROM agent_activity 
        WHERE agent_id = ${agentId}
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `;
    } else if (since) {
      logs = await sql`
        SELECT * FROM agent_activity 
        WHERE timestamp > ${since}
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `;
    } else {
      logs = await sql`
        SELECT * FROM agent_activity 
        ORDER BY timestamp DESC 
        LIMIT ${limit}
      `;
    }
    
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Get activity logs error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/activity/logs
 * Log agent activity (called by agents or intercepted from gateway)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, eventType, direction, content, metadata, sessionId } = body;
    
    if (!agentId || !eventType) {
      return NextResponse.json(
        { success: false, error: 'agentId and eventType required' },
        { status: 400 }
      );
    }
    
    await sql`
      INSERT INTO agent_activity (agent_id, event_type, direction, content, metadata, session_id)
      VALUES (${agentId}, ${eventType}, ${direction || null}, ${content || null}, ${JSON.stringify(metadata || {})}, ${sessionId || null})
    `;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log activity error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/activity/logs
 * Clear old logs (retention)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '7');
    
    const result = await sql`
      DELETE FROM agent_activity 
      WHERE timestamp < NOW() - INTERVAL '${olderThanDays} days'
      RETURNING id
    `;
    
    return NextResponse.json({ 
      success: true, 
      deleted: result.length,
      message: `Deleted logs older than ${olderThanDays} days`
    });
  } catch (error) {
    console.error('Delete logs error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
