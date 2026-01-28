import { NextResponse } from 'next/server';
import { getRecord, updateRecord } from '@/lib/provisioning/store';
import { sendAgentMessage } from '@/lib/provisioning/gateway-config';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'assigned' | 'in-progress' | 'complete' | 'failed';
  assignedAt: string;
  completedAt?: string;
}

/**
 * POST /api/agents/:agentId/tasks — Assign a task to an agent
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const record = getRecord(agentId);

  if (!record) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, priority = 'medium' } = body;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const task: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    title,
    description: description || '',
    priority,
    status: 'assigned',
    assignedAt: new Date().toISOString(),
  };

  // Send the task to the agent via gateway message
  if (record.gatewayUrl && record.gatewayToken) {
    const taskMessage = `
## New Task Assigned: ${title}

**Priority:** ${priority.toUpperCase()}
**Task ID:** ${task.id}

${description || 'No additional details.'}

Please work on this task and report back when complete. Update your SESSION.md with progress.
    `.trim();

    const result = await sendAgentMessage(
      record.gatewayUrl,
      record.gatewayToken,
      taskMessage,
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        task,
        error: `Task created but failed to deliver: ${result.error}`,
      });
    }
  }

  return NextResponse.json({
    success: true,
    task,
    message: `Task "${title}" assigned to ${record.agentName}`,
  });
}
