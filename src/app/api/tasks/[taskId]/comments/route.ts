import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../../convex/_generated/api';
import type { Id } from '../../../../../../convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/tasks/:taskId/comments — Get comments for a task
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const messages = await convex.query(api.messages.getByTask, { 
      taskId: taskId as Id<"tasks"> 
    });

    return NextResponse.json({ success: true, comments: messages });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to fetch comments', 
      details: String(error) 
    }, { status: 500 });
  }
}

/**
 * POST /api/tasks/:taskId/comments — Add a comment to a task (for agents)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const body = await request.json();
    const { content, authorId, mentions } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const messageId = await convex.mutation(api.messages.create, {
      taskId: taskId as Id<"tasks">,
      content,
      authorId: authorId || 'agent',
      authorType: 'agent',
      messageType: 'comment',
      mentions: mentions || [],
    });

    return NextResponse.json({ 
      success: true, 
      messageId,
      taskId,
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to add comment', 
      details: String(error) 
    }, { status: 500 });
  }
}
