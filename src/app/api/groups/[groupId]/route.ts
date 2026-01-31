/**
 * Group API
 * 
 * GET /api/groups/[groupId] - Get group details
 * DELETE /api/groups/[groupId] - Delete a group
 */

import { NextRequest, NextResponse } from 'next/server';
import * as groupStore from '@/lib/chat/group-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    const group = await groupStore.getGroup(groupId);
    
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    return NextResponse.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    return NextResponse.json(
      { error: 'Failed to get group', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
    await groupStore.deleteGroup(groupId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    return NextResponse.json(
      { error: 'Failed to delete group', details: String(error) },
      { status: 500 }
    );
  }
}
