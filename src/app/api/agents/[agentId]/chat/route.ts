import { NextResponse } from 'next/server';
import { getAgent, loadRoster } from '@/lib/agents/registry';

interface ChatRequest {
  message: string;
  sessionKey?: string;
}

/**
 * POST /api/agents/[agentId]/chat — Send a message to an agent's gateway
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = (await request.json()) as ChatRequest;
    const { message, sessionKey } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Single-gateway architecture:
    // - One gateway (Henry) handles all sessions (agents)
    // - Each agent is identified by a sessionKey (e.g. agent:atlas:main)

    const roster = loadRoster();
    const entry = getAgent(agentId);

    const gatewayUrl = roster.gateway.url;
    const gatewayToken = roster.gateway.token;

    if (!gatewayUrl || !gatewayToken) {
      return NextResponse.json(
        { error: 'HENRY_GATEWAY_URL / HENRY_GATEWAY_TOKEN not configured (or agent-roster.json gateway is empty)' },
        { status: 500 }
      );
    }

    if (!entry?.sessionKey) {
      return NextResponse.json(
        { error: `Agent ${agentId} not found in roster` },
        { status: 404 }
      );
    }

    // Stable session routing (allow explicit override from UI for debugging)
    const effectiveSessionKey = sessionKey || entry.sessionKey;

    const agentRes = await fetch(`${gatewayUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
        // Route to the target agent-session inside the single gateway
        'x-clawdbot-session-key': effectiveSessionKey,
        // Keep agent id constant; routing happens via session key.
        'x-clawdbot-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'clawdbot',
        input: message,
        user: effectiveSessionKey,
      }),
    });

    if (!agentRes.ok) {
      const errorText = await agentRes.text();
      
      // Check if the endpoint is not enabled
      if (agentRes.status === 404 || agentRes.status === 405) {
        return NextResponse.json(
          { 
            error: 'Agent gateway API not enabled. The agent needs gateway.http.endpoints.responses.enabled=true in its config.',
            details: errorText,
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: `Gateway error: ${agentRes.status}`, details: errorText },
        { status: agentRes.status }
      );
    }

    const response = await agentRes.json();

    // Extract the output text from the OpenResponses format
    let outputText = '';
    if (response.output) {
      for (const item of response.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text') {
              outputText += content.text;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      agentId,
      response: outputText || response,
      raw: response,
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to chat with agent: ${String(error)}` },
      { status: 500 }
    );
  }
}
