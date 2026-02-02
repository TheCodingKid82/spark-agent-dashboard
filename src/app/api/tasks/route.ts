/**
 * Tasks API (Mission Control)
 * 
 * GET /api/tasks - List all tasks
 * POST /api/tasks - Create a new task
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql, type Task, type TaskStatus, type TaskPriority, initMissionControlDb } from '@/lib/db';

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Ensure DB is initialized
initMissionControlDb().catch(console.error);

// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as TaskStatus | null;
    const assignedTo = searchParams.get('assignedTo');
    const createdBy = searchParams.get('createdBy');
    const board = searchParams.get('board') === 'true';
    
    if (board) {
      // Return Kanban board format
      const allTasks = await sql<Task>`
        SELECT * FROM mc_tasks ORDER BY created_at DESC
      `;
      
      const columns = {
        inbox: allTasks.filter(t => t.status === 'inbox'),
        assigned: allTasks.filter(t => t.status === 'assigned'),
        in_progress: allTasks.filter(t => t.status === 'in_progress'),
        review: allTasks.filter(t => t.status === 'review'),
        done: allTasks.filter(t => t.status === 'done'),
      };
      
      return NextResponse.json({ success: true, board: columns });
    }
    
    if (status) {
      const tasks = await sql<Task>`
        SELECT * FROM mc_tasks WHERE status = ${status} ORDER BY updated_at DESC
      `;
      return NextResponse.json({ success: true, tasks, count: tasks.length });
    }
    
    if (assignedTo) {
      const tasks = await sql<Task>`
        SELECT * FROM mc_tasks WHERE assigned_to = ${assignedTo} ORDER BY updated_at DESC
      `;
      return NextResponse.json({ success: true, tasks, count: tasks.length });
    }
    
    if (createdBy) {
      const tasks = await sql<Task>`
        SELECT * FROM mc_tasks WHERE created_by = ${createdBy} ORDER BY created_at DESC
      `;
      return NextResponse.json({ success: true, tasks, count: tasks.length });
    }
    
    const tasks = await sql<Task>`
      SELECT * FROM mc_tasks ORDER BY updated_at DESC LIMIT 500
    `;
    
    return NextResponse.json({ success: true, tasks, count: tasks.length });
  } catch (error) {
    console.error('Tasks GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get tasks', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.title || !body.created_by) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, created_by' },
        { status: 400 }
      );
    }
    
    const id = generateId();
    const taskStatus: TaskStatus = body.status || 'inbox';
    const taskPriority: TaskPriority = body.priority || 'medium';
    
    const task = await sql<Task>`
      INSERT INTO mc_tasks (id, title, description, status, priority, created_by, assigned_to, due_date, tags)
      VALUES (${id}, ${body.title}, ${body.description || ''}, ${taskStatus}, ${taskPriority}, ${body.created_by}, ${body.assigned_to || null}, ${body.due_date ? new Date(body.due_date) : null}, ${body.tags || []})
      RETURNING *
    `;
    
    // Log activity
    await sql`
      INSERT INTO mc_activities (id, actor_id, actor_type, action, target_type, target_id, metadata)
      VALUES (${generateId().replace('task', 'act')}, ${body.created_by}, 'agent', 'created_task', 'task', ${id}, ${JSON.stringify({ title: body.title, status: taskStatus })})
    `;
    
    // Create notification if assigned
    if (body.assigned_to && body.assigned_to !== body.created_by) {
      await sql`
        INSERT INTO mc_notifications (id, recipient_id, sender_id, type, title, message, target_type, target_id)
        VALUES (
          ${`ntf-${Date.now()}`}, 
          ${body.assigned_to}, 
          ${body.created_by}, 
          'assignment', 
          'New Task Assigned', 
          ${`You have been assigned: ${body.title}`}, 
          'task', 
          ${id}
        )
      `;
      
      // Auto-subscribe assignee
      await sql`
        INSERT INTO mc_subscriptions (id, subscriber_id, target_type, target_id, auto_subscribed)
        VALUES (${`sub-${Date.now()}`}, ${body.assigned_to}, 'task', ${id}, true)
        ON CONFLICT (subscriber_id, target_type, target_id) DO NOTHING
      `;
    }
    
    return NextResponse.json({ success: true, task: task[0] });
  } catch (error) {
    console.error('Tasks POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create task', details: String(error) },
      { status: 500 }
    );
  }
}
