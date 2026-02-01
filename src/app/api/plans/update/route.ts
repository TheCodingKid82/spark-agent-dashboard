import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * POST /api/plans/update
 * 
 * Quick endpoint for agents to post updates to their active plans.
 * Agents should call this frequently while working on a plan.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, agentId, message, type = 'progress' } = body;
    
    // Either planId or agentId required
    if (!planId && !agentId) {
      return NextResponse.json(
        { success: false, error: 'planId or agentId required' },
        { status: 400 }
      );
    }
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'message required' },
        { status: 400 }
      );
    }
    
    // If agentId provided, find their active (in_progress) plan
    let targetPlanId = planId;
    if (!targetPlanId && agentId) {
      const activePlans = await sql`
        SELECT id FROM agent_plans 
        WHERE agent_id = ${agentId} AND status = 'in_progress'
        ORDER BY approved_at DESC
        LIMIT 1
      `;
      
      if (activePlans.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No active plan found for agent' },
          { status: 404 }
        );
      }
      targetPlanId = activePlans[0].id;
    }
    
    // Create update object
    const update = {
      id: `upd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      message,
      type, // 'progress' | 'blocker' | 'completed' | 'note' | 'milestone'
    };
    
    // Append update to plan
    await sql`
      UPDATE agent_plans 
      SET updates = updates || ${JSON.stringify([update])}::jsonb
      WHERE id = ${targetPlanId}
    `;
    
    return NextResponse.json({
      success: true,
      planId: targetPlanId,
      updateId: update.id,
      timestamp: update.timestamp,
    });
  } catch (error) {
    console.error('Plan update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Get recent updates for a plan
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    if (!planId && !agentId) {
      return NextResponse.json(
        { success: false, error: 'planId or agentId required' },
        { status: 400 }
      );
    }
    
    let plans;
    if (planId) {
      plans = await sql`SELECT id, updates FROM agent_plans WHERE id = ${planId}`;
    } else {
      plans = await sql`
        SELECT id, updates FROM agent_plans 
        WHERE agent_id = ${agentId} AND status = 'in_progress'
        ORDER BY approved_at DESC
        LIMIT 1
      `;
    }
    
    if (plans.length === 0) {
      return NextResponse.json({ success: true, updates: [] });
    }
    
    const updates = (plans[0].updates || [])
      .slice(-limit)
      .reverse(); // Most recent first
    
    return NextResponse.json({
      success: true,
      planId: plans[0].id,
      updates,
    });
  } catch (error) {
    console.error('Get updates error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
