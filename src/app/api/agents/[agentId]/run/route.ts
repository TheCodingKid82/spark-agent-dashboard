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
    // Send message to agent's labeled persistent session
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_send',
        params: {
          label: agentId,
          message: message,
          timeoutSeconds: 300, // 5 minutes for real work
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      
      // If session not found, try to spawn it
      if (text.includes('No session found')) {
        const spawnRes = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gatewayToken}`,
          },
          body: JSON.stringify({
            tool: 'sessions_spawn',
            params: {
              task: `You are ${agent.name}, ${agent.role} at Spark Studio. Your workspace is C:\\Users\\theul\\clawd\\agents\\${agentId}. Read your SOUL.md and HEARTBEAT.md. ${message}`,
              label: agentId,
              cleanup: 'keep',
              timeoutSeconds: 300,
            },
          }),
        });

        if (spawnRes.ok) {
          const spawnData = await spawnRes.json();
          return NextResponse.json({
            success: true,
            agentId,
            agentName: agent.name,
            action: 'spawned',
            result: spawnData,
          });
        }
      }
      
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
      action: 'messaged',
      result: data,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to trigger agent',
      details: String(error),
    }, { status: 500 });
  }
}
