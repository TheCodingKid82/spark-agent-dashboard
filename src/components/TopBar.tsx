"use client";

import React from "react";
import {
  Activity,
  Zap,
  TrendingUp,
  Users,
  Plus,
  MessageSquare,
  Calendar,
} from "lucide-react";
import type { Agent } from "@/types/agent";

interface TopBarProps {
  agents: Agent[];
  onAddAgent: () => void;
  onOpenChat: () => void;
  onOpenMeetings: () => void;
  unreadCount: number;
}

export default function TopBar({
  agents,
  onAddAgent,
  onOpenChat,
  onOpenMeetings,
  unreadCount,
}: TopBarProps) {
  const onlineCount = agents.filter((a) => a.status === "online").length;
  const busyCount = agents.filter((a) => a.status === "busy").length;
  const totalTasks = agents.reduce(
    (acc, a) => acc + a.metrics.tasksCompleted,
    0
  );

  return (
    <header className="h-14 bg-[#0e0e15]/90 backdrop-blur-xl border-b border-zinc-800/50 flex items-center justify-between px-5 z-50 relative">
      {/* Left: Brand */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100 leading-tight tracking-tight">
              Spark Studio
            </h1>
            <p className="text-[10px] text-zinc-500 leading-tight font-medium tracking-wide uppercase">
              Agent Command Center
            </p>
          </div>
        </div>

        {/* Mission */}
        <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <TrendingUp className="w-3 h-3 text-indigo-400" />
          <span className="text-xs font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            $100k MRR → Billions
          </span>
        </div>
      </div>

      {/* Right: Metrics + Actions */}
      <div className="flex items-center gap-3">
        {/* Quick metrics */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50">
              <Users className="w-3 h-3 text-zinc-400" />
              <span className="text-zinc-300 font-medium">{agents.length}</span>
              <span className="text-zinc-600">agents</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/5 border border-green-500/20">
              <Activity className="w-3 h-3 text-green-400" />
              <span className="text-green-400 font-medium">{onlineCount}</span>
              <span className="text-zinc-600">online</span>
            </div>
          </div>

          {busyCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/5 border border-amber-500/20">
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="text-amber-400 font-medium">{busyCount}</span>
                <span className="text-zinc-600">busy</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/50 border border-zinc-700/50">
              <TrendingUp className="w-3 h-3 text-indigo-400" />
              <span className="text-zinc-300 font-medium">{totalTasks}</span>
              <span className="text-zinc-600">tasks</span>
            </div>
          </div>
        </div>

        {/* Chat button */}
        <button
          onClick={onOpenChat}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 hover:border-zinc-600/50 text-zinc-300 text-xs font-medium transition-all duration-200 active:scale-95"
        >
          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Chat</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-lg shadow-indigo-500/30">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Meetings button */}
        <button
          onClick={onOpenMeetings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 hover:border-zinc-600/50 text-zinc-300 text-xs font-medium transition-all duration-200 active:scale-95"
        >
          <Calendar className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Meetings</span>
        </button>

        {/* Add agent button */}
        <button
          onClick={onAddAgent}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Agent</span>
        </button>
      </div>
    </header>
  );
}
