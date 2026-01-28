"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Chat } from "@/types/chat";
import type { Agent } from "@/types/agent";
import ChatRoom from "./ChatRoom";
import {
  X,
  MessageSquare,
  Users,
  Hash,
  MessageCircle,
  Search,
  Calendar,
} from "lucide-react";

interface ChatPanelProps {
  agents: Agent[];
  isOpen: boolean;
  onClose: () => void;
  initialChatId?: string | null;
  currentUserId: string;
}

type ChatFilter = "all" | "dm" | "group" | "team";

export default function ChatPanel({
  agents,
  isOpen,
  onClose,
  initialChatId,
  currentUserId,
}: ChatPanelProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});

  // Fetch all chats
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchChats();
    }
  }, [isOpen, fetchChats]);

  // Handle initial chat selection
  useEffect(() => {
    if (initialChatId && chats.length > 0) {
      const chat = chats.find((c) => c.id === initialChatId);
      if (chat) {
        setSelectedChat(chat);
      }
    }
  }, [initialChatId, chats]);

  // Fetch message counts for unread indicators
  useEffect(() => {
    if (!isOpen) return;
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      for (const chat of chats) {
        try {
          const res = await fetch(`/api/messages/${chat.id}`);
          if (res.ok) {
            const msgs = await res.json();
            counts[chat.id] = msgs.length;
          }
        } catch {
          // silently fail
        }
      }
      setMessageCounts(counts);
    };
    if (chats.length > 0) fetchCounts();
  }, [chats, isOpen]);

  const getChatDisplayName = (chat: Chat) => {
    if (chat.type === "dm") {
      const otherId = chat.members.find((m) => m !== currentUserId);
      const other = agents.find((a) => a.id === otherId);
      return other ? `${other.emoji} ${other.name}` : "Direct Message";
    }
    return chat.name;
  };

  const getChatEmoji = (chat: Chat) => {
    if (chat.type === "dm") {
      const otherId = chat.members.find((m) => m !== currentUserId);
      const other = agents.find((a) => a.id === otherId);
      return other?.emoji || "💬";
    }
    if (chat.type === "team") return "🏢";
    if (chat.type === "meeting") return "📅";
    return "💬";
  };

  const getChatIcon = (chat: Chat) => {
    if (chat.type === "dm") return <MessageCircle className="w-3.5 h-3.5 text-zinc-500" />;
    if (chat.type === "team") return <Users className="w-3.5 h-3.5 text-indigo-400" />;
    if (chat.type === "meeting") return <Calendar className="w-3.5 h-3.5 text-purple-400" />;
    return <Hash className="w-3.5 h-3.5 text-zinc-500" />;
  };

  const filteredChats = chats.filter((chat) => {
    const matchesFilter =
      filter === "all" ||
      chat.type === filter ||
      (filter === "group" && (chat.type === "group" || chat.type === "meeting"));
    const displayName = getChatDisplayName(chat).toLowerCase();
    const matchesSearch = displayName.includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort: team first, then by last message
  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.type === "team" && b.type !== "team") return -1;
    if (b.type === "team" && a.type !== "team") return 1;
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });

  const handleMessagesUpdate = useCallback(() => {
    fetchChats();
  }, [fetchChats]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-[#0c0c14] border-l border-zinc-800/50 flex slide-in-right shadow-2xl shadow-black/50">
        {/* Chat List Sidebar */}
        {!selectedChat && (
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-800/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-100">Messages</h2>
                  <p className="text-[10px] text-zinc-500">
                    {chats.length} conversations
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2.5 border-b border-zinc-800/30">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-1 mt-2">
                {(["all", "dm", "team", "group"] as ChatFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`
                      flex-1 px-2 py-1 rounded-md text-[10px] font-medium capitalize transition-all
                      ${
                        filter === f
                          ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                          : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50 border border-transparent"
                      }
                    `}
                  >
                    {f === "dm" ? "DMs" : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              {sortedChats.map((chat) => {
                const count = messageCounts[chat.id] || 0;
                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-all duration-200 border-b border-zinc-800/20 group"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-lg border border-zinc-700/40 group-hover:border-zinc-600/60 transition-colors">
                      {getChatEmoji(chat)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        {getChatIcon(chat)}
                        <span className="text-xs font-semibold text-zinc-200 truncate">
                          {getChatDisplayName(chat)}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-600 truncate mt-0.5">
                        {chat.members.length} members
                        {chat.lastMessageAt
                          ? ` · ${new Date(chat.lastMessageAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>

                    {/* Badge */}
                    {count > 0 && (
                      <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              {sortedChats.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-600">No chats found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Chat Room */}
        {selectedChat && (
          <div className="flex-1 flex flex-col">
            <ChatRoom
              chat={selectedChat}
              agents={agents}
              currentUserId={currentUserId}
              onBack={() => setSelectedChat(null)}
              onMessagesUpdate={handleMessagesUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
