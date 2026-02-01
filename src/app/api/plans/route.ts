import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string;
}

export interface PlanUpdate {
  id: string;
  timestamp: string;
  message: string;
  type: 'progress' | 'blocker' | 'completed' | 'note';
}

export interface Plan {
  id: string;
  agentId: string;
  agentName: string;
  objective: string;
  description?: string;
  steps: PlanStep[];
  collaborators: string[]; // agent IDs
  cronSchedule?: string;
  estimatedHours?: number;
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  updates: PlanUpdate[];
  submittedAt: string;
  approvedAt?: string;
  completedAt?: string;
  rejectionReason?: string;
}

// Ensure table exists
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS agent_plans (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      objective TEXT NOT NULL,
      description TEXT,
      steps JSONB DEFAULT '[]',
      collaborators JSONB DEFAULT '[]',
      cron_schedule TEXT,
      estimated_hours INTEGER,
      status TEXT DEFAULT 'pending',
      updates JSONB DEFAULT '[]',
      submitted_at TIMESTAMP DEFAULT NOW(),
      approved_at TIMESTAMP,
      completed_at TIMESTAMP,
      rejection_reason TEXT
    )
  `;
}

// GET - List all plans or filter by agent/status
export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const status = searchParams.get('status');
    
    let plans;
    
    if (agentId && status) {
      plans = await sql`
        SELECT * FROM agent_plans 
        WHERE agent_id = ${agentId} AND status = ${status}
        ORDER BY submitted_at DESC
      `;
    } else if (agentId) {
      plans = await sql`
        SELECT * FROM agent_plans 
        WHERE agent_id = ${agentId}
        ORDER BY submitted_at DESC
      `;
    } else if (status) {
      plans = await sql`
        SELECT * FROM agent_plans 
        WHERE status = ${status}
        ORDER BY submitted_at DESC
      `;
    } else {
      plans = await sql`
        SELECT * FROM agent_plans 
        ORDER BY 
          CASE status 
            WHEN 'pending' THEN 1 
            WHEN 'in_progress' THEN 2 
            WHEN 'approved' THEN 3
            WHEN 'completed' THEN 4
            WHEN 'rejected' THEN 5
          END,
          submitted_at DESC
      `;
    }
    
    return NextResponse.json({
      success: true,
      plans: plans.map(p => ({
        id: p.id,
        agentId: p.agent_id,
        agentName: p.agent_name,
        objective: p.objective,
        description: p.description,
        steps: p.steps,
        collaborators: p.collaborators,
        cronSchedule: p.cron_schedule,
        estimatedHours: p.estimated_hours,
        status: p.status,
        updates: p.updates,
        submittedAt: p.submitted_at,
        approvedAt: p.approved_at,
        completedAt: p.completed_at,
        rejectionReason: p.rejection_reason,
      })),
    });
  } catch (error) {
    console.error('Plans GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create new plan (agents submit)
export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    
    const body = await request.json();
    const {
      agentId,
      agentName,
      objective,
      description,
      steps = [],
      collaborators = [],
      cronSchedule,
      estimatedHours,
    } = body;
    
    if (!agentId || !objective) {
      return NextResponse.json(
        { success: false, error: 'agentId and objective are required' },
        { status: 400 }
      );
    }
    
    const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    await sql`
      INSERT INTO agent_plans (
        id, agent_id, agent_name, objective, description, 
        steps, collaborators, cron_schedule, estimated_hours
      ) VALUES (
        ${id}, ${agentId}, ${agentName || agentId}, ${objective}, ${description || null},
        ${JSON.stringify(steps)}, ${JSON.stringify(collaborators)}, 
        ${cronSchedule || null}, ${estimatedHours || null}
      )
    `;
    
    return NextResponse.json({
      success: true,
      planId: id,
      message: 'Plan submitted for approval',
    });
  } catch (error) {
    console.error('Plans POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Update plan (approve, reject, add update, change status)
export async function PATCH(request: NextRequest) {
  try {
    await ensureTable();
    
    const body = await request.json();
    const { planId, action, ...data } = body;
    
    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'planId is required' },
        { status: 400 }
      );
    }
    
    switch (action) {
      case 'approve':
        await sql`
          UPDATE agent_plans 
          SET status = 'approved', approved_at = NOW()
          WHERE id = ${planId}
        `;
        break;
        
      case 'reject':
        await sql`
          UPDATE agent_plans 
          SET status = 'rejected', rejection_reason = ${data.reason || null}
          WHERE id = ${planId}
        `;
        break;
        
      case 'start':
        await sql`
          UPDATE agent_plans 
          SET status = 'in_progress'
          WHERE id = ${planId}
        `;
        break;
        
      case 'complete':
        await sql`
          UPDATE agent_plans 
          SET status = 'completed', completed_at = NOW()
          WHERE id = ${planId}
        `;
        break;
        
      case 'add_update':
        const update = {
          id: `upd_${Date.now()}`,
          timestamp: new Date().toISOString(),
          message: data.message,
          type: data.type || 'progress',
        };
        await sql`
          UPDATE agent_plans 
          SET updates = updates || ${JSON.stringify([update])}::jsonb
          WHERE id = ${planId}
        `;
        break;
        
      case 'update_step':
        // Get current steps, update the specific one
        const plan = await sql`SELECT steps FROM agent_plans WHERE id = ${planId}`;
        if (plan.length > 0) {
          const steps = plan[0].steps as PlanStep[];
          const stepIndex = steps.findIndex(s => s.id === data.stepId);
          if (stepIndex >= 0) {
            steps[stepIndex] = { ...steps[stepIndex], ...data.stepUpdate };
            await sql`
              UPDATE agent_plans 
              SET steps = ${JSON.stringify(steps)}
              WHERE id = ${planId}
            `;
          }
        }
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      message: `Plan ${action} successful`,
    });
  } catch (error) {
    console.error('Plans PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a plan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    
    if (!planId) {
      return NextResponse.json(
        { success: false, error: 'planId is required' },
        { status: 400 }
      );
    }
    
    await sql`DELETE FROM agent_plans WHERE id = ${planId}`;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Plans DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
