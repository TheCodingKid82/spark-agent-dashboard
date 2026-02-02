/**
 * Task Detail API (Mission Control)
 * 
 * GET /api/tasks/[taskId] - Get task details with comments
 * PATCH /api/tasks/[taskId] - Update task
 * DELETE /api/tasks/[taskId] - Delete task
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql, type Task, type Message } from '@/lib/db';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// GET /api/tasks/[taskId] - Get task with comments
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    
    const tasks = await sql<Task>`
      SELECT * FROM mc_tasks WHERE id = ${taskId}
    `;
    
    if (tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }
    
    // Get comments/messages for this task
    const messages = await sql<Message>`
      SELECT * FROM mc_messages 
      WHERE task_id = ${taskId} 
      ORDER BY created_at ASC
    `;
    
    return NextResponse.json({ 
      success: true, 
      task: tasks[0],
      messages,
      messageCount: messages.length
    });
  } catch (error) {
    console.error('Task GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get task', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[taskId] - Update task
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    
    const updates: string[] = [];
    const values: unknown[] = [taskId];
    let paramIndex = 2;
    
    const oldTask = await sql<Task>`SELECT * FROM mc_tasks WHERE id = ${taskId}`;
    if (oldTask.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }
    
    if (body.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(body.description);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
      if (body.status === 'done') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }
    if (body.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(body.priority);
    }
    if (body.assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(body.assigned_to);
    }
    if (body.due_date !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(body.due_date ? new Date(body.due_date) : null);
    }
    if (body.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(body.tags);
    }
    
    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Build the query manually since we need dynamic SET clause
    const pool = (await import('@/lib/db')).pool;
    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 500 }
      );
    }
    
    const query = `UPDATE mc_tasks SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await pool.query<Task>(query, values);
    
    const task = result.rows[0];
    
    // Log activity
    await sql`
      INSERT INTO mc_activities (id, actor_id, actor_type, action, target_type, target_id, metadata)
      VALUES (
        ${`act-${Date.now()}`}, 
        ${body.updated_by || 'system'}, 
        'agent', 
        'updated_task', 
        'task', 
        ${taskId}, 
        ${JSON.stringify({ 
          title: task.title, 
          status: body.status,
          oldStatus: oldTask[0].status,
          assigned_to: body.assigned_to 
        })}
      )
    `;
    
    // Create notification for status change
    if (body.status && body.status !== oldTask[0].status) {
      // Notify subscribers
      const subscribers = await sql<{ subscriber_id: string }>`
        SELECT subscriber_id FROM mc_subscriptions 
        WHERE target_type = 'task' AND target_id = ${taskId}
      `;
      
      for (const sub of subscribers) {
        if (sub.subscriber_id !== body.updated_by) {
          await sql`
            INSERT INTO mc_notifications (id, recipient_id, sender_id, type, title, message, target_type, target_id)
            VALUES (
              ${`ntf-${Date.now()}-${sub.subscriber_id}`}, 
              ${sub.subscriber_id}, 
              ${body.updated_by || 'system'}, 
              'status_change', 
              'Task Status Changed', 
              ${`${task.title} moved to ${body.status}`}, 
              'task', 
              ${taskId}
            )
          `;
        }
      }
    }
    
    // Create notification for new assignment
    if (body.assigned_to && body.assigned_to !== oldTask[0].assigned_to && body.assigned_to !== body.updated_by) {
      await sql`
        INSERT INTO mc_notifications (id, recipient_id, sender_id, type, title, message, target_type, target_id)
        VALUES (
          ${`ntf-${Date.now()}`}, 
          ${body.assigned_to}, 
          ${body.updated_by || 'system'}, 
          'assignment', 
          'Task Assigned to You', 
          ${`You have been assigned: ${task.title}`}, 
          'task', 
          ${taskId}
        )
      `;
      
      // Auto-subscribe new assignee
      await sql`
        INSERT INTO mc_subscriptions (id, subscriber_id, target_type, target_id, auto_subscribed)
        VALUES (${`sub-${Date.now()}`}, ${body.assigned_to}, 'task', ${taskId}, true)
        ON CONFLICT (subscriber_id, target_type, target_id) DO NOTHING
      `;
    }
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Task PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update task', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[taskId] - Delete task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    
    const result = await sql`
      DELETE FROM mc_tasks WHERE id = ${taskId} RETURNING id
    `;
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }
    
    // Clean up subscriptions
    await sql`DELETE FROM mc_subscriptions WHERE target_type = 'task' AND target_id = ${taskId}`;
    
    return NextResponse.json({ success: true, deleted: taskId });
  } catch (error) {
    console.error('Task DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete task', details: String(error) },
      { status: 500 }
    );
  }
}
