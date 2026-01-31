/**
 * Groups API
 * 
 * GET /api/groups - List all groups (optionally filter by member)
 * POST /api/groups - Create a new group
 */

import { NextRequest, NextResponse } from 'next/server';
import * as groupStore from '@/lib/chat/group-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const member = searchParams.get('member');
    
    const groups = await groupStore.getGroups(member || undefined);
    return NextResponse.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    return NextResponse.json(
      { error: 'Failed to get groups', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, members, createdBy } = body;
    
    if (!name || !members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: name, members (array)' },
        { status: 400 }
      );
    }
    
    const group = await groupStore.createGroup({
      name,
      members,
      createdBy: createdBy || 'andrew',
    });
    
    return NextResponse.json(group);
  } catch (error) {
    console.error('Create group error:', error);
    return NextResponse.json(
      { error: 'Failed to create group', details: String(error) },
      { status: 500 }
    );
  }
}
