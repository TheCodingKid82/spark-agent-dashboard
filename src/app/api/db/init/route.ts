import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * POST /api/db/init
 * Initialize database tables for activity logs, heartbeats, and crons
 */
export async function POST() {
  try {
    // Agent Activity Logs - real-time stream of agent actions
    await query(`
      CREATE TABLE IF NOT EXISTS agent_activity (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(50) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        event_type VARCHAR(50) NOT NULL,
        direction VARCHAR(10),
        content TEXT,
        metadata JSONB DEFAULT '{}',
        session_id VARCHAR(100)
      )
    `);
    
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity(agent_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON agent_activity(timestamp DESC)`);

    // Heartbeat Configurations - centralized heartbeat settings
    await query(`
      CREATE TABLE IF NOT EXISTS heartbeat_configs (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(50) UNIQUE NOT NULL,
        enabled BOOLEAN DEFAULT true,
        interval_minutes INT DEFAULT 30,
        prompt TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Heartbeat Runs - execution history
    await query(`
      CREATE TABLE IF NOT EXISTS heartbeat_runs (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(50) NOT NULL,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'running',
        response TEXT,
        duration_ms INT,
        error TEXT
      )
    `);
    
    await query(`CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_agent ON heartbeat_runs(agent_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_heartbeat_runs_started ON heartbeat_runs(started_at DESC)`);

    // Cron Jobs - centralized cron management
    await query(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(100) UNIQUE NOT NULL,
        agent_id VARCHAR(50) NOT NULL,
        name VARCHAR(200),
        schedule VARCHAR(100) NOT NULL,
        prompt TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ
      )
    `);
    
    await query(`CREATE INDEX IF NOT EXISTS idx_cron_jobs_agent ON cron_jobs(agent_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at)`);

    // Cron Runs - execution history
    await query(`
      CREATE TABLE IF NOT EXISTS cron_runs (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(100) NOT NULL,
        agent_id VARCHAR(50) NOT NULL,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        status VARCHAR(20) DEFAULT 'running',
        response TEXT,
        duration_ms INT,
        error TEXT
      )
    `);
    
    await query(`CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cron_runs_started ON cron_runs(started_at DESC)`);

    // Insert default heartbeat configs for all agents
    const agents = ['atlas', 'apollo', 'artemis', 'maia', 'orpheus', 'callisto', 'iris'];
    for (const agentId of agents) {
      await query(`
        INSERT INTO heartbeat_configs (agent_id, enabled, interval_minutes, prompt)
        VALUES ($1, true, 30, 'Check your HEARTBEAT.md and ACTIVE_PLAN.md. Report any updates or issues.')
        ON CONFLICT (agent_id) DO NOTHING
      `, [agentId]);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Database tables initialized',
      tables: ['agent_activity', 'heartbeat_configs', 'heartbeat_runs', 'cron_jobs', 'cron_runs']
    });
  } catch (error) {
    console.error('DB init error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
