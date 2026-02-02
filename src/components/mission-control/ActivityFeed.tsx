"use client";

import { useState, useEffect } from "react";
import { Zap, MessageSquare, FileText, CheckCircle, Clock, User } from "lucide-react";

interface Activity {
  id: string;
  actorId: string;
  actorType: "agent" | "human" | "system";
  action: string;
  targetType: "task" | "message" | "document" | "agent";
  targetId: string;
  createdAt: number;
  metadata?: any;
}

interface ActivityFeedProps {
  limit?: number;
  showFilter?: boolean;
}

export function ActivityFeed({ limit = 50, showFilter = true }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "agent" | "human" | "system">("all");

  useEffect(() => {
    loadActivities();
  }, []);

  async function loadActivities() {
    try {
      const res = await fetch(`/api/activities?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to load activities:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredActivities = filter === "all" 
    ? activities 
    : activities.filter(a => a.actorType === filter);

  function getActivityIcon(action: string) {
    if (action.includes("task")) return <CheckCircle className="w-4 h-4" />;
    if (action.includes("message")) return <MessageSquare className="w-4 h-4" />;
    if (action.includes("document")) return <FileText className="w-4 h-4" />;
    if (action.includes("login")) return <User className="w-4 h-4" />;
    return <Zap className="w-4 h-4" />;
  }

  function formatTime(timestamp: number) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600"></div>
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
                  ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                  : "bg-zinc-950/40 text-zinc-400 border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors"
            >
              <div className={`p-2 rounded-full ${getActorColor(activity.actorType)}`}>
                {getActivityIcon(activity.action)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200">
                  <span className="font-medium text-zinc-100">{activity.actorId}</span>
                  <span className="text-zinc-400"> {activity.action} </span>
                  <span className="text-zinc-500">{activity.targetType}</span>
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  {formatTime(activity.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
