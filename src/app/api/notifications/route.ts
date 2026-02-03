import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/notifications — Get notifications for an agent
 * Query params:
 *   - recipientId: agent ID (required)
 *   - unreadOnly: only unread (default true)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const recipientId = searchParams.get('recipientId');
  const unreadOnly = searchParams.get('unreadOnly') !== 'false';

  if (!recipientId) {
    return NextResponse.json({ error: 'recipientId required' }, { status: 400 });
  }

  try {
    const notifications = unreadOnly
      ? await convex.query(api.notifications.getUnreadByRecipient, { recipientId })
      : await convex.query(api.notifications.getByRecipient, { recipientId });

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch notifications',
      details: String(error),
    }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications — Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationIds, recipientId, markAllRead } = body;

    if (markAllRead && recipientId) {
      // Mark all notifications for this recipient as read
      await convex.mutation(api.notifications.markAllAsRead, { recipientId });
      return NextResponse.json({ success: true, action: 'marked_all_read' });
    }

    if (notificationIds && Array.isArray(notificationIds)) {
      for (const id of notificationIds) {
        await convex.mutation(api.notifications.markAsRead, { id });
      }
      return NextResponse.json({ 
        success: true, 
        action: 'marked_read',
        count: notificationIds.length,
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to update notifications',
      details: String(error),
    }, { status: 500 });
  }
}
