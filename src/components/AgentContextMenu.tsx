"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Clock, XCircle } from "lucide-react";

interface AgentContextMenuProps {
  agentId: string;
  agentName: string;
  cronJobId?: string;
  position: { x: number; y: number };
  onClose: () => void;
  onRunNow: () => void;
  lastRun?: string;
  nextRun?: string;
}

export function AgentContextMenu({
  agentId,
  agentName,
  cronJobId,
  position,
  onClose,
  onRunNow,
  lastRun,
  nextRun,
}: AgentContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  async function handleRunNow() {
    if (!cronJobId || isRunning) return;
    setIsRunning(true);
    
    try {
      const res = await fetch(`/api/agents/${agentId}/run`, {
        method: "POST",
      });
      
      if (res.ok) {
        onRunNow();
      }
    } catch (error) {
      console.error("Failed to run agent:", error);
    } finally {
      setIsRunning(false);
      onClose();
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-1 min-w-[180px]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Agent name header */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <p className="text-sm font-medium text-zinc-200">{agentName}</p>
        {lastRun && (
          <p className="text-xs text-zinc-500 mt-0.5">Last ran {lastRun}</p>
        )}
      </div>

      {/* Run Now option */}
      <button
        onClick={handleRunNow}
        disabled={!cronJobId || isRunning}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className={`w-4 h-4 text-emerald-400 ${isRunning ? "animate-pulse" : ""}`} />
        <span className="text-zinc-200">
          {isRunning ? "Running..." : "Run Now"}
        </span>
      </button>

      {/* Next run info */}
      {nextRun && (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500">
          <Clock className="w-4 h-4" />
          <span>Next: {nextRun}</span>
        </div>
      )}

      {/* Cancel */}
      <button
        onClick={onClose}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-800 transition-colors border-t border-zinc-800"
      >
        <XCircle className="w-4 h-4 text-zinc-500" />
        <span className="text-zinc-400">Cancel</span>
      </button>
    </div>
  );
}
