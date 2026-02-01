import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const AGENT_URLS: Record<string, string> = {
  atlas: 'https://atlas-production-25a1.up.railway.app',
  apollo: 'https://apollo-production-04cf.up.railway.app',
  artemis: 'https://artemis-production-6c19.up.railway.app',
  maia: 'https://maia-production-5d78.up.railway.app',
  orpheus: 'https://orpheus-production.up.railway.app',
  callisto: 'https://callisto-production.up.railway.app',
  iris: 'https://iris-production-22ad.up.railway.app',
};

/**
 * GET /api/heartbeats
 * Get heartbeat configs and recent runs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    // Get configs
    let configs;
    if (agentId) {
      configs = await sql`SELECT * FROM heartbeat_configs WHERE agent_id = ${agentId}`;
    } else {
      configs = await sql`SELECT * FROM heartbeat_configs ORDER BY agent_id`;
    }
    
    // Get recent runs (last 24h)
    let runs;
    if (agentId) {
      runs = await sql`
        SELECT * FROM heartbeat_runs 
        WHERE agent_id = ${agentId} AND started_at > NOW() - INTERVAL '24 hours'
        ORDER BY started_at DESC
        LIMIT 50
      `;
    } else {
      runs = await sql`
        SELECT * FROM heartbeat_runs 
        WHERE started_at > NOW() - INTERVAL '24 hours'
        ORDER BY started_at DESC
        LIMIT 100
      `;
    }
    
    return NextResponse.json({ success: true, configs, runs });
  } catch (error) {
    console.error('Get heartbeats error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/heartbeats
 * Trigger a heartbeat for an agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, prompt } = body;
    
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId required' },
        { status: 400 }
      );
    }
    
    const agentUrl = AGENT_URLS[agentId];
    if (!agentUrl) {
      return NextResponse.json(
        { success: false, error: 'Unknown agent' },
        { status: 400 }
      );
    }
    
    // Get config for default prompt
    const configs = await sql`SELECT * FROM heartbeat_configs WHERE agent_id = ${agentId}`;
    const config = configs[0];
    const heartbeatPrompt = prompt || config?.prompt || 'Heartbeat check - report status';
    
    // Create run record
    const startTime = Date.now();
    const runResult = await sql`
      INSERT INTO heartbeat_runs (agent_id, status)
      VALUES (${agentId}, 'running')
      RETURNING id
    `;
    const runId = runResult[0]?.id;
    
    // Log activity
    await sql`
      INSERT INTO agent_activity (agent_id, event_type, direction, content)
      VALUES (${agentId}, 'heartbeat', 'outbound', ${heartbeatPrompt})
    `;
    
    try {
      // Send heartbeat to agent
      const response = await fetch(`${agentUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GATEWAY_TOKEN || 'spark-studio-2026'}`,
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: heartbeatPrompt }],
        }),
      });
      
      const data = await response.json();
      const durationMs = Date.now() - startTime;
      const responseText = data.choices?.[0]?.message?.content || JSON.stringify(data);
      
      // Update run record
      await sql`
        UPDATE heartbeat_runs 
        SET status = 'completed', response = ${responseText}, duration_ms = ${durationMs}, completed_at = NOW()
        WHERE id = ${runId}
      `;
      
      // Log response activity
      await sql`
        INSERT INTO agent_activity (agent_id, event_type, direction, content, metadata)
        VALUES (${agentId}, 'heartbeat_response', 'inbound', ${responseText}, ${JSON.stringify({ duration_ms: durationMs })})
      `;
      
      return NextResponse.json({
        success: true,
        runId,
        agentId,
        response: responseText,
        durationMs,
      });
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      const durationMs = Date.now() - startTime;
      
      // Update run as failed
      await sql`
        UPDATE heartbeat_runs 
        SET status = 'failed', error = ${errorMsg}, duration_ms = ${durationMs}, completed_at = NOW()
        WHERE id = ${runId}
      `;
      
      return NextResponse.json({
        success: false,
        runId,
        agentId,
        error: errorMsg,
        durationMs,
      });
    }
  } catch (error) {
    console.error('Trigger heartbeat error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/heartbeats
 * Update heartbeat config
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, enabled, intervalMinutes, prompt } = body;
    
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: 'agentId required' },
        { status: 400 }
      );
    }
    
    await sql`
      UPDATE heartbeat_configs 
      SET 
        enabled = COALESCE(${enabled}, enabled),
        interval_minutes = COALESCE(${intervalMinutes}, interval_minutes),
        prompt = COALESCE(${prompt}, prompt),
        updated_at = NOW()
      WHERE agent_id = ${agentId}
    `;
    
    return NextResponse.json({ success: true, agentId });
  } catch (error) {
    console.error('Update heartbeat config error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
