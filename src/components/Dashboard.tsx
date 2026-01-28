"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeMouseHandler,
  MarkerType,
  ConnectionMode,
} from "@xyflow/react";
import type { Agent, AgentData } from "@/types/agent";
import AgentNode from "./AgentNode";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import DetailPanel from "./DetailPanel";
import AddAgentModal from "./AddAgentModal";
import ChatPanel from "./chat/ChatPanel";
import MeetingScheduler from "./chat/MeetingScheduler";
import UpcomingMeetings from "./chat/UpcomingMeetings";
import initialData from "@/data/agents.json";

const nodeTypes: NodeTypes = {
  agent: AgentNode as unknown as NodeTypes["agent"],
};

const CURRENT_USER_ID = "andrew";

function getDmChatId(agentA: string, agentB: string): string {
  const sorted = [agentA, agentB].sort();
  return `dm-${sorted[0]}-${sorted[1]}`;
}

function buildNodesAndEdges(
  agents: Agent[],
  onSelect: (id: string) => void,
  onChatClick: (id: string) => void,
  recentEdges: Set<string>
): { nodes: Node[]; edges: Edge[] } {
  const positions: Record<string, { x: number; y: number }> = {};
  const levelMap: Record<string, number> = {};
  const childrenMap: Record<string, string[]> = {};

  agents.forEach((a) => {
    if (a.parentId) {
      if (!childrenMap[a.parentId]) childrenMap[a.parentId] = [];
      childrenMap[a.parentId].push(a.id);
    }
  });

  const roots = agents.filter((a) => !a.parentId);

  const queue: { id: string; level: number }[] = roots.map((r) => ({
    id: r.id,
    level: 0,
  }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    levelMap[id] = level;
    const children = childrenMap[id] || [];
    children.forEach((cid) => queue.push({ id: cid, level: level + 1 }));
  }

  agents.forEach((a) => {
    if (!visited.has(a.id)) {
      levelMap[a.id] = 0;
    }
  });

  const levelsCount: Record<number, string[]> = {};
  Object.entries(levelMap).forEach(([id, level]) => {
    if (!levelsCount[level]) levelsCount[level] = [];
    levelsCount[level].push(id);
  });

  const VERTICAL_GAP = 200;
  const HORIZONTAL_GAP = 280;

  Object.entries(levelsCount).forEach(([levelStr, ids]) => {
    const level = parseInt(levelStr);
    const totalWidth = (ids.length - 1) * HORIZONTAL_GAP;
    const startX = -totalWidth / 2;
    ids.forEach((id, i) => {
      positions[id] = {
        x: startX + i * HORIZONTAL_GAP,
        y: level * VERTICAL_GAP,
      };
    });
  });

  const nodes: Node[] = agents.map((agent) => ({
    id: agent.id,
    type: "agent",
    position: positions[agent.id] || { x: 0, y: 0 },
    data: {
      label: agent.name,
      role: agent.role,
      emoji: agent.emoji,
      status: agent.status,
      specialties: agent.specialties,
      onSelect,
      onChatClick,
      unreadCount: 0, // Could be populated with real counts
    },
  }));

  const data = initialData as AgentData;
  const edges: Edge[] = data.edges.map((e) => {
    const isRecent = recentEdges.has(e.id);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.animated || isRecent,
      label: e.label,
      type: "smoothstep",
      style: {
        stroke: e.animated || isRecent ? "#6366f1" : "#27272a",
        strokeWidth: isRecent ? 3 : e.animated ? 2 : 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.animated || isRecent ? "#6366f1" : "#3f3f46",
        width: 16,
        height: 16,
      },
      labelStyle: {
        fill: "#71717a",
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: "#12121a",
        fillOpacity: 0.9,
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      className: isRecent ? "edge-pulse" : "",
    };
  });

  return { nodes, edges };
}

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>(
    (initialData as AgentData).agents
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMeetings, setShowMeetings] = useState(false);
  const [initialChatId, setInitialChatId] = useState<string | null>(null);
  const [meetingRefreshKey, setMeetingRefreshKey] = useState(0);
  const [recentEdges, setRecentEdges] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(3); // Seed with existing messages

  const handleSelectAgent = useCallback((id: string) => {
    setSelectedAgentId((prev) => (prev === id ? null : id));
  }, []);

  // Open DM from agent node chat icon
  const handleChatClick = useCallback(
    (agentId: string) => {
      const dmId = getDmChatId(CURRENT_USER_ID, agentId);
      setInitialChatId(dmId);
      setShowChat(true);
    },
    []
  );

  const initialLayout = useMemo(
    () => buildNodesAndEdges(agents, handleSelectAgent, handleChatClick, recentEdges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents, recentEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);

  useEffect(() => {
    const layout = buildNodesAndEdges(agents, handleSelectAgent, handleChatClick, recentEdges);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [agents, handleSelectAgent, handleChatClick, recentEdges, setNodes, setEdges]);

  const handleAddAgent = useCallback((newAgent: Agent) => {
    setAgents((prev) => [...prev, newAgent]);
    setShowAddModal(false);
  }, []);

  const handleAgentUpdate = useCallback((updatedAgent: Agent) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === updatedAgent.id ? updatedAgent : a))
    );
  }, []);

  // Handle edge click → open DM between source and target
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      const dmId = getDmChatId(edge.source, edge.target);
      setInitialChatId(dmId);
      setShowChat(true);

      // Pulse the edge
      setRecentEdges((prev) => {
        const next = new Set(prev);
        next.add(edge.id);
        return next;
      });
      setTimeout(() => {
        setRecentEdges((prev) => {
          const next = new Set(prev);
          next.delete(edge.id);
          return next;
        });
      }, 3000);
    },
    []
  );

  const handleOpenChat = useCallback(() => {
    setInitialChatId(null);
    setShowChat(true);
  }, []);

  const handleCloseChat = useCallback(() => {
    setShowChat(false);
    setInitialChatId(null);
  }, []);

  const handleMeetingScheduled = useCallback(() => {
    setMeetingRefreshKey((k) => k + 1);
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null;

  const minimapNodeColor = useCallback((node: Node) => {
    const data = node.data as { status?: string };
    if (data.status === "online") return "#22c55e";
    if (data.status === "busy") return "#f59e0b";
    return "#3f3f46";
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0f] overflow-hidden">
      <TopBar
        agents={agents}
        onAddAgent={() => setShowAddModal(true)}
        onOpenChat={handleOpenChat}
        onOpenMeetings={() => setShowMeetings(true)}
        unreadCount={unreadCount}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSelectAgent}
        />

        {/* Main canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgeClick={handleEdgeClick}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.4, minZoom: 0.5, maxZoom: 1.2 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(99, 102, 241, 0.08)"
            />
            <Controls
              showInteractive={false}
              position="bottom-left"
              style={{ marginBottom: 10, marginLeft: 10 }}
            />
            <MiniMap
              nodeColor={minimapNodeColor}
              maskColor="rgba(0, 0, 0, 0.7)"
              position="bottom-right"
              style={{
                marginBottom: 10,
                marginRight: 10,
                width: 150,
                height: 100,
              }}
            />
          </ReactFlow>

          {/* Canvas ambient effects */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Upcoming Meetings Widget */}
          <UpcomingMeetings agents={agents} refreshKey={meetingRefreshKey} />
        </div>

        {/* Detail Panel */}
        {selectedAgent && (
          <DetailPanel
            agent={selectedAgent}
            allAgents={agents}
            onClose={() => setSelectedAgentId(null)}
            onAgentUpdate={handleAgentUpdate}
          />
        )}
      </div>

      {/* Add Agent Modal */}
      {showAddModal && (
        <AddAgentModal
          agents={agents}
          onAdd={handleAddAgent}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Chat Panel */}
      <ChatPanel
        agents={agents}
        isOpen={showChat}
        onClose={handleCloseChat}
        initialChatId={initialChatId}
        currentUserId={CURRENT_USER_ID}
      />

      {/* Meeting Scheduler */}
      <MeetingScheduler
        agents={agents}
        isOpen={showMeetings}
        onClose={() => setShowMeetings(false)}
        onMeetingScheduled={handleMeetingScheduled}
      />
    </div>
  );
}
