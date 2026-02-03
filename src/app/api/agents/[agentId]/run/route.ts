import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/registry';

/**
 * POST /api/agents/:agentId/run — Send message to agent's persistent session
 */
export async function POST(
  request: Request,
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
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 500 });
  }

  // Get optional message from request body
  let message = `HEARTBEAT: Check Mission Control for tasks assigned to '${agentId}'. If you have assigned tasks, work on them. Update WORKING.md with your progress. If nothing needs attention, reply HEARTBEAT_OK.`;
  
  try {
    const body = await request.json().catch(() => ({}));
    if (body.message) {
      message = body.message;
    }
  } catch {}

  try {
    // Use sessions_spawn to send message to agent (works reliably over HTTP)
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_spawn',
        args: {
          task: `You are ${agent.name}, ${agent.role} at Spark Studio. Your workspace is C:\\Users\\theul\\clawd\\agents\\${agentId}. Read your SOUL.md and HEARTBEAT.md. ${message}`,
          label: agentId,
          cleanup: 'keep',
          timeoutSeconds: 300, // 5 minutes for real work
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ 
        error: 'Gateway error', 
        details: text 
      }, { status: res.status });
    }

    const data = await res.json();
    
    return NextResponse.json({
      success: true,
      agentId,
      agentName: agent.name,
      action: 'triggered',
      result: data,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to trigger agent',
      details: String(error),
    }, { status: 500 });
  }
}
