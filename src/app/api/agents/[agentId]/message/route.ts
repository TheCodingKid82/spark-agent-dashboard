import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/registry';

/**
 * POST /api/agents/:agentId/message — Send a message to an agent session
 * 
 * This uses OpenClaw's sessions_send to message agents through the gateway.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found in roster' }, { status: 404 });
  }

  const gatewayUrl = process.env.HENRY_GATEWAY_URL;
  const gatewayToken = process.env.HENRY_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({ 
      error: 'Gateway not configured. Set HENRY_GATEWAY_URL and HENRY_GATEWAY_TOKEN.',
      hint: 'Gateway URL should be the localtunnel URL exposing Henry\'s gateway'
    }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Use OpenClaw tools/invoke to send message to agent session
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_send',
        params: {
          sessionKey: agent.sessionKey,
          message,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ 
        success: false, 
        error: `Gateway error: ${res.status}`,
        details: text 
      }, { status: 502 });
    }

    const result = await res.json();
    return NextResponse.json({ 
      success: true, 
      agentId,
      sessionKey: agent.sessionKey,
      result 
    });

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
