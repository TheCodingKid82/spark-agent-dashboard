import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/activities — Get recent activity feed
 * Query params:
 *   - limit: max items (default 50)
 *   - actorId: filter by actor
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const actorId = searchParams.get('actorId');

  try {
    let activities;
    if (actorId) {
      activities = await convex.query(api.activities.getByActor, { actorId, limit });
    } else {
      activities = await convex.query(api.activities.getRecent, { limit });
    }

    return NextResponse.json({
      success: true,
      activities,
      count: activities.length,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch activities',
      details: String(error),
    }, { status: 500 });
  }
}

/**
 * POST /api/activities — Log an activity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actorId, actorType, action, targetType, targetId, metadata } = body;

    if (!actorId || !action || !targetType || !targetId) {
      return NextResponse.json({ 
        error: 'actorId, action, targetType, and targetId required' 
      }, { status: 400 });
    }

    const activityId = await convex.mutation(api.activities.create, {
      actorId,
      actorType: actorType || 'agent',
      action,
      targetType,
      targetId,
      metadata,
    });

    return NextResponse.json({
      success: true,
      activityId,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to log activity',
      details: String(error),
    }, { status: 500 });
  }
}
