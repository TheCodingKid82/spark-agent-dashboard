'use client';

import { useState, useEffect } from 'react';
import {
  Timer,
  ArrowsClockwise,
  Play,
  Plus,
  Trash,
  Pencil,
  CheckCircle,
  XCircle,
  Clock,
} from '@phosphor-icons/react';
import { AgentIcon } from '@/lib/icons';

interface CronJob {
  id: number;
  job_id: string;
  agent_id: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  created_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
}

interface CronRun {
  id: number;
  job_id: string;
  agent_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  response: string | null;
  duration_ms: number | null;
  error: string | null;
}

const AGENTS = ['atlas', 'apollo', 'artemis', 'maia', 'orpheus', 'callisto', 'iris'];

export function CronsPanel() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  
  // Create form
  const [newAgent, setNewAgent] = useState('atlas');
  const [newName, setNewName] = useState('');
  const [newSchedule, setNewSchedule] = useState('0 */6 * * *');
  const [newPrompt, setNewPrompt] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/crons');
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
        setRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Failed to fetch crons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const triggerJob = async (jobId: string) => {
    setTriggeringJob(jobId);
    try {
      await fetch('/api/crons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', jobId }),
      });
      fetchData();
    } catch (error) {
      console.error('Trigger failed:', error);
    } finally {
      setTriggeringJob(null);
    }
  };

  const toggleEnabled = async (jobId: string, enabled: boolean) => {
    try {
      await fetch('/api/crons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, enabled }),
      });
      fetchData();
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Delete this cron job?')) return;
    try {
      await fetch(`/api/crons?jobId=${jobId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const createJob = async () => {
    if (!newPrompt.trim()) return;
    try {
      await fetch('/api/crons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: newAgent,
          name: newName || 'Unnamed Job',
          schedule: newSchedule,
          prompt: newPrompt,
        }),
      });
      setShowCreate(false);
      setNewName('');
      setNewPrompt('');
      fetchData();
    } catch (error) {
      console.error('Create failed:', error);
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const getJobRuns = (jobId: string) => {
    return runs.filter(r => r.job_id === jobId).slice(0, 5);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900/50 rounded-xl border border-zinc-800/50">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Timer className="w-5 h-5 text-purple-400" />
            Cron Jobs
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Job
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <ArrowsClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Create Form */}
        {showCreate && (
          <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Agent</label>
                <select
                  value={newAgent}
                  onChange={(e) => setNewAgent(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"
                >
                  {AGENTS.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Daily report"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Schedule (cron syntax)</label>
              <input
                type="text"
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                placeholder="0 */6 * * *"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm font-mono"
              />
              <p className="text-[10px] text-zinc-600 mt-1">
                Examples: 0 9 * * * (9am daily), */30 * * * * (every 30min), 0 0 * * 1 (Monday midnight)
              </p>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Prompt</label>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="What should the agent do?"
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={createJob}
                disabled={!newPrompt.trim()}
                className="px-3 py-1.5 rounded bg-purple-500/20 text-purple-400 text-xs font-medium disabled:opacity-50"
              >
                Create Job
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {jobs.length === 0 && !loading && (
          <div className="text-center text-zinc-500 py-8">
            No cron jobs yet. Create one to schedule recurring tasks.
          </div>
        )}
        
        {jobs.map(job => {
          const jobRuns = getJobRuns(job.job_id);
          const latestRun = jobRuns[0];
          const isRunning = latestRun?.status === 'running';
          
          return (
            <div
              key={job.job_id}
              className={`rounded-lg border transition-colors ${
                job.enabled 
                  ? 'bg-zinc-800/30 border-zinc-700/50' 
                  : 'bg-zinc-900/50 border-zinc-800/30 opacity-60'
              }`}
            >
              <div className="p-3">
                <div className="flex items-center gap-3">
                  <AgentIcon agentId={job.agent_id} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{job.name}</span>
                      <span className="text-xs text-zinc-500 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
                        {job.schedule}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      {job.prompt.slice(0, 60)}{job.prompt.length > 60 ? '...' : ''}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerJob(job.job_id)}
                      disabled={triggeringJob === job.job_id || isRunning}
                      className="p-1.5 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 disabled:opacity-50"
                    >
                      {triggeringJob === job.job_id || isRunning ? (
                        <ArrowsClockwise className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteJob(job.job_id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleEnabled(job.job_id, !job.enabled)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        job.enabled ? 'bg-purple-500' : 'bg-zinc-600'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        job.enabled ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
                
                {/* Run History */}
                {jobRuns.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-zinc-700/30">
                    <div className="flex gap-1">
                      {jobRuns.map(run => (
                        <div
                          key={run.id}
                          title={`${run.status} at ${formatTime(run.started_at)}`}
                          className={`w-6 h-6 rounded flex items-center justify-center ${
                            run.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {run.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                          {run.status === 'failed' && <XCircle className="w-3 h-3" />}
                          {run.status === 'running' && <ArrowsClockwise className="w-3 h-3 animate-spin" />}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Last: {formatTime(job.last_run_at)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="p-3 border-t border-zinc-800/50 bg-zinc-900/30">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">
            {jobs.filter(j => j.enabled).length}/{jobs.length} jobs enabled
          </span>
          <span className="text-zinc-500">
            {runs.filter(r => r.status === 'completed').length} runs (24h)
          </span>
        </div>
      </div>
    </div>
  );
}
