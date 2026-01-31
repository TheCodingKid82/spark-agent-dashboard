/**
 * Goals API
 * 
 * Long-term objectives for agents. Agents read these on heartbeat
 * and create tasks to accomplish them. Only humans can edit goals.
 * 
 * GET /api/goals - List all goals (optionally filter by agent)
 * POST /api/goals - Create a new goal (human only)
 * PATCH /api/goals - Update a goal (human only)
 * DELETE /api/goals - Delete a goal (human only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export interface Goal {
  id: string;
  agentId: string;        // Which agent owns this goal
  title: string;          // Short title
  description: string;    // Detailed description
  type: 'long-term' | 'ongoing' | 'milestone';  // Goal type
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'completed';
  metrics?: string;       // How to measure success
  createdAt: number;
  updatedAt: number;
  createdBy: string;      // Who created it (andrew, cale, henry)
}

const GOALS_KEY = 'spark:goals';

async function getGoals(): Promise<Goal[]> {
  const goals = await kv.get<Goal[]>(GOALS_KEY);
  return goals || [];
}

async function saveGoals(goals: Goal[]): Promise<void> {
  await kv.set(GOALS_KEY, goals);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const status = searchParams.get('status');
    
    let goals = await getGoals();
    
    // Filter by agent if specified
    if (agentId) {
      goals = goals.filter(g => g.agentId === agentId || g.agentId === 'all');
    }
    
    // Filter by status if specified
    if (status) {
      goals = goals.filter(g => g.status === status);
    }
    
    return NextResponse.json({ goals, count: goals.length });
  } catch (error) {
    console.error('Get goals error:', error);
    return NextResponse.json(
      { error: 'Failed to get goals', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, title, description, type = 'ongoing', priority = 'medium', metrics, createdBy = 'andrew' } = body;
    
    if (!agentId || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: agentId, title, description' },
        { status: 400 }
      );
    }
    
    const goals = await getGoals();
    
    const newGoal: Goal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      title,
      description,
      type,
      priority,
      status: 'active',
      metrics,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy,
    };
    
    goals.push(newGoal);
    await saveGoals(goals);
    
    return NextResponse.json({ success: true, goal: newGoal });
  } catch (error) {
    console.error('Create goal error:', error);
    return NextResponse.json(
      { error: 'Failed to create goal', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }
    
    const goals = await getGoals();
    const goalIndex = goals.findIndex(g => g.id === id);
    
    if (goalIndex === -1) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }
    
    // Update allowed fields only
    const allowedUpdates = ['title', 'description', 'type', 'priority', 'status', 'metrics'];
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        (goals[goalIndex] as any)[key] = updates[key];
      }
    }
    goals[goalIndex].updatedAt = Date.now();
    
    await saveGoals(goals);
    
    return NextResponse.json({ success: true, goal: goals[goalIndex] });
  } catch (error) {
    console.error('Update goal error:', error);
    return NextResponse.json(
      { error: 'Failed to update goal', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }
    
    const goals = await getGoals();
    const filteredGoals = goals.filter(g => g.id !== id);
    
    if (filteredGoals.length === goals.length) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }
    
    await saveGoals(filteredGoals);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete goal error:', error);
    return NextResponse.json(
      { error: 'Failed to delete goal', details: String(error) },
      { status: 500 }
    );
  }
}
