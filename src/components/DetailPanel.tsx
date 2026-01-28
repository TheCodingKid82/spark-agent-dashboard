"use client";

import React, { useState, useCallback } from "react";
import {
  X,
  Activity,
  MessageSquare,
  BarChart3,
  Clock,
  CheckCircle2,
  Wifi,
  ArrowUpRight,
  ArrowDownLeft,
  Server,
  Mail,
  ShoppingBag,
  Play,
  Square,
  RotateCcw,
  ExternalLink,
  FileText,
  Loader2,
  AlertCircle,
  Shield,
} from "lucide-react";
import type { Agent } from "@/types/agent";

interface DetailPanelProps {
  agent: Agent;
  allAgents: Agent[];
  onClose: () => void;
  onAgentUpdate?: (agent: Agent) => void;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const RAILWAY_STATUS_STYLES: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: "text-zinc-400", bg: "bg-zinc-800/30", border: "border-zinc-700/30", label: "Pending" },
  deploying: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Deploying" },
  running: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", label: "Running" },
  stopped: { color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", label: "Stopped" },
  error: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Error" },
};

export default function DetailPanel({ agent, allAgents, onClose, onAgentUpdate }: DetailPanelProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const infra = agent.infrastructure;
  const hasInfra = !!(infra?.railwayProjectId || infra?.email || infra?.whopUsername);

  const getAgentName = (id: string) => {
    const a = allAgents.find((x) => x.id === id);
    return a ? a.name : id;
  };

  const getAgentEmoji = (id: string) => {
    const a = allAgents.find((x) => x.id === id);
    return a ? a.emoji : "🤖";
  };

  const handleServiceAction = useCallback(
    async (action: "start" | "stop") => {
      setActionLoading(action);
      try {
        const res = await fetch(`/api/agents/${agent.id}/${action}`, { method: "POST" });
        const data = await res.json();

        if (res.ok && onAgentUpdate && infra) {
          const updatedInfra = {
            ...infra,
            railwayStatus: action === "start" ? ("running" as const) : ("stopped" as const),
            lastHealthCheck: new Date().toISOString(),
          };
          onAgentUpdate({ ...agent, infrastructure: updatedInfra });
        }
      } catch (error) {
        console.error(`Failed to ${action} service:`, error);
      } finally {
        setActionLoading(null);
      }
    },
    [agent, infra, onAgentUpdate]
  );

  const handleRestart = useCallback(async () => {
    setActionLoading("restart");
    try {
      await fetch(`/api/agents/${agent.id}/stop`, { method: "POST" });
      await new Promise((r) => setTimeout(r, 1000));
      await fetch(`/api/agents/${agent.id}/start`, { method: "POST" });

      if (onAgentUpdate && infra) {
        const updatedInfra = {
          ...infra,
          railwayStatus: "running" as const,
          lastHealthCheck: new Date().toISOString(),
        };
        onAgentUpdate({ ...agent, infrastructure: updatedInfra });
      }
    } catch (error) {
      console.error("Failed to restart service:", error);
    } finally {
      setActionLoading(null);
    }
  }, [agent, infra, onAgentUpdate]);

  return (
    <div className="w-96 bg-[#0e0e15]/95 backdrop-blur-xl border-l border-zinc-800/50 flex flex-col slide-in-right overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/50 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl border border-zinc-700">
                {agent.emoji}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0e0e15]
                  ${agent.status === "online" ? "bg-green-500 status-pulse" : ""}
                  ${agent.status === "offline" ? "bg-zinc-500" : ""}
                  ${agent.status === "busy" ? "bg-amber-500" : ""}
                `}
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">{agent.name}</h2>
              <p className="text-xs text-zinc-500">{agent.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Status */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              ${agent.status === "online" ? "bg-green-500/10 text-green-400 border border-green-500/20" : ""}
              ${agent.status === "offline" ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20" : ""}
              ${agent.status === "busy" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : ""}
            `}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full
                ${agent.status === "online" ? "bg-green-500" : ""}
                ${agent.status === "offline" ? "bg-zinc-500" : ""}
                ${agent.status === "busy" ? "bg-amber-500" : ""}
              `}
            />
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </span>
          {hasInfra && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Shield className="w-2.5 h-2.5" />
              Provisioned
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Purpose */}
        <div className="px-5 py-4 border-b border-zinc-800/30">
          <p className="text-xs text-zinc-400 leading-relaxed">{agent.purpose}</p>
        </div>

        {/* Infrastructure Section */}
        {hasInfra && (
          <div className="px-5 py-4 border-b border-zinc-800/30">
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              <Server className="w-3 h-3 inline mr-1" />
              Infrastructure
            </h3>

            <div className="space-y-2.5">
              {/* Railway Status */}
              {infra?.railwayProjectId && (
                <div className="rounded-lg border border-zinc-700/30 overflow-hidden">
                  <div className="px-3 py-2.5 bg-zinc-800/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-medium text-zinc-300">Railway</span>
                      </div>
                      {infra.railwayStatus && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            RAILWAY_STATUS_STYLES[infra.railwayStatus]?.bg || ""
                          } ${RAILWAY_STATUS_STYLES[infra.railwayStatus]?.border || ""} ${
                            RAILWAY_STATUS_STYLES[infra.railwayStatus]?.color || ""
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              infra.railwayStatus === "running"
                                ? "bg-green-500"
                                : infra.railwayStatus === "deploying"
                                ? "bg-amber-500"
                                : infra.railwayStatus === "error"
                                ? "bg-red-500"
                                : "bg-zinc-500"
                            }`}
                          />
                          {RAILWAY_STATUS_STYLES[infra.railwayStatus]?.label || infra.railwayStatus}
                        </span>
                      )}
                    </div>

                    {infra.railwayUrl && (
                      <a
                        href={infra.railwayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors mb-2"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {infra.railwayUrl}
                      </a>
                    )}

                    {/* Start/Stop/Restart Controls */}
                    <div className="flex items-center gap-1.5">
                      {infra.railwayStatus === "running" ? (
                        <button
                          onClick={() => handleServiceAction("stop")}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-40"
                        >
                          {actionLoading === "stop" ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Square className="w-2.5 h-2.5" />
                          )}
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => handleServiceAction("start")}
                          disabled={!!actionLoading}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-40"
                        >
                          {actionLoading === "start" ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <Play className="w-2.5 h-2.5" />
                          )}
                          Start
                        </button>
                      )}

                      <button
                        onClick={handleRestart}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-40"
                      >
                        {actionLoading === "restart" ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-2.5 h-2.5" />
                        )}
                        Restart
                      </button>

                      <button
                        disabled
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 cursor-not-allowed"
                        title="Coming soon"
                      >
                        <FileText className="w-2.5 h-2.5" />
                        Logs
                      </button>

                      {infra.railwayProjectId && (
                        <a
                          href={`https://railway.app/project/${infra.railwayProjectId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-700/50 transition-all"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Dashboard
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Email */}
              {infra?.email && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/20 border border-zinc-700/30">
                  <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-zinc-500 block">Email</span>
                    <span className="text-xs text-zinc-300 block truncate">{infra.email}</span>
                  </div>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                </div>
              )}

              {/* Whop */}
              {infra?.whopUsername && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/20 border border-zinc-700/30">
                  <ShoppingBag className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-zinc-500 block">Whop</span>
                    <span className="text-xs text-zinc-300 block truncate">@{infra.whopUsername}</span>
                  </div>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                </div>
              )}

              {/* Provisioned At & Health */}
              <div className="flex items-center gap-3 text-[10px] text-zinc-600 px-1">
                {infra?.provisionedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    Provisioned {formatTime(infra.provisionedAt)}
                  </span>
                )}
                {infra?.lastHealthCheck && (
                  <span className="flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5" />
                    Last check {formatTime(infra.lastHealthCheck)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Specialties */}
        <div className="px-5 py-4 border-b border-zinc-800/30">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
            Specialties
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {agent.specialties.map((s) => (
              <span
                key={s}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="px-5 py-4 border-b border-zinc-800/30">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            <BarChart3 className="w-3 h-3 inline mr-1" />
            Metrics
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-800/30 rounded-lg p-2.5 border border-zinc-700/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 mb-1" />
              <p className="text-sm font-bold text-zinc-200">{agent.metrics.tasksCompleted}</p>
              <p className="text-[9px] text-zinc-600">Tasks Done</p>
            </div>
            <div className="bg-zinc-800/30 rounded-lg p-2.5 border border-zinc-700/30">
              <Wifi className="w-3.5 h-3.5 text-green-400 mb-1" />
              <p className="text-sm font-bold text-zinc-200">{agent.metrics.uptime}</p>
              <p className="text-[9px] text-zinc-600">Uptime</p>
            </div>
            <div className="bg-zinc-800/30 rounded-lg p-2.5 border border-zinc-700/30">
              <Clock className="w-3.5 h-3.5 text-purple-400 mb-1" />
              <p className="text-sm font-bold text-zinc-200">
                {new Date(agent.metrics.lastActive).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
              <p className="text-[9px] text-zinc-600">Last Active</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="px-5 py-4 border-b border-zinc-800/30">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            <Activity className="w-3 h-3 inline mr-1" />
            Recent Activity
          </h3>
          <div className="space-y-2.5">
            {agent.recentActivity.map((activity, i) => (
              <div key={i} className="flex gap-2.5 group">
                <div className="flex flex-col items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 mt-1.5 group-first:bg-indigo-500" />
                  {i < agent.recentActivity.length - 1 && (
                    <div className="w-px flex-1 bg-zinc-800 mt-1" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    {activity.action}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {formatTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Communication Log */}
        <div className="px-5 py-4">
          <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            <MessageSquare className="w-3 h-3 inline mr-1" />
            Communication Log
          </h3>
          <div className="space-y-2">
            {agent.communications.map((comm, i) => {
              const isOutgoing = comm.from === agent.id;
              return (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30 fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {isOutgoing ? (
                      <ArrowUpRight className="w-3 h-3 text-indigo-400" />
                    ) : (
                      <ArrowDownLeft className="w-3 h-3 text-green-400" />
                    )}
                    <span className="text-[10px] font-medium text-zinc-400">
                      {isOutgoing ? "To" : "From"}{" "}
                      <span className="text-zinc-300">
                        {getAgentEmoji(isOutgoing ? comm.to : comm.from)}{" "}
                        {getAgentName(isOutgoing ? comm.to : comm.from)}
                      </span>
                    </span>
                    <span className="text-[9px] text-zinc-600 ml-auto">
                      {formatTime(comm.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {comm.message}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
