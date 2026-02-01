'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  ArrowsClockwise,
  CaretDown,
  ArrowUp,
  ArrowDown,
  Lightning,
  Clock,
  Warning,
  CheckCircle,
  Pulse,
  Funnel,
} from '@phosphor-icons/react';
import { AgentIcon } from '@/lib/icons';

interface ActivityLog {
  id: number;
  agent_id: string;
  timestamp: string;
  event_type: string;
  direction: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
  session_id: string | null;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  heartbeat: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: <Pulse className="w-3 h-3" /> },
  heartbeat_response: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: <Pulse className="w-3 h-3" /> },
  cron: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: <Clock className="w-3 h-3" /> },
  cron_response: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: <Clock className="w-3 h-3" /> },
  message: { bg: 'bg-zinc-800/50', text: 'text-zinc-400', icon: <Lightning className="w-3 h-3" /> },
  tool_call: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: <Lightning className="w-3 h-3" /> },
  error: { bg: 'bg-red-500/10', text: 'text-red-400', icon: <Warning className="w-3 h-3" /> },
  default: { bg: 'bg-zinc-800/50', text: 'text-zinc-400', icon: <Activity className="w-3 h-3" /> },
};

export function ActivityPanel() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [expanded, setExpanded] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      let url = '/api/activity/logs?limit=200';
      if (filterAgent !== 'all') url += `&agentId=${filterAgent}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        let filteredLogs = data.logs;
        if (filterType !== 'all') {
          filteredLogs = filteredLogs.filter((l: ActivityLog) => l.event_type === filterType);
        }
        setLogs(filteredLogs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, filterAgent, filterType]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const agents = ['atlas', 'apollo', 'artemis', 'maia', 'orpheus', 'callisto', 'iris'];
  const eventTypes = ['heartbeat', 'heartbeat_response', 'cron', 'cron_response', 'message', 'tool_call', 'error'];

  return (
    <div className="h-full flex flex-col bg-zinc-900/50 rounded-xl border border-zinc-800/50">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-400" />
            Agent Activity
            {autoRefresh && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                autoRefresh 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={fetchLogs}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <ArrowsClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Funnel className="w-3 h-3 text-zinc-500" />
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Agents</option>
              {agents.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
          >
            <option value="all">All Events</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="text-zinc-500 ml-auto">
            {logs.length} events
          </span>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {logs.length === 0 && !loading && (
          <div className="text-center text-zinc-500 py-8">
            No activity logs yet. Run a heartbeat or cron to see activity.
          </div>
        )}
        
        {logs.map(log => {
          const eventStyle = EVENT_COLORS[log.event_type] || EVENT_COLORS.default;
          const isExpanded = expanded === log.id;
          
          return (
            <div
              key={log.id}
              className={`${eventStyle.bg} rounded-lg border border-zinc-800/30 transition-all`}
            >
              <button
                onClick={() => setExpanded(isExpanded ? null : log.id)}
                className="w-full p-2 flex items-start gap-2 text-left"
              >
                <div className="shrink-0 mt-0.5">
                  <AgentIcon agentId={log.agent_id} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium capitalize">{log.agent_id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${eventStyle.bg} ${eventStyle.text}`}>
                      {eventStyle.icon}
                      {log.event_type}
                    </span>
                    {log.direction && (
                      <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                        {log.direction === 'inbound' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                        {log.direction}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">
                    {log.content?.slice(0, 100)}{log.content && log.content.length > 100 ? '...' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-zinc-500">{formatTime(log.timestamp)}</p>
                  <p className="text-[10px] text-zinc-600">{formatDate(log.timestamp)}</p>
                </div>
                <CaretDown className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              {isExpanded && log.content && (
                <div className="px-3 pb-3 pt-1 border-t border-zinc-800/30">
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-900/50 rounded p-2 max-h-60 overflow-y-auto">
                    {log.content}
                  </pre>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-2 text-[10px] text-zinc-500">
                      Metadata: {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
