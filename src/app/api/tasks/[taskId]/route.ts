/**
 * Single Task API
 * 
 * GET /api/tasks/[taskId] - Get a specific task
 * PATCH /api/tasks/[taskId] - Update a task
 * DELETE /api/tasks/[taskId] - Delete a task
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/tasks/store';
import { TaskUpdateRequest } from '@/lib/tasks/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const task = await store.getTask(taskId);
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ task });
  } catch (error) {
    console.error('Task GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get task', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const updates: TaskUpdateRequest = await request.json();
    
    const task = await store.updateTask(taskId, updates);
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Task PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update task', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const deleted = await store.deleteTask(taskId);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Task DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task', details: String(error) },
      { status: 500 }
    );
  }
}
