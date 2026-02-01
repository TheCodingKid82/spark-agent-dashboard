'use client';

import { useState, useEffect } from 'react';
import {
  Heartbeat,
  ArrowsClockwise,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Pencil,
} from '@phosphor-icons/react';
import { AgentIcon } from '@/lib/icons';

interface HeartbeatConfig {
  id: number;
  agent_id: string;
  enabled: boolean;
  interval_minutes: number;
  prompt: string;
  created_at: string;
  updated_at: string;
}

interface HeartbeatRun {
  id: number;
  agent_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  response: string | null;
  duration_ms: number | null;
  error: string | null;
}

export function HeartbeatsPanel() {
  const [configs, setConfigs] = useState<HeartbeatConfig[]>([]);
  const [runs, setRuns] = useState<HeartbeatRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringAgent, setTriggeringAgent] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editInterval, setEditInterval] = useState(30);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/heartbeats');
      const data = await res.json();
      if (data.success) {
        setConfigs(data.configs || []);
        setRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Failed to fetch heartbeats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerHeartbeat = async (agentId: string) => {
    setTriggeringAgent(agentId);
    try {
      await fetch('/api/heartbeats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      fetchData();
    } catch (error) {
      console.error('Trigger failed:', error);
    } finally {
      setTriggeringAgent(null);
    }
  };

  const toggleEnabled = async (agentId: string, enabled: boolean) => {
    try {
      await fetch('/api/heartbeats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, enabled }),
      });
      fetchData();
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };

  const saveConfig = async (agentId: string) => {
    try {
      await fetch('/api/heartbeats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agentId, 
          prompt: editPrompt,
          intervalMinutes: editInterval,
        }),
      });
      setEditingAgent(null);
      fetchData();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getLastRun = (agentId: string) => {
    return runs.find(r => r.agent_id === agentId);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900/50 rounded-xl border border-zinc-800/50">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Heartbeat className="w-5 h-5 text-red-400" />
            Heartbeat Manager
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await fetch('/api/heartbeats/scheduler', { method: 'POST' });
                fetchData();
              }}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors"
            >
              Run All Due
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <ArrowsClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {configs.map(config => {
          const lastRun = getLastRun(config.agent_id);
          const isEditing = editingAgent === config.agent_id;
          const isRunning = lastRun?.status === 'running';
          
          return (
            <div
              key={config.agent_id}
              className={`rounded-lg border transition-colors ${
                config.enabled 
                  ? 'bg-zinc-800/30 border-zinc-700/50' 
                  : 'bg-zinc-900/50 border-zinc-800/30 opacity-60'
              }`}
            >
              <div className="p-3">
                <div className="flex items-center gap-3">
                  <AgentIcon agentId={config.agent_id} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{config.agent_id}</span>
                      <span className="text-xs text-zinc-500">
                        every {config.interval_minutes}m
                      </span>
                    </div>
                    {lastRun && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {lastRun.status === 'completed' && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {formatTime(lastRun.started_at)}
                            {lastRun.duration_ms && (
                              <span className="text-zinc-500">({lastRun.duration_ms}ms)</span>
                            )}
                          </span>
                        )}
                        {lastRun.status === 'failed' && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Failed: {lastRun.error?.slice(0, 50)}
                          </span>
                        )}
                        {lastRun.status === 'running' && (
                          <span className="text-xs text-blue-400 flex items-center gap-1">
                            <ArrowsClockwise className="w-3 h-3 animate-spin" />
                            Running...
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingAgent(null);
                        } else {
                          setEditingAgent(config.agent_id);
                          setEditPrompt(config.prompt);
                          setEditInterval(config.interval_minutes);
                        }
                      }}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => triggerHeartbeat(config.agent_id)}
                      disabled={triggeringAgent === config.agent_id || isRunning}
                      className="p-1.5 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 disabled:opacity-50"
                    >
                      {triggeringAgent === config.agent_id || isRunning ? (
                        <ArrowsClockwise className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => toggleEnabled(config.agent_id, !config.enabled)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        config.enabled ? 'bg-green-500' : 'bg-zinc-600'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        config.enabled ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
                
                {/* Edit Mode */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-zinc-700/50 space-y-2">
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">Interval (minutes)</label>
                      <input
                        type="number"
                        value={editInterval}
                        onChange={(e) => setEditInterval(parseInt(e.target.value) || 30)}
                        className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm"
                        min={5}
                        max={1440}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 block mb-1">Prompt</label>
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm resize-none"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveConfig(config.agent_id)}
                        className="px-3 py-1 rounded bg-green-500/20 text-green-400 text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingAgent(null)}
                        className="px-3 py-1 rounded bg-zinc-700 text-zinc-300 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Last Response Preview */}
              {lastRun?.response && !isEditing && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-zinc-500 truncate">
                    {lastRun.response.slice(0, 150)}{lastRun.response.length > 150 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Runs Summary */}
      <div className="p-3 border-t border-zinc-800/50 bg-zinc-900/30">
        <p className="text-xs text-zinc-500 mb-2">Recent Runs (24h)</p>
        <div className="flex gap-4 text-xs">
          <span className="text-green-400">
            ✓ {runs.filter(r => r.status === 'completed').length} completed
          </span>
          <span className="text-red-400">
            ✗ {runs.filter(r => r.status === 'failed').length} failed
          </span>
          <span className="text-blue-400">
            ◎ {runs.filter(r => r.status === 'running').length} running
          </span>
        </div>
      </div>
    </div>
  );
}
