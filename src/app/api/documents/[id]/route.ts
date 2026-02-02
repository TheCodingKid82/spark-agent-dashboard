/**
 * Document Detail API
 * 
 * GET /api/documents/[id] - Get document details
 * PATCH /api/documents/[id] - Update document
 * DELETE /api/documents/[id] - Delete document
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql, type Document } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id] - Get document
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const documents = await sql<Document>`
      SELECT * FROM mc_documents WHERE id = ${id}
    `;
    
    if (documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, document: documents[0] });
  } catch (error) {
    console.error('Document GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get document', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/documents/[id] - Update document
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updates: string[] = [];
    const values: unknown[] = [id];
    let paramIndex = 2;
    
    if (body.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(body.title);
    }
    if (body.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(body.content);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
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
    updates.push(`version = version + 1`);
    
    const documents = await sql<Document>`
      UPDATE mc_documents 
      SET ${sql(updates.join(', '))}
      WHERE id = ${id}
      RETURNING *
    `;
    
    if (documents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    // Log activity
    await sql`
      INSERT INTO mc_activities (id, actor_id, actor_type, action, target_type, target_id, metadata)
      VALUES (${`act-${Date.now()}`}, ${body.updated_by || 'system'}, 'agent', 'updated_document', 'document', ${id}, ${JSON.stringify({ title: body.title })})
    `;
    
    return NextResponse.json({ success: true, document: documents[0] });
  } catch (error) {
    console.error('Document PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update document', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] - Delete document
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const result = await sql`
      DELETE FROM mc_documents WHERE id = ${id} RETURNING id
    `;
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Document DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete document', details: String(error) },
      { status: 500 }
    );
  }
}
