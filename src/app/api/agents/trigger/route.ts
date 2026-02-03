import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/agents/trigger — Trigger an agent to work on their tasks
 * Called when tasks are assigned or need retry
 */
export async function POST(request: NextRequest) {
  const gatewayUrl = process.env.HENRY_GATEWAY_URL;
  const gatewayToken = process.env.HENRY_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 500 });
  }

  try {
    const { agentId, taskId, action, message: customMessage } = await request.json();

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 });
    }

    // Build the message based on action
    let message = `HEARTBEAT: Check Mission Control for your assigned tasks.`;
    
    if (customMessage) {
      // Use custom message if provided (for @mentions)
      message = customMessage;
    } else if (action === 'assigned' && taskId) {
      message = `NEW TASK ASSIGNED: You have a new task (${taskId}). Check Mission Control immediately and start working. Update status to in_progress and add a comment when you begin.`;
    } else if (action === 'retry' && taskId) {
      message = `TASK RETRY: Task ${taskId} was marked incomplete and needs another attempt. Check Mission Control, review what went wrong, and try again.`;
    } else if (action === 'mention' && taskId) {
      message = `@MENTION: You were tagged in a comment on task ${taskId}. Check Mission Control and respond to the mention.`;
    }

    // Trigger the agent via gateway
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_spawn',
        args: {
          task: `You are an agent at Spark Studio. Your workspace is C:\\Users\\theul\\clawd\\agents\\${agentId}. Read your HEARTBEAT.md for instructions. ${message}`,
          label: agentId,
          cleanup: 'keep',
          timeoutSeconds: 300,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to trigger ${agentId}:`, text);
      return NextResponse.json({ 
        error: 'Gateway error', 
        details: text 
      }, { status: res.status });
    }

    return NextResponse.json({
      success: true,
      agentId,
      action: action || 'heartbeat',
      taskId,
    });

  } catch (error) {
    console.error('Trigger error:', error);
    return NextResponse.json({ 
      error: 'Failed to trigger agent', 
      details: String(error) 
    }, { status: 500 });
  }
}
