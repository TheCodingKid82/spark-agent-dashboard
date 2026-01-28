"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AgentStatus } from "@/types/agent";
import { MessageCircle } from "lucide-react";

interface AgentNodeData {
  label: string;
  role: string;
  emoji: string;
  status: AgentStatus;
  specialties: string[];
  onSelect: (id: string) => void;
  unreadCount?: number;
  onChatClick?: (id: string) => void;
  [key: string]: unknown;
}

const statusColors: Record<AgentStatus, string> = {
  online: "bg-green-500",
  offline: "bg-zinc-500",
  busy: "bg-amber-500",
};

const statusLabels: Record<AgentStatus, string> = {
  online: "Online",
  offline: "Offline",
  busy: "Busy",
};

function AgentNode({ data, id }: NodeProps & { data: AgentNodeData }) {
  const { label, role, emoji, status, specialties, onSelect, unreadCount, onChatClick } = data;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-500 !border-indigo-700 !w-3 !h-3"
      />

      <div
        onClick={() => onSelect(id)}
        className={`
          relative cursor-pointer group
          bg-[#12121a] border border-zinc-800 rounded-xl
          px-5 py-4 min-w-[200px] max-w-[240px]
          transition-all duration-300 ease-out
          hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10
          hover:scale-[1.02]
          ${status === "online" ? "border-zinc-700" : ""}
          ${status === "busy" ? "border-amber-900/30" : ""}
        `}
      >
        {/* Subtle gradient overlay on hover */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Chat icon with unread badge */}
        {onChatClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChatClick(id);
            }}
            className="absolute top-2 right-2 z-10 w-6 h-6 rounded-md bg-zinc-800/80 hover:bg-indigo-500/20 border border-zinc-700/50 hover:border-indigo-500/40 flex items-center justify-center transition-all duration-200 group/chat"
            title="Open chat"
          >
            <MessageCircle className="w-3 h-3 text-zinc-500 group-hover/chat:text-indigo-400 transition-colors" />
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[12px] h-3 rounded-full bg-indigo-600 text-white text-[7px] font-bold flex items-center justify-center px-0.5 shadow-lg shadow-indigo-500/40">
                {unreadCount}
              </span>
            )}
          </button>
        )}

        {/* Header */}
        <div className="relative flex items-start gap-3">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-xl border border-zinc-700">
              {emoji}
            </div>
            {/* Status indicator */}
            <div
              className={`
                absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#12121a]
                ${statusColors[status]}
                ${status === "online" ? "status-pulse" : ""}
              `}
            />
          </div>

          {/* Name and Role */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100 truncate">
              {label}
            </h3>
            <p className="text-xs text-zinc-500 truncate">{role}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className="relative mt-3 flex items-center gap-2">
          <span
            className={`
              inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium
              ${status === "online" ? "bg-green-500/10 text-green-400" : ""}
              ${status === "offline" ? "bg-zinc-500/10 text-zinc-500" : ""}
              ${status === "busy" ? "bg-amber-500/10 text-amber-400" : ""}
            `}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`}
            />
            {statusLabels[status]}
          </span>
        </div>

        {/* Specialties */}
        {specialties.length > 0 && (
          <div className="relative mt-2.5 flex flex-wrap gap-1">
            {specialties.slice(0, 3).map((s) => (
              <span
                key={s}
                className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50"
              >
                {s}
              </span>
            ))}
            {specialties.length > 3 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800/80 text-zinc-500">
                +{specialties.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-500 !border-indigo-700 !w-3 !h-3"
      />
    </>
  );
}

export default memo(AgentNode);
