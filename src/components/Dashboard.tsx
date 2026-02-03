"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  ActivityFeed, 
  TaskBoardKanban, 
  TaskDetailView,
  DocumentPanel, 
  NotificationBell 
} from "@/components/mission-control";
import { AgentChatModal } from "@/components/AgentChatModal";
import { AgentIcon } from "@/lib/icons";
import { 
  Zap, 
  LayoutGrid, 
  FileText, 
  Users,
  Search,
  Settings,
  MessageCircle,
  RefreshCw
} from "lucide-react";
import { calculateAgentStatuses, AgentRunStatus } from "@/lib/agent-schedule";

interface Agent {
  id: string;
  name: string;
  role: string;
  emoji?: string;
  sessionKey: string;
  heartbeatCron?: string;
  status?: "online" | "offline" | "checking";
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeTab, setActiveTab] = useState<"board" | "activity" | "documents">("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [tick, setTick] = useState(0); // For refreshing schedule status

  // Refresh schedule status every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Calculate agent run statuses based on cron schedules
  const scheduleStatuses = useMemo(() => {
    return calculateAgentStatuses(agents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, tick]);

  // Load agents from roster
  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        const agentList = (data.agents || []).map((a: any) => ({
          id: a.agentId || a.id,
          name: a.agentName || a.name,
          role: a.agentRole || a.role,
          emoji: a.emoji,
          sessionKey: a.sessionKey,
          heartbeatCron: a.heartbeatCron,
          status: "checking" as const,
        }));
        setAgents(agentList);
        
        // Check status for each agent
        agentList.forEach((agent: Agent) => checkAgentStatus(agent.id));
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    } finally {
      setLoading(false);
    }
  }

  async function checkAgentStatus(agentId: string) {
    try {
      const res = await fetch(`/api/agents/${agentId}/status`);
      if (res.ok) {
        const data = await res.json();
        setAgents((prev) =>
          prev.map((a) =>
            a.id === agentId ? { ...a, status: data.status || "offline" } : a
          )
        );
      }
    } catch {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status: "offline" } : a))
      );
    }
  }

  async function refreshAllStatus() {
    setRefreshingStatus(true);
    await Promise.all(agents.map((a) => checkAgentStatus(a.id)));
    setRefreshingStatus(false);
  }

  const onlineCount = agents.filter((a) => a.status === "online").length;

  return (
    <div className="h-screen flex bg-zinc-950 grid-bg">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-950/60 backdrop-blur-xl border-r border-zinc-800/70 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-zinc-800/70">
          <h1 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 tracking-wide">
            <Zap className="w-4 h-4 text-indigo-400" />
            Mission Control
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Spark Studio Command Center</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setActiveTab("board")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
              activeTab === "board"
                ? "bg-indigo-600/20 text-zinc-100 border-indigo-500/20"
                : "text-zinc-400 border-transparent hover:bg-zinc-900/60 hover:border-zinc-800/80"
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Task Board
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
              activeTab === "activity"
                ? "bg-indigo-600/20 text-zinc-100 border-indigo-500/20"
                : "text-zinc-400 border-transparent hover:bg-zinc-900/60 hover:border-zinc-800/80"
            }`}
          >
            <Zap className="w-4 h-4" />
            Activity Feed
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
              activeTab === "documents"
                ? "bg-indigo-600/20 text-zinc-100 border-indigo-500/20"
                : "text-zinc-400 border-transparent hover:bg-zinc-900/60 hover:border-zinc-800/80"
            }`}
          >
            <FileText className="w-4 h-4" />
            Documents
          </button>
        </nav>

        {/* Agents List */}
        <div className="p-3 border-t border-zinc-800/70">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-zinc-500 uppercase flex items-center gap-2 tracking-wider">
              <Users className="w-3 h-3" />
              Agents
              {onlineCount > 0 && (
                <span className="text-emerald-400">({onlineCount} online)</span>
              )}
            </h3>
            <button
              onClick={refreshAllStatus}
              disabled={refreshingStatus}
              className="p-1 hover:bg-zinc-800 rounded transition-colors"
              title="Refresh status"
            >
              <RefreshCw
                className={`w-3 h-3 text-zinc-500 ${refreshingStatus ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400" />
              </div>
            ) : (
              agents.map((agent) => {
                const schedule = scheduleStatuses.get(agent.id);
                const isRunning = schedule?.isRunning ?? false;
                const isNext = schedule?.isNext ?? false;
                
                return (
                  <div key={agent.id} className="relative group/agent">
                    <button
                      onClick={() => setSelectedAgent(agent)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-800/70 transition-colors group"
                    >
                      <div className="relative">
                        <AgentIcon agentId={agent.id} size={28} />
                        {/* Schedule indicator (green=running, yellow=next) */}
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 transition-colors ${
                            isRunning
                              ? "bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"
                              : isNext
                              ? "bg-amber-400"
                              : "bg-zinc-600"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm text-zinc-200 truncate">{agent.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{agent.role}</p>
                      </div>
                      <MessageCircle className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    
                    {/* Tooltip for next agent */}
                    {isNext && schedule && (
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover/agent:opacity-100 pointer-events-none transition-opacity">
                        <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                          <p className="text-xs text-amber-400 font-medium">Next up</p>
                          <p className="text-xs text-zinc-300">
                            {schedule.formattedTime} ({schedule.timeUntil})
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Tooltip for running agent */}
                    {isRunning && (
                      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover/agent:opacity-100 pointer-events-none transition-opacity">
                        <div className="bg-zinc-800 border border-emerald-700/50 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                          <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Running now
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 bg-zinc-950/60 backdrop-blur-xl border-b border-zinc-800/70 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search tasks, docs, agents…"
                className="bg-zinc-950/40 border border-zinc-800 rounded-lg pl-10 pr-4 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "board" && (
            <TaskBoardKanban
              onTaskSelect={(taskId) => setSelectedTaskId(taskId)}
              selectedTaskId={selectedTaskId}
            />
          )}
          {activeTab === "activity" && (
            <div className="h-full p-4">
              <div className="h-full bg-zinc-950/40 rounded-xl border border-zinc-800/70 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/70">
                  <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-400" />
                    Activity Feed
                  </h2>
                </div>
                <ActivityFeed />
              </div>
            </div>
          )}
          {activeTab === "documents" && (
            <div className="h-full p-4">
              <div className="h-full bg-zinc-950/40 rounded-xl border border-zinc-800/70 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/70">
                  <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Documents
                  </h2>
                </div>
                <DocumentPanel />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailView
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onStatusChange={() => {
            /* Board auto-refreshes via Convex */
          }}
        />
      )}

      {/* Agent Chat Modal */}
      {selectedAgent && (
        <AgentChatModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
