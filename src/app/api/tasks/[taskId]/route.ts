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
 * PATCH /api/tasks/:taskId — Update a task (for agents)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const body = await request.json();
    const { status, assignedTo, title, description, priority, tags, updatedBy } = body;

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

    return NextResponse.json({ 
      success: true, 
      taskId,
      updated: Object.keys(updates).filter(k => k !== 'id' && k !== 'updatedBy'),
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to update task', 
      details: String(error) 
    }, { status: 500 });
  }
}
