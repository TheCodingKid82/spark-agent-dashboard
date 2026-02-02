"use client";

import { useState, useEffect } from "react";
import { 
  ActivityFeed, 
  TaskBoardKanban, 
  TaskDetailView,
  DocumentPanel, 
  NotificationBell 
} from "@/components/mission-control";
import { AgentIcon } from "@/lib/icons";
import { 
  Zap, 
  LayoutGrid, 
  FileText, 
  Bell,
  Users,
  Plus,
  Search,
  Settings
} from "lucide-react";

// Agent from roster
interface Agent {
  id: string;
  name: string;
  role: string;
  emoji?: string;
  status?: string;
  reports_to?: string;
  level?: string;
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeTab, setActiveTab] = useState<'board' | 'activity' | 'documents'>('board');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load agents from roster
  useEffect(() => {
    async function loadAgents() {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
        }
      } catch (error) {
        console.error('Failed to load agents:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAgents();
  }, []);

  return (
    <div className="h-screen flex bg-zinc-950 grid-bg">
      {/* Sidebar */}
      <aside className="w-60 bg-zinc-950/60 backdrop-blur-xl border-r border-zinc-800/70 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-zinc-800/70">
          <h1 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 tracking-wide">
            <Zap className="w-4 h-4 text-indigo-300" />
            Mission Control
          </h1>
          <p className="text-xs text-zinc-500 mt-1">Spark Studio ops console</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setActiveTab('board')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
              activeTab === 'board'
                ? 'bg-indigo-600/20 text-zinc-100 border-indigo-500/20'
                : 'text-zinc-400 border-transparent hover:bg-zinc-900/60 hover:border-zinc-800/80'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Task Board
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
              activeTab === 'activity'
                ? 'bg-indigo-600/20 text-zinc-100 border-indigo-500/20'
                : 'text-zinc-400 border-transparent hover:bg-zinc-900/60 hover:border-zinc-800/80'
            }`}
          >
            <Zap className="w-4 h-4" />
            Activity Feed
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
              activeTab === 'documents'
                ? 'bg-indigo-600/20 text-zinc-100 border-indigo-500/20'
                : 'text-zinc-400 border-transparent hover:bg-zinc-900/60 hover:border-zinc-800/80'
            }`}
          >
            <FileText className="w-4 h-4" />
            Documents
          </button>
        </nav>

        {/* Agents List */}
        <div className="p-3 border-t border-zinc-800/70">
          <h3 className="text-xs font-medium text-zinc-500 uppercase mb-2 flex items-center gap-2 tracking-wider">
            <Users className="w-3 h-3" />
            Agents
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-zinc-600">Loading...</p>
            ) : agents.map(agent => (
              <div 
                key={agent.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer"
              >
                <AgentIcon agentId={agent.id} size={24} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{agent.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{agent.role}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  agent.status === 'online' ? 'bg-green-400' : 'bg-zinc-600'
                }`} />
              </div>
            ))}
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
                placeholder="Search…"
                className="bg-zinc-950/40 border border-zinc-800 rounded-lg pl-10 pr-4 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button className="p-2 hover:bg-zinc-800 rounded-lg">
              <Settings className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'board' && (
            <TaskBoardKanban 
              onTaskSelect={(taskId) => setSelectedTaskId(taskId)}
            />
          )}
          {activeTab === 'activity' && (
            <div className="h-full p-4">
              <div className="h-full bg-zinc-950/40 rounded-xl border border-zinc-800/70 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/70">
                  <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-300" />
                    Activity
                  </h2>
                </div>
                <ActivityFeed />
              </div>
            </div>
          )}
          {activeTab === 'documents' && (
            <div className="h-full p-4">
              <div className="h-full bg-zinc-950/40 rounded-xl border border-zinc-800/70 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/70">
                  <h2 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-300" />
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
          onStatusChange={() => {/* Refresh board */}}
        />
      )}
    </div>
  );
}
