import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export interface AgentActivity {
  agentId: string;
  lastDmActivity?: string;
  lastApiCall?: string;
  lastHeartbeat?: string;
  status: 'working' | 'idle' | 'offline';
  currentTask?: string;
}

// Ensure table exists
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS agent_activity (
      agent_id TEXT PRIMARY KEY,
      last_dm_activity TIMESTAMP,
      last_api_call TIMESTAMP,
      last_heartbeat TIMESTAMP,
      current_task TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

// Calculate status based on activity
function calculateStatus(activity: {
  last_dm_activity?: Date | null;
  last_api_call?: Date | null;
  last_heartbeat?: Date | null;
}): 'working' | 'idle' | 'offline' {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  const fifteenMinutes = 15 * 60 * 1000;
  
  const lastDm = activity.last_dm_activity ? new Date(activity.last_dm_activity).getTime() : 0;
  const lastApi = activity.last_api_call ? new Date(activity.last_api_call).getTime() : 0;
  const lastHeartbeat = activity.last_heartbeat ? new Date(activity.last_heartbeat).getTime() : 0;
  
  const mostRecent = Math.max(lastDm, lastApi, lastHeartbeat);
  
  if (mostRecent === 0) return 'offline';
  if (now - mostRecent < fiveMinutes) return 'working';
  if (now - mostRecent < fifteenMinutes) return 'idle';
  return 'offline';
}

// GET - Get activity for all agents or specific agent
export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    let activities;
    
    if (agentId) {
      activities = await sql`
        SELECT * FROM agent_activity WHERE agent_id = ${agentId}
      `;
    } else {
      activities = await sql`
        SELECT * FROM agent_activity ORDER BY updated_at DESC
      `;
    }
    
    const result = activities.map(a => ({
      agentId: a.agent_id,
      lastDmActivity: a.last_dm_activity,
      lastApiCall: a.last_api_call,
      lastHeartbeat: a.last_heartbeat,
      currentTask: a.current_task,
      status: calculateStatus(a),
    }));
    
    return NextResponse.json({
      success: true,
      activities: agentId ? result[0] || null : result,
    });
  } catch (error) {
    console.error('Activity GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Update agent activity (agents call this)
export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    
    const body = await request.json();
    const { agentId, type, currentTask } = body;
    
    if (!agentId || !type) {
      return NextResponse.json(
        { success: false, error: 'agentId and type are required' },
        { status: 400 }
      );
    }
    
    // Upsert activity
    const updateField = type === 'dm' ? 'last_dm_activity' 
                      : type === 'api' ? 'last_api_call'
                      : type === 'heartbeat' ? 'last_heartbeat'
                      : null;
    
    if (!updateField) {
      return NextResponse.json(
        { success: false, error: 'type must be dm, api, or heartbeat' },
        { status: 400 }
      );
    }
    
    // Check if exists
    const existing = await sql`
      SELECT agent_id FROM agent_activity WHERE agent_id = ${agentId}
    `;
    
    if (existing.length > 0) {
      // Update existing record - use explicit queries for dynamic columns
      if (updateField === 'last_dm_activity') {
        await sql`UPDATE agent_activity SET last_dm_activity = NOW(), current_task = ${currentTask || null}, updated_at = NOW() WHERE agent_id = ${agentId}`;
      } else if (updateField === 'last_api_call') {
        await sql`UPDATE agent_activity SET last_api_call = NOW(), current_task = ${currentTask || null}, updated_at = NOW() WHERE agent_id = ${agentId}`;
      } else {
        await sql`UPDATE agent_activity SET last_heartbeat = NOW(), current_task = ${currentTask || null}, updated_at = NOW() WHERE agent_id = ${agentId}`;
      }
    } else {
      // Insert new record
      if (updateField === 'last_dm_activity') {
        await sql`INSERT INTO agent_activity (agent_id, last_dm_activity, current_task) VALUES (${agentId}, NOW(), ${currentTask || null})`;
      } else if (updateField === 'last_api_call') {
        await sql`INSERT INTO agent_activity (agent_id, last_api_call, current_task) VALUES (${agentId}, NOW(), ${currentTask || null})`;
      } else {
        await sql`INSERT INTO agent_activity (agent_id, last_heartbeat, current_task) VALUES (${agentId}, NOW(), ${currentTask || null})`;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Activity updated',
    });
  } catch (error) {
    console.error('Activity POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
