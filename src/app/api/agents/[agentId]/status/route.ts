import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/registry';

/**
 * GET /api/agents/:agentId/status — Get agent session status
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const gatewayUrl = process.env.HENRY_GATEWAY_URL;
  const gatewayToken = process.env.HENRY_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({
      success: true,
      agentId,
      agentName: agent.name,
      sessionKey: agent.sessionKey,
      status: 'unknown',
      message: 'Gateway not configured',
    });
  }

  try {
    // Check if there's an active session for this agent
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_list',
        args: {},
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        success: true,
        agentId,
        agentName: agent.name,
        sessionKey: agent.sessionKey,
        status: 'offline',
        error: 'Gateway unreachable',
      });
    }

    const data = await res.json();
    // Handle nested response structure from /tools/invoke
    const sessions = data.result?.details?.sessions || data.sessions || [];
    
    // Check if this agent has an active session (by label)
    const agentSession = sessions.find((s: any) => 
      s.label === agentId ||
      s.sessionKey === agent.sessionKey || 
      (s.key && s.key.includes(agentId))
    );

    return NextResponse.json({
      success: true,
      agentId,
      agentName: agent.name,
      emoji: agent.emoji,
      role: agent.role,
      sessionKey: agentSession?.key || agent.sessionKey,
      status: agentSession ? 'online' : 'offline',
      session: agentSession || null,
    });

  } catch (error) {
    return NextResponse.json({
      success: true,
      agentId,
      agentName: agent.name,
      sessionKey: agent.sessionKey,
      status: 'error',
      error: String(error),
    });
  }
}
