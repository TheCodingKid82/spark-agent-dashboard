import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export interface StatusMetric {
  label: string;
  value: string | number;
  change?: string; // e.g., "+5%" or "-2"
  trend?: 'up' | 'down' | 'neutral';
}

export interface StatusSection {
  title: string;
  content?: string;
  metrics?: StatusMetric[];
  items?: string[];
}

export interface StatusReport {
  id: string;
  agentId: string;
  agentName: string;
  department: string;
  summary: string;
  sections: StatusSection[];
  highlights?: string[];
  blockers?: string[];
  nextSteps?: string[];
  lastUpdated: string;
  createdAt: string;
}

// Ensure table exists
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS status_reports (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL UNIQUE,
      agent_name TEXT NOT NULL,
      department TEXT NOT NULL,
      summary TEXT,
      sections JSONB DEFAULT '[]',
      highlights JSONB DEFAULT '[]',
      blockers JSONB DEFAULT '[]',
      next_steps JSONB DEFAULT '[]',
      last_updated TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

// GET - Get all status reports or specific agent's report
export async function GET(request: NextRequest) {
  try {
    await ensureTable();
    
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    let reports;
    
    if (agentId) {
      reports = await sql`
        SELECT * FROM status_reports WHERE agent_id = ${agentId}
      `;
    } else {
      reports = await sql`
        SELECT * FROM status_reports ORDER BY last_updated DESC
      `;
    }
    
    return NextResponse.json({
      success: true,
      reports: reports.map(r => ({
        id: r.id,
        agentId: r.agent_id,
        agentName: r.agent_name,
        department: r.department,
        summary: r.summary,
        sections: r.sections,
        highlights: r.highlights,
        blockers: r.blockers,
        nextSteps: r.next_steps,
        lastUpdated: r.last_updated,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Status reports GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create or update status report (agents call this)
export async function POST(request: NextRequest) {
  try {
    await ensureTable();
    
    const body = await request.json();
    const {
      agentId,
      agentName,
      department,
      summary,
      sections = [],
      highlights = [],
      blockers = [],
      nextSteps = [],
    } = body;
    
    if (!agentId || !department) {
      return NextResponse.json(
        { success: false, error: 'agentId and department are required' },
        { status: 400 }
      );
    }
    
    // Upsert - update if exists, create if not
    const existing = await sql`
      SELECT id FROM status_reports WHERE agent_id = ${agentId}
    `;
    
    if (existing.length > 0) {
      await sql`
        UPDATE status_reports SET
          agent_name = ${agentName || agentId},
          department = ${department},
          summary = ${summary || null},
          sections = ${JSON.stringify(sections)},
          highlights = ${JSON.stringify(highlights)},
          blockers = ${JSON.stringify(blockers)},
          next_steps = ${JSON.stringify(nextSteps)},
          last_updated = NOW()
        WHERE agent_id = ${agentId}
      `;
      
      return NextResponse.json({
        success: true,
        message: 'Status report updated',
        reportId: existing[0].id,
      });
    } else {
      const id = `report_${agentId}_${Date.now()}`;
      
      await sql`
        INSERT INTO status_reports (
          id, agent_id, agent_name, department, summary,
          sections, highlights, blockers, next_steps
        ) VALUES (
          ${id}, ${agentId}, ${agentName || agentId}, ${department}, ${summary || null},
          ${JSON.stringify(sections)}, ${JSON.stringify(highlights)},
          ${JSON.stringify(blockers)}, ${JSON.stringify(nextSteps)}
        )
      `;
      
      return NextResponse.json({
        success: true,
        message: 'Status report created',
        reportId: id,
      });
    }
  } catch (error) {
    console.error('Status reports POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Update specific sections of a report
export async function PATCH(request: NextRequest) {
  try {
    await ensureTable();
    
    const body = await request.json();
    const { agentId, updates } = body;
    
    if (!agentId || !updates) {
      return NextResponse.json(
        { success: false, error: 'agentId and updates are required' },
        { status: 400 }
      );
    }
    
    // Get current report
    const current = await sql`
      SELECT * FROM status_reports WHERE agent_id = ${agentId}
    `;
    
    if (current.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      );
    }
    
    const report = current[0];
    
    // Merge updates
    const newSummary = updates.summary ?? report.summary;
    const newSections = updates.sections ?? report.sections;
    const newHighlights = updates.highlights ?? report.highlights;
    const newBlockers = updates.blockers ?? report.blockers;
    const newNextSteps = updates.nextSteps ?? report.next_steps;
    
    await sql`
      UPDATE status_reports SET
        summary = ${newSummary},
        sections = ${JSON.stringify(newSections)},
        highlights = ${JSON.stringify(newHighlights)},
        blockers = ${JSON.stringify(newBlockers)},
        next_steps = ${JSON.stringify(newNextSteps)},
        last_updated = NOW()
      WHERE agent_id = ${agentId}
    `;
    
    return NextResponse.json({
      success: true,
      message: 'Status report updated',
    });
  } catch (error) {
    console.error('Status reports PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
