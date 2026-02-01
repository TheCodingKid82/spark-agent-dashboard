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
 * POST /api/heartbeats/scheduler
 * 
 * Run heartbeats for all agents that are due.
 * This should be called by an external cron (every 5 minutes).
 */
export async function POST(request: NextRequest) {
  try {
    // Optional auth for external cron
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.SCHEDULER_TOKEN || process.env.GATEWAY_TOKEN || 'spark-studio-2026';
    if (authHeader && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get enabled heartbeat configs
    const configs = await sql`
      SELECT * FROM heartbeat_configs WHERE enabled = true
    `;
    
    const results: Array<{
      agentId: string;
      status: string;
      durationMs?: number;
      error?: string;
      skipped?: boolean;
      reason?: string;
    }> = [];
    
    for (const config of configs) {
      const agentId = config.agent_id;
      
      // Check if we need to run (based on interval)
      const lastRuns = await sql`
        SELECT started_at FROM heartbeat_runs 
        WHERE agent_id = ${agentId} AND status IN ('completed', 'running')
        ORDER BY started_at DESC
        LIMIT 1
      `;
      
      const lastRun = lastRuns[0];
      const intervalMs = (config.interval_minutes || 30) * 60 * 1000;
      const now = Date.now();
      
      if (lastRun && (now - new Date(lastRun.started_at).getTime()) < intervalMs) {
        results.push({
          agentId,
          status: 'skipped',
          skipped: true,
          reason: `Last run was ${Math.round((now - new Date(lastRun.started_at).getTime()) / 60000)} minutes ago`,
        });
        continue;
      }
      
      // Run heartbeat
      const agentUrl = AGENT_URLS[agentId];
      if (!agentUrl) {
        results.push({ agentId, status: 'error', error: 'Unknown agent URL' });
        continue;
      }
      
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
        VALUES (${agentId}, 'heartbeat', 'outbound', ${config.prompt})
      `;
      
      try {
        const response = await fetch(`${agentUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GATEWAY_TOKEN || 'spark-studio-2026'}`,
          },
          body: JSON.stringify({
            model: 'anthropic/claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: config.prompt }],
          }),
        });
        
        const data = await response.json();
        const durationMs = Date.now() - startTime;
        const responseText = data.choices?.[0]?.message?.content || JSON.stringify(data);
        
        await sql`
          UPDATE heartbeat_runs 
          SET status = 'completed', response = ${responseText}, duration_ms = ${durationMs}, completed_at = NOW()
          WHERE id = ${runId}
        `;
        
        await sql`
          INSERT INTO agent_activity (agent_id, event_type, direction, content, metadata)
          VALUES (${agentId}, 'heartbeat_response', 'inbound', ${responseText}, ${JSON.stringify({ duration_ms: durationMs })})
        `;
        
        results.push({ agentId, status: 'completed', durationMs });
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        const durationMs = Date.now() - startTime;
        
        await sql`
          UPDATE heartbeat_runs 
          SET status = 'failed', error = ${errorMsg}, duration_ms = ${durationMs}, completed_at = NOW()
          WHERE id = ${runId}
        `;
        
        results.push({ agentId, status: 'failed', error: errorMsg, durationMs });
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Scheduler error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/heartbeats/scheduler
 * Get scheduler status
 */
export async function GET() {
  try {
    const configs = await sql`SELECT * FROM heartbeat_configs WHERE enabled = true`;
    const recentRuns = await sql`
      SELECT agent_id, status, started_at, duration_ms 
      FROM heartbeat_runs 
      WHERE started_at > NOW() - INTERVAL '1 hour'
      ORDER BY started_at DESC
    `;
    
    return NextResponse.json({
      success: true,
      enabledAgents: configs.length,
      recentRuns: recentRuns.length,
      agents: configs.map(c => ({
        agentId: c.agent_id,
        intervalMinutes: c.interval_minutes,
        prompt: c.prompt?.slice(0, 100) + '...',
      })),
    });
  } catch (error) {
    console.error('Get scheduler status error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
