import { NextResponse } from 'next/server';

/**
 * GET /api/agents/live-status — Get real-time running status for all agents
 * Checks gateway sessions_list to see which agents are actively running
 */
export async function GET() {
  const gatewayUrl = process.env.HENRY_GATEWAY_URL;
  const gatewayToken = process.env.HENRY_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({ 
      error: 'Gateway not configured',
      running: [],
    });
  }

  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_list',
        args: {
          activeMinutes: 2, // Only sessions active in last 2 minutes
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ 
        error: 'Gateway unreachable',
        running: [],
      });
    }

    const data = await res.json();
    const sessions = data.result?.details?.sessions || data.sessions || [];
    
    // Find running agent sessions
    // Pattern: agent:main:cron:* or agent:main:subagent:* with agent name in the key or message
    const agentPatterns = ['atlas', 'maia', 'apollo', 'orpheus', 'artemis', 'callisto', 'iris'];
    const running: string[] = [];
    
    for (const session of sessions) {
      const key = session.key || session.sessionKey || '';
      
      // Check if this is a cron session (agent:main:cron:UUID)
      if (key.includes(':cron:') || key.includes(':subagent:')) {
        // Check session transcript or label for agent name
        // For now, mark as running if recently active
        const updatedAt = session.updatedAt || 0;
        const isRecent = Date.now() - updatedAt < 120000; // 2 minutes
        
        if (isRecent) {
          // Try to identify which agent from the session label or transcript
          const label = session.label || session.displayName || '';
          for (const agent of agentPatterns) {
            if (label.toLowerCase().includes(agent) || key.toLowerCase().includes(agent)) {
              if (!running.includes(agent)) {
                running.push(agent);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      running,
      checkedAt: Date.now(),
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check status',
      details: String(error),
      running: [],
    });
  }
}
