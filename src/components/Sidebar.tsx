"use client";

import React, { useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Circle,
  Zap,
  Shield,
  LayoutGrid,
} from "lucide-react";
import type { Agent, AgentStatus } from "@/types/agent";

interface SidebarProps {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

const statusIcons: Record<AgentStatus, React.ReactNode> = {
  online: <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500" />,
  offline: <Circle className="w-2.5 h-2.5 fill-zinc-500 text-zinc-500" />,
  busy: <Zap className="w-2.5 h-2.5 text-amber-400" />,
};

type FilterType = "all" | AgentStatus;

export default function Sidebar({
  agents,
  selectedAgentId,
  onSelectAgent,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [collapsed, setCollapsed] = useState(false);

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.role.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || agent.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (collapsed) {
    return (
      <div className="w-14 bg-[#0e0e15]/90 backdrop-blur-xl border-r border-zinc-800/50 flex flex-col items-center py-3 gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="w-9 h-9 rounded-lg bg-zinc-800/50 flex items-center justify-center hover:bg-zinc-700/50 transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="w-8 h-px bg-zinc-800 my-1" />
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={`
              relative w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all duration-200
              ${selectedAgentId === agent.id
                ? "bg-indigo-500/20 ring-1 ring-indigo-500/40"
                : "hover:bg-zinc-800/50"
              }
            `}
            title={`${agent.name} — ${agent.role}`}
          >
            {agent.emoji}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0e0e15]
                ${agent.status === "online" ? "bg-green-500" : ""}
                ${agent.status === "offline" ? "bg-zinc-500" : ""}
                ${agent.status === "busy" ? "bg-amber-500" : ""}
              `}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="w-64 bg-[#0e0e15]/90 backdrop-blur-xl border-r border-zinc-800/50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Agents
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
              {agents.length}
            </span>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-800 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 rotate-90" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1 mt-2">
          {(["all", "online", "busy", "offline"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                flex-1 px-2 py-1 rounded-md text-[10px] font-medium capitalize transition-all duration-200
                ${filter === f
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50 border border-transparent"
                }
              `}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredAgents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={`
              w-full px-3 py-2.5 flex items-center gap-3 transition-all duration-200 group
              ${selectedAgentId === agent.id
                ? "bg-indigo-500/10 border-r-2 border-indigo-500"
                : "hover:bg-zinc-800/30 border-r-2 border-transparent"
              }
            `}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div
                className={`
                  w-9 h-9 rounded-lg flex items-center justify-center text-lg
                  ${selectedAgentId === agent.id ? "bg-indigo-500/20" : "bg-zinc-800/80"}
                  border border-zinc-700/50 transition-colors
                `}
              >
                {agent.emoji}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5">
                {statusIcons[agent.status]}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xs font-semibold truncate ${
                    selectedAgentId === agent.id ? "text-indigo-300" : "text-zinc-200"
                  }`}
                >
                  {agent.name}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">{agent.role}</p>
            </div>

            {/* Task count */}
            <div className="flex-shrink-0 text-right">
              <span className="text-[10px] text-zinc-600 font-mono">
                {agent.metrics.tasksCompleted}
              </span>
            </div>
          </button>
        ))}

        {filteredAgents.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Shield className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-600">No agents found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800/50">
        <div className="flex items-center justify-between text-[10px] text-zinc-600">
          <span>System Status</span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-green-500">All Systems Operational</span>
          </div>
        </div>
      </div>
    </div>
  );
}
