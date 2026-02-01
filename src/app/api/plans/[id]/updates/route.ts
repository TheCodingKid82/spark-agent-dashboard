import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * POST /api/plans/[id]/updates
 * 
 * Add an update to a specific plan by ID.
 * Alternative to /api/plans/update for explicit plan targeting.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const body = await request.json();
    const { message, type = 'progress' } = body;
    
    if (!message) {
      return NextResponse.json(
        { success: false, error: 'message required' },
        { status: 400 }
      );
    }
    
    // Verify plan exists
    const plans = await sql`SELECT id FROM agent_plans WHERE id = ${planId}`;
    if (plans.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }
    
    // Create update object
    const update = {
      id: `upd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      message,
      type, // 'progress' | 'blocker' | 'completed' | 'milestone' | 'note'
    };
    
    // Append update to plan
    await sql`
      UPDATE agent_plans 
      SET updates = updates || ${JSON.stringify([update])}::jsonb
      WHERE id = ${planId}
    `;
    
    return NextResponse.json({
      success: true,
      planId,
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

// GET /api/plans/[id]/updates - Get updates for a specific plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const plans = await sql`SELECT id, updates FROM agent_plans WHERE id = ${planId}`;
    
    if (plans.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }
    
    const updates = (plans[0].updates || [])
      .slice(-limit)
      .reverse(); // Most recent first
    
    return NextResponse.json({
      success: true,
      planId,
      updates,
      total: (plans[0].updates || []).length,
    });
  } catch (error) {
    console.error('Get updates error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
