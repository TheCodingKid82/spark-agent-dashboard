/**
 * Documents API
 * 
 * GET /api/documents - List all documents
 * POST /api/documents - Create a new document
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql, type Document } from '@/lib/db';

function generateId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/documents - List documents
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const authorId = searchParams.get('authorId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    let query = sql<Document>`
      SELECT * FROM mc_documents 
      WHERE 1=1
    `;
    
    if (taskId) {
      query = sql<Document>`
        SELECT * FROM mc_documents 
        WHERE task_id = ${taskId}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;
    } else if (authorId) {
      query = sql<Document>`
        SELECT * FROM mc_documents 
        WHERE author_id = ${authorId}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;
    } else if (status) {
      query = sql<Document>`
        SELECT * FROM mc_documents 
        WHERE status = ${status}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql<Document>`
        SELECT * FROM mc_documents 
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;
    }
    
    const documents = await query;
    
    return NextResponse.json({ 
      success: true, 
      documents,
      count: documents.length 
    });
  } catch (error) {
    console.error('Documents GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get documents', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/documents - Create a new document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.title || !body.content || !body.author_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, content, author_id' },
        { status: 400 }
      );
    }
    
    const id = generateId();
    const document = await sql<Document>`
      INSERT INTO mc_documents (id, title, content, content_type, author_id, task_id, status, tags)
      VALUES (${id}, ${body.title}, ${body.content}, ${body.content_type || 'markdown'}, ${body.author_id}, ${body.task_id || null}, ${body.status || 'draft'}, ${body.tags || []})
      RETURNING *
    `;
    
    // Log activity
    await sql`
      INSERT INTO mc_activities (id, actor_id, actor_type, action, target_type, target_id, metadata)
      VALUES (${generateId().replace('doc', 'act')}, ${body.author_id}, 'agent', 'created_document', 'document', ${id}, ${JSON.stringify({ title: body.title })})
    `;
    
    return NextResponse.json({ success: true, document: document[0] });
  } catch (error) {
    console.error('Documents POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create document', details: String(error) },
      { status: 500 }
    );
  }
}
