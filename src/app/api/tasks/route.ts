/**
 * Tasks API - STUB (migrated to Convex)
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  return NextResponse.json({ success: true, tasks: [] });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ success: true, taskId: 'stub' });
}
