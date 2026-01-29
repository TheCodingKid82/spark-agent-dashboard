/**
 * Tasks API
 * 
 * GET /api/tasks - List all tasks (optional ?agentId= filter)
 * POST /api/tasks - Create a new task
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/tasks/store';
import { TaskCreateRequest } from '@/lib/tasks/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const board = searchParams.get('board') === 'true';
    const agentName = searchParams.get('agentName') || agentId || 'Agent';
    
    if (agentId) {
      if (board) {
        const taskBoard = await store.getTaskBoard(agentId, agentName);
        return NextResponse.json(taskBoard);
      }
      const tasks = await store.getTasksForAgent(agentId);
      return NextResponse.json({ tasks, count: tasks.length });
    }
    
    const tasks = await store.getAllTasks();
    return NextResponse.json({ tasks, count: tasks.length });
  } catch (error) {
    console.error('Tasks GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get tasks', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TaskCreateRequest = await request.json();
    
    if (!body.agentId || !body.title || !body.createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, title, createdBy' },
        { status: 400 }
      );
    }
    
    const task = await store.createTask(body);
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Tasks POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create task', details: String(error) },
      { status: 500 }
    );
  }
}
