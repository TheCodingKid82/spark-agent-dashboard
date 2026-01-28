"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Meeting } from "@/types/chat";
import type { Agent } from "@/types/agent";
import { Calendar, Clock } from "lucide-react";

interface UpcomingMeetingsProps {
  agents: Agent[];
  refreshKey: number;
}

export default function UpcomingMeetings({
  agents,
  refreshKey,
}: UpcomingMeetingsProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [countdown, setCountdown] = useState("");

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch("/api/meetings");
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings, refreshKey]);

  // Find next upcoming meeting
  const now = new Date().getTime();
  const upcomingMeetings = meetings
    .filter((m) => new Date(m.time).getTime() > now)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const nextMeeting = upcomingMeetings[0];

  // Countdown timer
  useEffect(() => {
    if (!nextMeeting) return;
    const update = () => {
      const diff = new Date(nextMeeting.time).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Now!");
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      if (h > 24) {
        const d = Math.floor(h / 24);
        setCountdown(`${d}d ${h % 24}h ${m}m`);
      } else if (h > 0) {
        setCountdown(`${h}h ${m}m ${s}s`);
      } else {
        setCountdown(`${m}m ${s}s`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextMeeting]);

  if (!nextMeeting) return null;

  const getAgentById = (id: string) => agents.find((a) => a.id === id);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#12121a]/90 backdrop-blur-xl border border-zinc-800/50 shadow-lg shadow-black/30">
        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-zinc-200">
            {nextMeeting.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-purple-400" />
              <span className="text-[10px] font-mono font-bold text-purple-400">
                {countdown}
              </span>
            </div>
            <span className="text-[9px] text-zinc-600">·</span>
            <div className="flex items-center gap-0.5">
              {nextMeeting.attendees.slice(0, 4).map((id) => {
                const a = getAgentById(id);
                return (
                  <span
                    key={id}
                    className="w-4 h-4 rounded-sm bg-zinc-700/50 flex items-center justify-center text-[8px]"
                    title={a?.name}
                  >
                    {a?.emoji || "🤖"}
                  </span>
                );
              })}
              {nextMeeting.attendees.length > 4 && (
                <span className="text-[8px] text-zinc-600 ml-0.5">
                  +{nextMeeting.attendees.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
