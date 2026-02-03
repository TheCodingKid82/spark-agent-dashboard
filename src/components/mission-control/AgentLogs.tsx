"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal, RefreshCw, Filter, ChevronDown } from "lucide-react";

interface LogEntry {
  agentId: string;
  sessionKey: string;
  timestamp: string;
  role: string;
  content: string;
}

const AGENT_COLORS: Record<string, string> = {
  atlas: "text-blue-400",
  maia: "text-purple-400",
  apollo: "text-yellow-400",
  orpheus: "text-green-400",
  artemis: "text-pink-400",
  callisto: "text-cyan-400",
  iris: "text-indigo-400",
  henry: "text-emerald-400",
};

const AGENT_EMOJI: Record<string, string> = {
  atlas: "🗺️",
  maia: "⭐",
  apollo: "☀️",
  orpheus: "🎵",
  artemis: "🏹",
  callisto: "🐻",
  iris: "🌈",
  henry: "🤝",
};

export function AgentLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  async function fetchLogs() {
    try {
      const url = filterAgent 
        ? `/api/agents/logs?agentId=${filterAgent}&limit=100`
        : `/api/agents/logs?limit=100`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
    
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, filterAgent]);

  function formatTimestamp(ts: string) {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatContent(content: string) {
    // Truncate very long content
    if (content.length > 500) {
      return content.slice(0, 500) + "...";
    }
    return content;
  }

  const agents = ["atlas", "maia", "apollo", "orpheus", "artemis", "callisto", "iris"];

  return (
    <div className="h-full flex flex-col bg-zinc-950 rounded-xl border border-zinc-800/70">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/70">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-zinc-100">Agent Logs</h2>
          {loading && (
            <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              <Filter className="w-4 h-4" />
              {filterAgent ? (
                <span>{AGENT_EMOJI[filterAgent]} {filterAgent}</span>
              ) : (
                <span>All agents</span>
              )}
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showFilters && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10">
                <button
                  onClick={() => { setFilterAgent(null); setShowFilters(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 ${!filterAgent ? 'text-indigo-400' : 'text-zinc-300'}`}
                >
                  All agents
                </button>
                {agents.map(agent => (
                  <button
                    key={agent}
                    onClick={() => { setFilterAgent(agent); setShowFilters(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 ${filterAgent === agent ? 'text-indigo-400' : 'text-zinc-300'}`}
                  >
                    {AGENT_EMOJI[agent]} {agent}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              autoRefresh 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {autoRefresh ? "Live" : "Paused"}
          </button>
          
          {/* Manual refresh */}
          <button
            onClick={() => { setLoading(true); fetchLogs(); }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs area */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1">
        {logs.length === 0 && !loading && (
          <div className="text-zinc-500 text-center py-8">
            No logs yet. Run an agent to see activity.
          </div>
        )}
        
        {logs.map((log, idx) => (
          <div 
            key={`${log.timestamp}-${idx}`}
            className="flex gap-2 py-1 hover:bg-zinc-900/50 px-2 -mx-2 rounded"
          >
            <span className="text-zinc-600 shrink-0">
              {formatTimestamp(log.timestamp)}
            </span>
            <span className={`shrink-0 ${AGENT_COLORS[log.agentId] || 'text-zinc-400'}`}>
              {AGENT_EMOJI[log.agentId] || "🤖"} {log.agentId}
            </span>
            <span className="text-zinc-600 shrink-0">
              [{log.role}]
            </span>
            <span className="text-zinc-300 break-words">
              {formatContent(log.content)}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
