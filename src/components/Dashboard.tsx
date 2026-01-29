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
import type { Agent } from "@/types/agent";
import AgentNode from "./AgentNode";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import DetailPanel from "./DetailPanel";
import AddAgentModal from "./AddAgentModal";
import ChatPanel from "./chat/ChatPanel";
import MeetingScheduler from "./chat/MeetingScheduler";
import UpcomingMeetings from "./chat/UpcomingMeetings";
import WhoAreYouModal, { getUserIdentity, type UserIdentity } from "./WhoAreYouModal";

const nodeTypes: NodeTypes = {
  agent: AgentNode as unknown as NodeTypes["agent"],
};

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

  // Separate support agents (like Iris) to position them on the left
  const supportAgentIds = new Set(['iris']);
  
  Object.entries(levelsCount).forEach(([levelStr, ids]) => {
    const level = parseInt(levelStr);
    // Filter out support agents from main layout
    const mainIds = ids.filter(id => !supportAgentIds.has(id));
    const supportIds = ids.filter(id => supportAgentIds.has(id));
    
    // Position main agents centered
    const totalWidth = (mainIds.length - 1) * HORIZONTAL_GAP;
    const startX = -totalWidth / 2;
    mainIds.forEach((id, i) => {
      positions[id] = {
        x: startX + i * HORIZONTAL_GAP,
        y: level * VERTICAL_GAP,
      };
    });
    
    // Position support agents to the far left
    supportIds.forEach((id, i) => {
      positions[id] = {
        x: startX - HORIZONTAL_GAP * 1.5 - (i * HORIZONTAL_GAP),
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

  // Generate edges dynamically based on parentId relationships
  const edges: Edge[] = agents
    .filter(a => a.parentId)
    .map((a) => {
      const edgeId = `e-${a.parentId}-${a.id}`;
      const isRecent = recentEdges.has(edgeId);
      const isOnline = a.status === 'online';
      return {
        id: edgeId,
        source: a.parentId!,
        target: a.id,
        animated: isOnline || isRecent,
        type: "smoothstep",
        style: {
          stroke: isOnline || isRecent ? "#6366f1" : "#27272a",
          strokeWidth: isRecent ? 3 : isOnline ? 2 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isOnline || isRecent ? "#6366f1" : "#3f3f46",
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

// Core agents that always exist (founders + their assistants)
const CORE_AGENTS: Agent[] = [
  {
    id: "andrew",
    name: "Andrew",
    role: "Co-founder",
    emoji: "👑",
    status: "online",
    purpose: "Vision, strategy, and final decisions. The human behind Spark Studio.",
    specialties: ["Strategy", "Product Vision", "Leadership", "Revenue"],
    parentId: null,
    recentActivity: [],
    communications: [],
    metrics: { tasksCompleted: 0, uptime: "100%", lastActive: new Date().toISOString() },
  },
  {
    id: "cale",
    name: "Cale",
    role: "Co-founder",
    emoji: "🚀",
    status: "online",
    purpose: "Co-founder focused on Funnels App development with Arthur.",
    specialties: ["Funnels App", "Product Development", "Technical Strategy"],
    parentId: null,
    recentActivity: [],
    communications: [],
    metrics: { tasksCompleted: 0, uptime: "100%", lastActive: new Date().toISOString() },
  },
  {
    id: "henry",
    name: "Henry",
    role: "COO",
    emoji: "🎯",
    status: "online",
    purpose: "Operations command center. Manages agents, coordinates tasks, runs operations for Andrew.",
    specialties: ["Operations", "Coordination", "Agent Management", "Strategy Execution"],
    parentId: "andrew",
    recentActivity: [],
    communications: [],
    metrics: { tasksCompleted: 0, uptime: "99.7%", lastActive: new Date().toISOString() },
  },
  {
    id: "arthur",
    name: "Arthur",
    role: "Cale's Assistant",
    emoji: "🤖",
    status: "online",
    purpose: "Cale's executive assistant. Supports Funnels App development, collaborates with Henry.",
    specialties: ["Funnels App", "Development Support", "Coordination with Henry"],
    parentId: "cale",
    recentActivity: [],
    communications: [],
    metrics: { tasksCompleted: 0, uptime: "99.5%", lastActive: new Date().toISOString() },
  },
];

export default function Dashboard() {
  const [agents, setAgents] = useState<Agent[]>(CORE_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMeetings, setShowMeetings] = useState(false);
  const [initialChatId, setInitialChatId] = useState<string | null>(null);
  const [meetingRefreshKey, setMeetingRefreshKey] = useState(0);
  const [recentEdges, setRecentEdges] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<UserIdentity | null>(null);

  // Check for existing identity on mount
  useEffect(() => {
    const existing = getUserIdentity();
    if (existing) setCurrentUserId(existing);
  }, []);

  // Fetch real agents from Railway on mount
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          if (data.agents && Array.isArray(data.agents)) {
            // Agent hierarchy mapping
            const agentHierarchy: Record<string, { parentId: string; emoji: string }> = {
              // Heads report to Henry
              atlas: { parentId: 'henry', emoji: '🗺️' },
              apollo: { parentId: 'henry', emoji: '☀️' },
              artemis: { parentId: 'henry', emoji: '🏹' },
              // Engineers report to their respective heads
              maia: { parentId: 'atlas', emoji: '⭐' },
              orpheus: { parentId: 'apollo', emoji: '🎵' },
              callisto: { parentId: 'artemis', emoji: '🐻' },
              // Support reports to Henry but positioned separately
              iris: { parentId: 'henry', emoji: '🌈' },
            };

            // Convert Railway records to Agent format
            const railwayAgents: Agent[] = data.agents.map((record: {
              agentId: string;
              agentName: string;
              agentRole?: string;
              agentPurpose?: string;
              roleTemplate?: string;
              domain?: string;
              gatewayUrl?: string;
              gatewayToken?: string;
              liveStatus?: string;
              provisionedAt?: string;
              railwayProjectId?: string;
              railwayServiceId?: string;
            }) => {
              const hierarchy = agentHierarchy[record.agentId] || { parentId: 'henry', emoji: '🤖' };
              return {
                id: record.agentId,
                name: record.agentName,
                role: record.agentRole || record.roleTemplate || 'Agent',
                emoji: hierarchy.emoji,
                status: record.liveStatus === 'SUCCESS' ? 'online' : 'offline',
                purpose: record.agentPurpose || `Provisioned agent`,
                specialties: [],
                parentId: hierarchy.parentId,
                recentActivity: [],
                communications: [],
                metrics: {
                  tasksCompleted: 0,
                  uptime: record.liveStatus === 'SUCCESS' ? '100%' : '0%',
                  lastActive: record.provisionedAt || new Date().toISOString(),
                },
                infrastructure: {
                  railwayProjectId: record.railwayProjectId,
                  railwayServiceId: record.railwayServiceId,
                  railwayUrl: record.railwayProjectId ? `https://railway.app/project/${record.railwayProjectId}` : undefined,
                  railwayStatus: record.liveStatus,
                  gatewayUrl: record.gatewayUrl || (record.domain ? `https://${record.domain}` : undefined),
                  gatewayToken: record.gatewayToken,
                  provisionedAt: record.provisionedAt,
                },
              };
            });
            // Merge core agents with Railway agents (avoid duplicates)
            const railwayIds = new Set(railwayAgents.map(a => a.id));
            const merged = [
              ...CORE_AGENTS.filter(a => !railwayIds.has(a.id)),
              ...railwayAgents,
            ];
            setAgents(merged);
          }
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAgents();
  }, []);

  const handleSelectAgent = useCallback((id: string) => {
    setSelectedAgentId((prev) => (prev === id ? null : id));
  }, []);

  // Open DM from agent node chat icon
  const handleChatClick = useCallback(
    (agentId: string) => {
      const dmId = getDmChatId(currentUserId || 'andrew', agentId);
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
      {/* Identity selector modal */}
      {!currentUserId && (
        <WhoAreYouModal onSelect={(id) => setCurrentUserId(id)} />
      )}
      
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
        currentUserId={currentUserId || 'andrew'}
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
