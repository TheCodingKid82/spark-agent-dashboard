import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/agents/logs — Get recent agent session logs
 * Query params:
 *   - agentId: filter by specific agent
 *   - limit: max messages (default 100)
 */
export async function GET(request: NextRequest) {
  const gatewayUrl = process.env.HENRY_GATEWAY_URL;
  const gatewayToken = process.env.HENRY_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    // Get list of active sessions
    const listRes = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_list',
        args: { messageLimit: 5 },
      }),
    });

    if (!listRes.ok) {
      return NextResponse.json({ error: 'Gateway unreachable' }, { status: 502 });
    }

    const listData = await listRes.json();
    const sessions = listData.result?.details?.sessions || [];

    // Filter to agent sessions
    const agentPatterns = ['atlas', 'maia', 'apollo', 'orpheus', 'artemis', 'callisto', 'iris'];
    const agentSessions = sessions.filter((s: any) => {
      const label = s.label || '';
      if (agentId) return label === agentId;
      return agentPatterns.includes(label);
    });

    // Fetch history for each agent session
    const logs: any[] = [];
    
    for (const session of agentSessions.slice(0, 7)) {
      const historyRes = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify({
          tool: 'sessions_history',
          args: {
            sessionKey: session.key,
            limit: Math.floor(limit / 7),
            includeTools: false,
          },
        }),
      });

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const messages = historyData.result?.details?.messages || [];
        
        for (const msg of messages) {
          logs.push({
            agentId: session.label,
            sessionKey: session.key,
            timestamp: msg.timestamp,
            role: msg.role,
            content: typeof msg.content === 'string' 
              ? msg.content 
              : msg.content?.[0]?.text || JSON.stringify(msg.content),
          });
        }
      }
    }

    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      logs: logs.slice(0, limit),
      sessionCount: agentSessions.length,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch logs',
      details: String(error),
    }, { status: 500 });
  }
}
