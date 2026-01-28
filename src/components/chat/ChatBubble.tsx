"use client";

import React from "react";
import type { Message } from "@/types/chat";
import type { Agent } from "@/types/agent";

interface ChatBubbleProps {
  message: Message;
  agents: Agent[];
  isOwn: boolean;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ChatBubble({ message, agents, isOwn }: ChatBubbleProps) {
  const agent = agents.find((a) => a.id === message.sender);
  const emoji = agent?.emoji || "🤖";
  const name = agent?.name || message.sender;

  return (
    <div
      className={`flex gap-2.5 max-w-[85%] fade-in ${
        isOwn ? "ml-auto flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      {!isOwn && (
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-base border border-zinc-700/50 mt-0.5">
          {emoji}
        </div>
      )}

      {/* Bubble */}
      <div className="flex flex-col gap-0.5">
        {!isOwn && (
          <span className="text-[10px] font-semibold text-zinc-500 px-1">
            {name}
          </span>
        )}
        <div
          className={`
            px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed
            ${
              isOwn
                ? "bg-indigo-600 text-white rounded-br-md"
                : "bg-zinc-800/80 text-zinc-200 border border-zinc-700/40 rounded-bl-md"
            }
          `}
        >
          {message.content}
        </div>
        <span
          className={`text-[9px] text-zinc-600 px-1 ${
            isOwn ? "text-right" : ""
          }`}
        >
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
