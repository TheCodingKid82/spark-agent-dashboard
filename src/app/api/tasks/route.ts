/**
 * Tasks API - Connects to Convex
 */
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const limit = parseInt(searchParams.get('limit') || '100');

    let tasks;
    if (assignedTo) {
      tasks = await convex.query(api.tasks.getByAssignedTo, { assignedTo });
    } else if (status) {
      tasks = await convex.query(api.tasks.getByStatus, { status: status as any });
    } else {
      tasks = await convex.query(api.tasks.getAll, { limit });
    }

    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    console.error('Tasks API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, priority, createdBy, assignedTo, tags, autoAssign } = body;

    if (!title || !createdBy) {
      return NextResponse.json(
        { success: false, error: 'title and createdBy are required' },
        { status: 400 }
      );
    }

    // Use auto-assign mutation if enabled (default)
    const result = await convex.mutation(api.tasks.createWithAutoAssign, {
      title,
      description,
      priority: priority || 'medium',
      createdBy,
      tags,
      autoAssign: autoAssign !== false,
    });

    return NextResponse.json({ 
      success: true, 
      taskId: result.taskId,
      assignedTo: result.assignedTo,
      status: result.status,
    });
  } catch (error) {
    console.error('Task creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
