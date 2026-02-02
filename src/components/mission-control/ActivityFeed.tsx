"use client";

import { useState, useEffect } from "react";
import { Lightning, Chat, FileText, CheckCircle, Clock, User } from "@phosphor-icons/react";

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
    if (action.includes("message")) return <Chat className="w-4 h-4" />;
    if (action.includes("document")) return <FileText className="w-4 h-4" />;
    if (action.includes("login")) return <User className="w-4 h-4" />;
    return <Lightning className="w-4 h-4" />;
  }

  function formatTime(timestamp: number) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getActorColor(actorType: string) {
    switch (actorType) {
      case "agent": return "text-blue-500 bg-blue-500/10";
      case "human": return "text-green-500 bg-green-500/10";
      case "system": return "text-amber-500 bg-amber-500/10";
      default: return "text-gray-500 bg-gray-500/10";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilter && (
        <div className="flex gap-2">
          {(["all", "agent", "human", "system"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                filter === type
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className={`p-2 rounded-full ${getActorColor(activity.actorType)}`}>
                {getActivityIcon(activity.action)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.actorId}</span>
                  {" "}{activity.action}{" "}
                  <span className="text-gray-500">{activity.targetType}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
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
