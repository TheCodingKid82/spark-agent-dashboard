import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/registry';

// Map agent IDs to their cron job IDs (from gateway)
const AGENT_CRON_JOBS: Record<string, string> = {
  atlas: "cb3d0559-116a-453b-91c7-c4f42d9273ad",
  maia: "240168a9-3166-4a5c-ad04-dff0aeb63e1c",
  apollo: "f8bf32dd-9791-45eb-a97a-ce7f2358e2e8",
  orpheus: "aacf2cc0-c3ce-4a12-851d-61204e6b7fac",
  artemis: "c0ec0d55-3681-42d0-9796-746b0d3b1e4f",
  callisto: "7908fbd6-d2d5-4cb2-9c6f-6044d9f15f49",
  iris: "85770874-cab7-4f37-8a15-e8ccdeed9c46",
};

/**
 * POST /api/agents/:agentId/run — Trigger agent heartbeat immediately
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const agent = getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const cronJobId = AGENT_CRON_JOBS[agentId];
  if (!cronJobId) {
    return NextResponse.json({ error: 'No cron job configured for agent' }, { status: 400 });
  }

  const gatewayUrl = process.env.HENRY_GATEWAY_URL;
  const gatewayToken = process.env.HENRY_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'cron',
        params: {
          action: 'run',
          jobId: cronJobId,
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
      cronJobId,
      result: data,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to trigger agent',
      details: String(error),
    }, { status: 500 });
  }
}
