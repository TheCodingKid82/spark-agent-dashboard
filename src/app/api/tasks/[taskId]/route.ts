/**
 * Task Detail API (Mission Control) - STUB
 * 
 * Migrated to Convex. Use Convex mutations directly.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// GET /api/tasks/[taskId]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { taskId } = await params;
  return NextResponse.json({ success: false, error: 'Use Convex: api.tasks.getById', taskId });
}

// PATCH /api/tasks/[taskId]
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const { taskId } = await params;
  return NextResponse.json({ success: false, error: 'Use Convex: api.tasks.update', taskId });
}

// DELETE /api/tasks/[taskId]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { taskId } = await params;
  return NextResponse.json({ success: false, error: 'Use Convex: api.tasks.remove', taskId });
}
