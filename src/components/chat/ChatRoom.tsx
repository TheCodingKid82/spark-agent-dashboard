"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Chat, Message } from "@/types/chat";
import type { Agent } from "@/types/agent";
import ChatBubble from "./ChatBubble";
import { Send, ArrowLeft, Users, Hash, MessageCircle } from "lucide-react";

interface ChatRoomProps {
  chat: Chat;
  agents: Agent[];
  currentUserId: string;
  onBack: () => void;
  onMessagesUpdate: () => void;
}

export default function ChatRoom({
  chat,
  agents,
  currentUserId,
  onBack,
  onMessagesUpdate,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get chat display name
  const getChatName = () => {
    if (chat.type === "dm") {
      const otherId = chat.members.find((m) => m !== currentUserId);
      const other = agents.find((a) => a.id === otherId);
      return other ? `${other.emoji} ${other.name}` : "Direct Message";
    }
    return chat.name;
  };

  const getChatIcon = () => {
    if (chat.type === "dm") return <MessageCircle className="w-4 h-4 text-indigo-400" />;
    if (chat.type === "team") return <Users className="w-4 h-4 text-indigo-400" />;
    return <Hash className="w-4 h-4 text-indigo-400" />;
  };

  const getMemberNames = () => {
    return chat.members
      .map((id) => {
        const a = agents.find((ag) => ag.id === id);
        return a ? `${a.emoji} ${a.name}` : id;
      })
      .join(", ");
  };

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages/${chat.id}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch {
        // silently fail
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [chat.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [chat.id]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: currentUserId,
          chatId: chat.id,
          content,
        }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        onMessagesUpdate();

        // Simulate typing response for DMs
        if (chat.type === "dm") {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 2000);
        }
      }
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Get "other" agent for typing indicator in DMs
  const otherAgent = chat.type === "dm"
    ? agents.find((a) => a.id === chat.members.find((m) => m !== currentUserId))
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-800/50 bg-[#0e0e15]/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-colors md:hidden"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={onBack}
            className="w-7 h-7 rounded-lg items-center justify-center hover:bg-zinc-800 transition-colors hidden md:flex"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          {getChatIcon()}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100 truncate">
              {getChatName()}
            </h3>
            <p className="text-[10px] text-zinc-500 truncate">
              {chat.members.length} members · {getMemberNames()}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-3">
              <MessageCircle className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 font-medium">No messages yet</p>
            <p className="text-xs text-zinc-600 mt-1">
              Start the conversation!
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            agents={agents}
            isOwn={msg.sender === currentUserId}
          />
        ))}

        {/* Typing indicator */}
        {isTyping && otherAgent && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 fade-in">
            <span>{otherAgent.emoji}</span>
            <span>{otherAgent.name} is typing</span>
            <span className="typing-dots flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Message Input */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-800/50 bg-[#0e0e15]/30">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${getChatName()}...`}
            className="flex-1 px-4 py-2.5 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
