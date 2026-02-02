/**
 * Status Reports API - STUB (migrated to Convex)
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  return NextResponse.json({ success: true, reports: [] });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ success: true, reportId: 'stub' });
}

export async function PATCH(_req: NextRequest) {
  return NextResponse.json({ success: true });
}
