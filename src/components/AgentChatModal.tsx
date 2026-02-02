"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { AgentIcon } from "@/lib/icons";

interface Agent {
  id: string;
  name: string;
  role: string;
  emoji?: string;
  sessionKey: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface AgentChatModalProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentChatModal({ agent, onClose }: AgentChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"checking" | "online" | "offline" | "error">("checking");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAgentStatus();
  }, [agent.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function checkAgentStatus() {
    try {
      const res = await fetch(`/api/agents/${agent.id}/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status || "offline");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/agents/${agent.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await res.json();

      if (res.ok && data.result?.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.result.response,
            timestamp: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Message sent. Waiting for response...",
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  const statusColors = {
    checking: "bg-amber-500",
    online: "bg-emerald-500",
    offline: "bg-zinc-500",
    error: "bg-red-500",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl h-[600px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <AgentIcon agentId={agent.id} size={40} />
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-900 ${statusColors[status]}`}
              />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-100">{agent.name}</h2>
              <p className="text-xs text-zinc-500">{agent.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <p className="text-sm">Start a conversation with {agent.name}</p>
              <p className="text-xs mt-2">
                {status === "online" ? "Agent is online and ready" : 
                 status === "checking" ? "Checking agent status..." :
                 status === "offline" ? "Agent is offline - message will be queued" :
                 "Unable to reach agent"}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-100 border border-zinc-700"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] mt-1 opacity-50">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={`Message ${agent.name}...`}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
