"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Agent } from "@/types/agent";
import type { Meeting } from "@/types/chat";
import {
  X,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  Square,
  Plus,
  Video,
} from "lucide-react";

interface MeetingSchedulerProps {
  agents: Agent[];
  isOpen: boolean;
  onClose: () => void;
  onMeetingScheduled: () => void;
}

export default function MeetingScheduler({
  agents,
  isOpen,
  onClose,
  onMeetingScheduled,
}: MeetingSchedulerProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Fetch meetings
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
    if (isOpen) fetchMeetings();
  }, [isOpen, fetchMeetings]);

  const toggleAttendee = (id: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedAttendees.length === agents.length) {
      setSelectedAttendees([]);
    } else {
      setSelectedAttendees(agents.map((a) => a.id));
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !time || selectedAttendees.length === 0)
      return;

    setScheduling(true);
    try {
      const meetingTime = new Date(`${date}T${time}`).toISOString();
      const res = await fetch("/api/meetings/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          time: meetingTime,
          attendees: selectedAttendees,
        }),
      });

      if (res.ok) {
        setTitle("");
        setDate("");
        setTime("");
        setSelectedAttendees([]);
        setShowForm(false);
        fetchMeetings();
        onMeetingScheduled();
      }
    } catch {
      // silently fail
    } finally {
      setScheduling(false);
    }
  };

  const getAgentById = (id: string) => agents.find((a) => a.id === id);

  const formatMeetingTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCountdown = (iso: string) => {
    const now = new Date().getTime();
    const target = new Date(iso).getTime();
    const diff = target - now;
    if (diff <= 0) return "Started";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `in ${hours}h ${mins}m`;
    return `in ${mins}m`;
  };

  // Sort meetings: upcoming first
  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#12121a] border border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl shadow-black/50 fade-in max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Meetings</h2>
              <p className="text-[10px] text-zinc-500">
                Schedule & manage team meetings
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

        <div className="flex-1 overflow-y-auto">
          {/* Upcoming Meetings */}
          <div className="px-6 py-4 border-b border-zinc-800/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                <Clock className="w-3 h-3 inline mr-1" />
                Upcoming Meetings
              </h3>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium transition-all active:scale-95"
              >
                <Plus className="w-3 h-3" />
                New
              </button>
            </div>

            {sortedMeetings.length === 0 && !showForm && (
              <div className="text-center py-6">
                <Video className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-600">No meetings scheduled</p>
                <p className="text-[10px] text-zinc-700 mt-1">
                  Click &quot;New&quot; to schedule one
                </p>
              </div>
            )}

            {sortedMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="mb-2 p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30 hover:border-zinc-600/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200">
                      📅 {meeting.title}
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {formatMeetingTime(meeting.time)}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {getCountdown(meeting.time)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  {meeting.attendees.slice(0, 6).map((id) => {
                    const a = getAgentById(id);
                    return (
                      <span
                        key={id}
                        className="w-6 h-6 rounded-md bg-zinc-700/50 flex items-center justify-center text-xs"
                        title={a?.name}
                      >
                        {a?.emoji || "🤖"}
                      </span>
                    );
                  })}
                  {meeting.attendees.length > 6 && (
                    <span className="text-[9px] text-zinc-600">
                      +{meeting.attendees.length - 6}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Schedule Form */}
          {showForm && (
            <form onSubmit={handleSchedule} className="px-6 py-4 space-y-4">
              <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Schedule New Meeting
              </h3>

              {/* Title */}
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekly Standup"
                  className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  required
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Time *
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Attendees */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                    <Users className="w-3 h-3 inline mr-1" />
                    Attendees *
                  </label>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    {selectedAttendees.length === agents.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {agents.map((agent) => {
                    const selected = selectedAttendees.includes(agent.id);
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => toggleAttendee(agent.id)}
                        className={`
                          flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all duration-200
                          ${
                            selected
                              ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
                              : "bg-zinc-800/30 border border-zinc-700/30 text-zinc-400 hover:bg-zinc-800/50"
                          }
                        `}
                      >
                        {selected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-zinc-600" />
                        )}
                        <span>{agent.emoji}</span>
                        <span className="truncate">{agent.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !title.trim() ||
                    !date ||
                    !time ||
                    selectedAttendees.length === 0 ||
                    scheduling
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-indigo-500/25"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
