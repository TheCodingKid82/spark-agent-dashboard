"use client";

import { useState } from "react";
import { Zap, MessageSquare, FileText, CheckCircle, Clock, User, RefreshCw } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface Activity {
  _id: string;
  actorId: string;
  actorType: "agent" | "human" | "system";
  action: string;
  targetType: "task" | "message" | "document" | "agent";
  targetId: string;
  _creationTime: number;
  metadata?: any;
}

interface ActivityFeedProps {
  limit?: number;
  showFilter?: boolean;
}

export function ActivityFeed({ limit = 50, showFilter = true }: ActivityFeedProps) {
  const activities = useQuery(api.activities.getAll, { limit });
  const [filter, setFilter] = useState<"all" | "agent" | "human" | "system">("all");

  const filteredActivities = filter === "all" 
    ? (activities || [])
    : (activities || []).filter(a => a.actorType === filter);

  function getActivityIcon(action: string) {
    if (action.includes("task")) return <CheckCircle className="w-4 h-4" />;
    if (action.includes("message")) return <MessageSquare className="w-4 h-4" />;
    if (action.includes("document")) return <FileText className="w-4 h-4" />;
    if (action.includes("login")) return <User className="w-4 h-4" />;
    return <Zap className="w-4 h-4" />;
  }

  function formatTime(timestamp: number) {
    const now = Date.now();
    const diff = now - timestamp;
    
    // Less than a minute
    if (diff < 60000) return "Just now";
    
    // Less than an hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    
    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    // Show date
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function getActorColor(actorType: string) {
    switch (actorType) {
      case "agent":
        return "text-indigo-300 bg-indigo-500/10 border border-indigo-500/20";
      case "human":
        return "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20";
      case "system":
        return "text-amber-300 bg-amber-500/10 border border-amber-500/20";
      default:
        return "text-zinc-300 bg-zinc-500/10 border border-zinc-500/20";
    }
  }

  function formatAction(action: string): string {
    return action.replace(/_/g, " ");
  }

  // Loading state
  if (activities === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {showFilter && (
        <div className="flex gap-2">
          {(["all", "agent", "human", "system"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors border ${
                filter === type
                  ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/30"
                  : "bg-zinc-950/40 text-zinc-400 border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
            <p className="text-xs mt-2 text-zinc-600">
              Activity will appear here as agents work
            </p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div
              key={activity._id}
              className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors"
            >
              <div className={`p-2 rounded-full shrink-0 ${getActorColor(activity.actorType)}`}>
                {getActivityIcon(activity.action)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200">
                  <span className="font-medium text-zinc-100">{activity.actorId}</span>
                  <span className="text-zinc-400"> {formatAction(activity.action)} </span>
                  {activity.metadata?.title && (
                    <span className="text-zinc-300">"{activity.metadata.title}"</span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-600">
                    {formatTime(activity._creationTime)}
                  </span>
                  <span className="text-xs text-zinc-700">•</span>
                  <span className="text-xs text-zinc-600">{activity.targetType}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
