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
import { Pool } from 'pg';

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

// Create pool if DATABASE_URL is available
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}) : null;

// In-memory fallback
let memGoals: Goal[] = [];
let initialized = false;

async function initDb() {
  if (initialized || !pool) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT DEFAULT 'ongoing',
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'active',
        metrics TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        created_by TEXT DEFAULT 'andrew'
      );
      
      CREATE INDEX IF NOT EXISTS idx_goals_agent ON goals(agent_id);
      CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
    `);
    initialized = true;
  } catch (error) {
    console.error('Failed to initialize goals table:', error);
  }
}

async function getGoals(agentId?: string, status?: string): Promise<Goal[]> {
  await initDb();
  
  if (pool) {
    try {
      let query = 'SELECT * FROM goals WHERE 1=1';
      const params: any[] = [];
      
      if (agentId) {
        params.push(agentId);
        query += ` AND (agent_id = $${params.length} OR agent_id = 'all')`;
      }
      
      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }
      
      query += ' ORDER BY priority ASC, created_at DESC';
      
      const result = await pool.query(query, params);
      return result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        title: row.title,
        description: row.description,
        type: row.type,
        priority: row.priority,
        status: row.status,
        metrics: row.metrics,
        createdAt: parseInt(row.created_at),
        updatedAt: parseInt(row.updated_at),
        createdBy: row.created_by,
      }));
    } catch (error) {
      console.error('Failed to get goals from DB:', error);
    }
  }
  
  // Fallback to memory
  let goals = [...memGoals];
  if (agentId) {
    goals = goals.filter(g => g.agentId === agentId || g.agentId === 'all');
  }
  if (status) {
    goals = goals.filter(g => g.status === status);
  }
  return goals;
}

async function saveGoal(goal: Goal): Promise<void> {
  await initDb();
  
  if (pool) {
    try {
      await pool.query(`
        INSERT INTO goals (id, agent_id, title, description, type, priority, status, metrics, created_at, updated_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          type = EXCLUDED.type,
          priority = EXCLUDED.priority,
          status = EXCLUDED.status,
          metrics = EXCLUDED.metrics,
          updated_at = EXCLUDED.updated_at
      `, [goal.id, goal.agentId, goal.title, goal.description, goal.type, goal.priority, goal.status, goal.metrics, goal.createdAt, goal.updatedAt, goal.createdBy]);
      return;
    } catch (error) {
      console.error('Failed to save goal to DB:', error);
    }
  }
  
  // Fallback to memory
  const idx = memGoals.findIndex(g => g.id === goal.id);
  if (idx >= 0) {
    memGoals[idx] = goal;
  } else {
    memGoals.push(goal);
  }
}

async function deleteGoal(id: string): Promise<boolean> {
  await initDb();
  
  if (pool) {
    try {
      const result = await pool.query('DELETE FROM goals WHERE id = $1', [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Failed to delete goal from DB:', error);
    }
  }
  
  // Fallback to memory
  const idx = memGoals.findIndex(g => g.id === id);
  if (idx >= 0) {
    memGoals.splice(idx, 1);
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || undefined;
    const status = searchParams.get('status') || undefined;
    
    const goals = await getGoals(agentId, status);
    
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
    
    await saveGoal(newGoal);
    
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
    
    // Get existing goal
    const goals = await getGoals();
    const goal = goals.find(g => g.id === id);
    
    if (!goal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }
    
    // Update allowed fields only
    const allowedUpdates = ['title', 'description', 'type', 'priority', 'status', 'metrics'];
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        (goal as any)[key] = updates[key];
      }
    }
    goal.updatedAt = Date.now();
    
    await saveGoal(goal);
    
    return NextResponse.json({ success: true, goal });
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
    
    const deleted = await deleteGoal(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete goal error:', error);
    return NextResponse.json(
      { error: 'Failed to delete goal', details: String(error) },
      { status: 500 }
    );
  }
}
