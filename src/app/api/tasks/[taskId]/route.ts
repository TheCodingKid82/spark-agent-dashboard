/**
 * Task Detail API - Connects to Convex
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// GET /api/tasks/[taskId]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const task = await convex.query(api.tasks.getById, { 
      id: taskId as Id<"tasks"> 
    });
    
    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[taskId]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const { updatedBy, ...updates } = body;
    
    if (!updatedBy) {
      return NextResponse.json(
        { success: false, error: 'updatedBy is required' },
        { status: 400 }
      );
    }
    
    const task = await convex.mutation(api.tasks.update, {
      id: taskId as Id<"tasks">,
      updatedBy,
      ...updates,
    });
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[taskId]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    await convex.mutation(api.tasks.remove, { 
      id: taskId as Id<"tasks"> 
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
