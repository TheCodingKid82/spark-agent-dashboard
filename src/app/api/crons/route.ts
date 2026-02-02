/**
 * Crons API - STUB (migrated to Convex)
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  return NextResponse.json({ success: true, jobs: [], runs: [] });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ success: true });
}

export async function PATCH(_req: NextRequest) {
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest) {
  return NextResponse.json({ success: true });
}
