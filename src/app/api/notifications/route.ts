/**
 * Notifications API - STUB (migrated to Convex)
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  return NextResponse.json({ success: true, notifications: [], unreadCount: 0 });
}

export async function PATCH(_req: NextRequest) {
  return NextResponse.json({ success: true });
}
