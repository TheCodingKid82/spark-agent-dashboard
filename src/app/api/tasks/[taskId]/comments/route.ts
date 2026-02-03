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
 * POST /api/tasks/:taskId/comments — Add a comment to a task
 * Automatically triggers mentioned agents (@atlas, @apollo, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const body = await request.json();
    const { content, authorId, authorType } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    // Extract @mentions from content
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1].toLowerCase());
    }

    // Create the comment
    const messageId = await convex.mutation(api.messages.create, {
      taskId: taskId as Id<"tasks">,
      content,
      authorId: authorId || 'andrew',
      authorType: authorType || 'human',
      messageType: 'comment',
    });

    // Trigger mentioned agents immediately
    const agentIds = ['atlas', 'maia', 'apollo', 'orpheus', 'artemis', 'callisto', 'iris'];
    const triggeredAgents: string[] = [];
    
    for (const mention of mentions) {
      if (agentIds.includes(mention)) {
        // Trigger the agent via the trigger endpoint
        const baseUrl = request.nextUrl.origin;
        fetch(`${baseUrl}/api/agents/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: mention,
            taskId,
            action: 'mention',
            message: `You were mentioned by ${authorId || 'andrew'} on task ${taskId}: "${content}"`,
          }),
        }).catch(err => console.error(`Failed to trigger ${mention}:`, err));
        
        triggeredAgents.push(mention);
      }
    }

    return NextResponse.json({ 
      success: true, 
      messageId,
      taskId,
      mentions,
      triggeredAgents,
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to add comment', 
      details: String(error) 
    }, { status: 500 });
  }
}
