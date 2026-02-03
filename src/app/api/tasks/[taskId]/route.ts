import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../convex/_generated/api';
import type { Id } from '../../../../../convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/tasks/:taskId — Get a single task
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const task = await convex.query(api.tasks.getById, { 
      id: taskId as Id<"tasks"> 
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch task', 
      details: String(error) 
    }, { status: 500 });
  }
}

/**
 * PATCH /api/tasks/:taskId — Update a task (for agents or dashboard)
 * Auto-triggers agent when assigned or when task needs retry (done → assigned)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const body = await request.json();
    const { status, assignedTo, title, description, priority, tags, updatedBy, oldStatus, oldAssignedTo } = body;

    // Get current task state for comparison
    const currentTask = await convex.query(api.tasks.getById, { 
      id: taskId as Id<"tasks"> 
    });

    // Build update object
    const updates: Record<string, any> = {
      id: taskId as Id<"tasks">,
      updatedBy: updatedBy || 'agent',
    };

    if (status) updates.status = status;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priority) updates.priority = priority;
    if (tags) updates.tags = tags;

    await convex.mutation(api.tasks.update, updates);

    // Determine if we need to trigger the agent
    let triggerAction: string | null = null;
    const effectiveAssignee = assignedTo ?? currentTask?.assignedTo;
    const effectiveOldStatus = oldStatus ?? currentTask?.status;
    const effectiveOldAssignee = oldAssignedTo ?? currentTask?.assignedTo;

    // New assignment
    if (assignedTo && assignedTo !== effectiveOldAssignee) {
      triggerAction = 'assigned';
    }
    // Retry: moved from done back to assigned
    else if (status === 'assigned' && effectiveOldStatus === 'done') {
      triggerAction = 'retry';
    }

    // Trigger agent if needed
    if (triggerAction && effectiveAssignee) {
      const baseUrl = request.nextUrl.origin;
      fetch(`${baseUrl}/api/agents/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: effectiveAssignee,
          taskId,
          action: triggerAction,
        }),
      }).catch(err => console.error('Failed to trigger agent:', err));
    }

    return NextResponse.json({ 
      success: true, 
      taskId,
      updated: Object.keys(updates).filter(k => k !== 'id' && k !== 'updatedBy'),
      triggered: triggerAction ? { agent: effectiveAssignee, action: triggerAction } : null,
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to update task', 
      details: String(error) 
    }, { status: 500 });
  }
}
