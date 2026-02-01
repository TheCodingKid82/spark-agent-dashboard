import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const AGENT_URLS: Record<string, string> = {
  atlas: 'https://atlas-production-25a1.up.railway.app',
  apollo: 'https://apollo-production-04cf.up.railway.app',
  artemis: 'https://artemis-production-6c19.up.railway.app',
  maia: 'https://maia-production-5d78.up.railway.app',
  orpheus: 'https://orpheus-production.up.railway.app',
  callisto: 'https://callisto-production.up.railway.app',
  iris: 'https://iris-production-22ad.up.railway.app',
};

/**
 * GET /api/crons
 * Get cron jobs and recent runs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const jobId = searchParams.get('jobId');
    
    // Get jobs
    let jobs;
    if (jobId) {
      jobs = await sql`SELECT * FROM cron_jobs WHERE job_id = ${jobId}`;
    } else if (agentId) {
      jobs = await sql`SELECT * FROM cron_jobs WHERE agent_id = ${agentId} ORDER BY created_at DESC`;
    } else {
      jobs = await sql`SELECT * FROM cron_jobs ORDER BY agent_id, created_at DESC`;
    }
    
    // Get recent runs
    let runs;
    if (jobId) {
      runs = await sql`
        SELECT * FROM cron_runs 
        WHERE job_id = ${jobId}
        ORDER BY started_at DESC
        LIMIT 20
      `;
    } else if (agentId) {
      runs = await sql`
        SELECT * FROM cron_runs 
        WHERE agent_id = ${agentId} AND started_at > NOW() - INTERVAL '24 hours'
        ORDER BY started_at DESC
        LIMIT 50
      `;
    } else {
      runs = await sql`
        SELECT * FROM cron_runs 
        WHERE started_at > NOW() - INTERVAL '24 hours'
        ORDER BY started_at DESC
        LIMIT 100
      `;
    }
    
    return NextResponse.json({ success: true, jobs, runs });
  } catch (error) {
    console.error('Get crons error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crons
 * Create a new cron job or trigger an existing one
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobId, agentId, name, schedule, prompt } = body;
    
    // Trigger existing job
    if (action === 'trigger' && jobId) {
      const jobs = await sql`SELECT * FROM cron_jobs WHERE job_id = ${jobId}`;
      const job = jobs[0];
      
      if (!job) {
        return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
      }
      
      const agentUrl = AGENT_URLS[job.agent_id];
      if (!agentUrl) {
        return NextResponse.json({ success: false, error: 'Unknown agent' }, { status: 400 });
      }
      
      // Create run record
      const startTime = Date.now();
      const runResult = await sql`
        INSERT INTO cron_runs (job_id, agent_id, status)
        VALUES (${jobId}, ${job.agent_id}, 'running')
        RETURNING id
      `;
      const runId = runResult[0]?.id;
      
      // Log activity
      await sql`
        INSERT INTO agent_activity (agent_id, event_type, direction, content, metadata)
        VALUES (${job.agent_id}, 'cron', 'outbound', ${job.prompt}, ${JSON.stringify({ job_id: jobId, job_name: job.name })})
      `;
      
      try {
        const response = await fetch(`${agentUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GATEWAY_TOKEN || 'spark-studio-2026'}`,
          },
          body: JSON.stringify({
            model: 'anthropic/claude-sonnet-4-20250514',
            messages: [{ role: 'user', content: job.prompt }],
          }),
        });
        
        const data = await response.json();
        const durationMs = Date.now() - startTime;
        const responseText = data.choices?.[0]?.message?.content || JSON.stringify(data);
        
        // Update run and job
        await sql`
          UPDATE cron_runs 
          SET status = 'completed', response = ${responseText}, duration_ms = ${durationMs}, completed_at = NOW()
          WHERE id = ${runId}
        `;
        
        await sql`
          UPDATE cron_jobs SET last_run_at = NOW() WHERE job_id = ${jobId}
        `;
        
        // Log response
        await sql`
          INSERT INTO agent_activity (agent_id, event_type, direction, content, metadata)
          VALUES (${job.agent_id}, 'cron_response', 'inbound', ${responseText}, ${JSON.stringify({ job_id: jobId, duration_ms: durationMs })})
        `;
        
        return NextResponse.json({
          success: true,
          runId,
          jobId,
          response: responseText,
          durationMs,
        });
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        const durationMs = Date.now() - startTime;
        
        await sql`
          UPDATE cron_runs 
          SET status = 'failed', error = ${errorMsg}, duration_ms = ${durationMs}, completed_at = NOW()
          WHERE id = ${runId}
        `;
        
        return NextResponse.json({
          success: false,
          runId,
          jobId,
          error: errorMsg,
          durationMs,
        });
      }
    }
    
    // Create new job
    if (!agentId || !schedule || !prompt) {
      return NextResponse.json(
        { success: false, error: 'agentId, schedule, and prompt required' },
        { status: 400 }
      );
    }
    
    const newJobId = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    await sql`
      INSERT INTO cron_jobs (job_id, agent_id, name, schedule, prompt)
      VALUES (${newJobId}, ${agentId}, ${name || 'Unnamed Job'}, ${schedule}, ${prompt})
    `;
    
    return NextResponse.json({
      success: true,
      jobId: newJobId,
      agentId,
      schedule,
    });
  } catch (error) {
    console.error('Create/trigger cron error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/crons
 * Update a cron job
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, name, schedule, prompt, enabled } = body;
    
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'jobId required' }, { status: 400 });
    }
    
    await sql`
      UPDATE cron_jobs 
      SET 
        name = COALESCE(${name}, name),
        schedule = COALESCE(${schedule}, schedule),
        prompt = COALESCE(${prompt}, prompt),
        enabled = COALESCE(${enabled}, enabled),
        updated_at = NOW()
      WHERE job_id = ${jobId}
    `;
    
    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    console.error('Update cron error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/crons
 * Delete a cron job
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'jobId required' }, { status: 400 });
    }
    
    await sql`DELETE FROM cron_runs WHERE job_id = ${jobId}`;
    await sql`DELETE FROM cron_jobs WHERE job_id = ${jobId}`;
    
    return NextResponse.json({ success: true, jobId, deleted: true });
  } catch (error) {
    console.error('Delete cron error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
