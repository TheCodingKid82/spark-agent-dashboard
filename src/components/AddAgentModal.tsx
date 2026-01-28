"use client";

import React, { useState, useCallback } from "react";
import {
  X,
  Plus,
  Sparkles,
  Server,
  Mail,
  ShoppingBag,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  Rocket,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Agent, AgentStatus, AgentInfrastructure, ProvisioningStep, ProvisioningStepStatus } from "@/types/agent";

interface AddAgentModalProps {
  agents: Agent[];
  onAdd: (agent: Agent) => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = ["🤖", "🧠", "⚡", "🎯", "🛡️", "📊", "🎨", "🔧", "📡", "🚀", "💎", "🌟", "🔮", "🦾", "👁️"];

const STEP_ICONS: Record<string, React.ReactNode> = {
  railway: <Server className="w-3.5 h-3.5" />,
  workspace: <Sparkles className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  whop: <ShoppingBag className="w-3.5 h-3.5" />,
  "deploy-wait": <Rocket className="w-3.5 h-3.5" />,
  "workspace-push": <Sparkles className="w-3.5 h-3.5" />,
  "health-check": <CheckCircle2 className="w-3.5 h-3.5" />,
  "agent-directory": <Plus className="w-3.5 h-3.5" />,
};

const STATUS_STYLES: Record<ProvisioningStepStatus, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  pending: {
    color: "text-zinc-500",
    bg: "bg-zinc-800/30",
    border: "border-zinc-700/30",
    icon: <Clock className="w-3.5 h-3.5 text-zinc-500" />,
  },
  "in-progress": {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
  },
  complete: {
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  },
  error: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  },
};

export default function AddAgentModal({ agents, onAdd, onClose }: AddAgentModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [purpose, setPurpose] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentStatus>("online");

  // Role template
  const [roleTemplate, setRoleTemplate] = useState<string>("custom");

  // Provisioning state
  const [autoProvision, setAutoProvision] = useState(false);
  const [provisionRailway, setProvisionRailway] = useState(true);
  const [provisionEmail, setProvisionEmail] = useState(true);
  const [provisionWhop, setProvisionWhop] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningSteps, setProvisioningSteps] = useState<ProvisioningStep[]>([]);
  const [provisioningComplete, setProvisioningComplete] = useState(false);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [showProvisioningOptions, setShowProvisioningOptions] = useState(false);

  const runProvisioning = useCallback(
    async (agentId: string): Promise<AgentInfrastructure | undefined> => {
      setIsProvisioning(true);
      setProvisioningError(null);
      setProvisioningComplete(false);

      // Build initial steps
      const steps: ProvisioningStep[] = [];
      if (provisionRailway) {
        steps.push({ id: "railway", label: "Railway Deployment", status: "pending" });
      }
      if (provisionEmail) {
        steps.push({ id: "email", label: "Email Account", status: "pending" });
      }
      if (provisionWhop) {
        steps.push({ id: "whop", label: "Whop Account", status: "pending" });
      }
      setProvisioningSteps([...steps]);

      // Animate steps to in-progress one by one
      const updateStep = (id: string, status: ProvisioningStepStatus, message?: string) => {
        setProvisioningSteps((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status, message } : s))
        );
      };

      // Show in-progress for first step
      if (steps.length > 0) {
        updateStep(steps[0].id, "in-progress");
      }

      try {
        // Stagger the visual feedback
        for (let i = 0; i < steps.length; i++) {
          updateStep(steps[i].id, "in-progress");
          await new Promise((r) => setTimeout(r, 400));
        }

        const response = await fetch("/api/agents/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            agentName: name.trim(),
            agentRole: role.trim(),
            agentPurpose: purpose.trim() || `${name} handles ${role} tasks.`,
            roleTemplate,
            options: {
              railway: provisionRailway,
              email: provisionEmail,
              whop: provisionWhop,
              telegram: false,
              waitForDeploy: false,
            },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Provisioning failed");
        }

        // Update steps with results
        if (data.steps) {
          for (const step of data.steps as Array<{ id: string; status: string; message?: string }>) {
            updateStep(
              step.id,
              step.status === "complete" ? "complete" : "error",
              step.message
            );
          }
        }

        setProvisioningComplete(true);
        setIsProvisioning(false);

        // Build infrastructure object
        if (data.record) {
          const infra: AgentInfrastructure = {
            railwayProjectId: data.record.railwayProjectId,
            railwayServiceId: data.record.railwayServiceId,
            railwayStatus: data.record.railwayDeploymentStatus,
            railwayUrl: data.record.railwayUrl,
            email: data.record.email,
            whopUsername: data.record.whopUsername,
            provisionedAt: data.record.provisionedAt,
            lastHealthCheck: data.record.lastHealthCheck,
          };
          return infra;
        }
      } catch (error) {
        setProvisioningError(String(error));
        setIsProvisioning(false);
        // Mark remaining pending steps as error
        setProvisioningSteps((prev) =>
          prev.map((s) =>
            s.status === "pending" || s.status === "in-progress"
              ? { ...s, status: "error" as ProvisioningStepStatus, message: String(error) }
              : s
          )
        );
      }
      return undefined;
    },
    [name, role, purpose, provisionRailway, provisionEmail, provisionWhop]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !role.trim()) return;
      if (isProvisioning) return;

      const agentId = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      let infrastructure: AgentInfrastructure | undefined;

      // If auto-provision is enabled, run provisioning first
      if (autoProvision) {
        infrastructure = await runProvisioning(agentId);
      }

      const newAgent: Agent = {
        id: agentId,
        name: name.trim(),
        role: role.trim(),
        emoji,
        status,
        purpose: purpose.trim() || `${name} handles ${role} tasks.`,
        specialties: specialties
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        parentId,
        recentActivity: [
          {
            timestamp: new Date().toISOString(),
            action: autoProvision
              ? `${name} was provisioned with full infrastructure and added to the agent network`
              : `${name} was initialized and added to the agent network`,
          },
        ],
        communications: [],
        metrics: {
          tasksCompleted: 0,
          uptime: "100%",
          lastActive: new Date().toISOString(),
        },
        infrastructure,
      };

      onAdd(newAgent);
    },
    [name, role, emoji, status, purpose, specialties, parentId, onAdd, autoProvision, isProvisioning, runProvisioning]
  );

  const isFormComplete = provisioningComplete || !autoProvision;
  const canSubmit = name.trim() && role.trim() && !isProvisioning && isFormComplete;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isProvisioning ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-[#12121a] border border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl shadow-black/50 fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Deploy New Agent</h2>
              <p className="text-[10px] text-zinc-500">Add an AI agent to the network</p>
            </div>
          </div>
          <button
            onClick={!isProvisioning ? onClose : undefined}
            className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-colors ${isProvisioning ? "opacity-30 cursor-not-allowed" : ""}`}
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Emoji picker */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Avatar
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all duration-200 ${
                    emoji === e
                      ? "bg-indigo-500/20 ring-2 ring-indigo-500 scale-110"
                      : "bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Name & Role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Atlas"
                disabled={isProvisioning}
                className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                Role *
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Growth Hacker"
                disabled={isProvisioning}
                className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
                required
              />
            </div>
          </div>

          {/* Role Template */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Role Template
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'sales', label: '💰 Sales', desc: 'Revenue & conversion' },
                { id: 'support', label: '🎧 Support', desc: 'Customer issues' },
                { id: 'dev', label: '⌨️ Dev', desc: 'Code & deploys' },
                { id: 'ops', label: '📡 Ops', desc: 'Monitoring & metrics' },
                { id: 'marketing', label: '📣 Marketing', desc: 'Content & growth' },
                { id: 'custom', label: '⚙️ Custom', desc: 'Define your own' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRoleTemplate(t.id)}
                  disabled={isProvisioning}
                  className={`px-2 py-1.5 rounded-lg text-left transition-all ${
                    roleTemplate === t.id
                      ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50 border border-indigo-500/30'
                      : 'bg-zinc-800/50 border border-zinc-700/30 hover:bg-zinc-700/50'
                  }`}
                >
                  <span className="text-xs font-medium text-zinc-200">{t.label}</span>
                  <p className="text-[9px] text-zinc-500">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Purpose
            </label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What does this agent do?"
              rows={2}
              disabled={isProvisioning}
              className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none disabled:opacity-50"
            />
          </div>

          {/* Specialties */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
              Specialties
              <span className="text-zinc-600 normal-case font-normal ml-1">
                (comma separated)
              </span>
            </label>
            <input
              type="text"
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              placeholder="e.g. SEO, Content Marketing, Analytics"
              disabled={isProvisioning}
              className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
            />
          </div>

          {/* Parent Agent & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                Reports To
              </label>
              <select
                value={parentId || ""}
                onChange={(e) => setParentId(e.target.value || null)}
                disabled={isProvisioning}
                className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
              >
                <option value="">None (Top Level)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AgentStatus)}
                disabled={isProvisioning}
                className="w-full px-3 py-2 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
              >
                <option value="online">🟢 Online</option>
                <option value="busy">🟡 Busy</option>
                <option value="offline">⚫ Offline</option>
              </select>
            </div>
          </div>

          {/* Auto-Provision Section */}
          <div className="border border-zinc-700/50 rounded-xl overflow-hidden">
            {/* Toggle */}
            <button
              type="button"
              onClick={() => {
                if (!isProvisioning) {
                  setAutoProvision(!autoProvision);
                  setShowProvisioningOptions(!autoProvision);
                }
              }}
              className={`w-full flex items-center justify-between px-4 py-3 transition-all duration-300 ${
                autoProvision
                  ? "bg-indigo-500/10 border-b border-indigo-500/20"
                  : "bg-zinc-800/30 hover:bg-zinc-800/50"
              } ${isProvisioning ? "cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <Rocket className={`w-4 h-4 transition-colors ${autoProvision ? "text-indigo-400" : "text-zinc-500"}`} />
                <div className="text-left">
                  <span className={`text-xs font-semibold ${autoProvision ? "text-indigo-300" : "text-zinc-400"}`}>
                    Auto-Provision Infrastructure
                  </span>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    Deploy Railway, email, & Whop automatically
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Toggle switch */}
                <div
                  className={`w-9 h-5 rounded-full transition-all duration-300 relative ${
                    autoProvision ? "bg-indigo-600" : "bg-zinc-700"
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all duration-300 shadow-sm ${
                      autoProvision ? "left-[19px]" : "left-[3px]"
                    }`}
                  />
                </div>
              </div>
            </button>

            {/* Provision Options */}
            {autoProvision && (
              <div className="px-4 py-3 space-y-2 fade-in">
                <button
                  type="button"
                  onClick={() => setShowProvisioningOptions(!showProvisioningOptions)}
                  className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-400 font-medium uppercase tracking-wider transition-colors"
                >
                  {showProvisioningOptions ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Services
                </button>

                {showProvisioningOptions && (
                  <div className="space-y-1.5 fade-in">
                    {/* Railway */}
                    <label
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        provisionRailway
                          ? "bg-indigo-500/10 border-indigo-500/20"
                          : "bg-zinc-800/30 border-zinc-700/30 opacity-60"
                      } ${isProvisioning ? "pointer-events-none" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={provisionRailway}
                        onChange={(e) => setProvisionRailway(e.target.checked)}
                        disabled={isProvisioning}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        provisionRailway ? "bg-indigo-600 border-indigo-600" : "border-zinc-600"
                      }`}>
                        {provisionRailway && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <Server className={`w-3.5 h-3.5 ${provisionRailway ? "text-indigo-400" : "text-zinc-500"}`} />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-zinc-300">Railway Deployment</span>
                        <p className="text-[10px] text-zinc-600">Cloud hosting & auto-deploy</p>
                      </div>
                    </label>

                    {/* Email */}
                    <label
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        provisionEmail
                          ? "bg-indigo-500/10 border-indigo-500/20"
                          : "bg-zinc-800/30 border-zinc-700/30 opacity-60"
                      } ${isProvisioning ? "pointer-events-none" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={provisionEmail}
                        onChange={(e) => setProvisionEmail(e.target.checked)}
                        disabled={isProvisioning}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        provisionEmail ? "bg-indigo-600 border-indigo-600" : "border-zinc-600"
                      }`}>
                        {provisionEmail && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <Mail className={`w-3.5 h-3.5 ${provisionEmail ? "text-indigo-400" : "text-zinc-500"}`} />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-zinc-300">Email Account</span>
                        <p className="text-[10px] text-zinc-600">agent@sparkstudio.bot</p>
                      </div>
                    </label>

                    {/* Whop */}
                    <label
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        provisionWhop
                          ? "bg-indigo-500/10 border-indigo-500/20"
                          : "bg-zinc-800/30 border-zinc-700/30 opacity-60"
                      } ${isProvisioning ? "pointer-events-none" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={provisionWhop}
                        onChange={(e) => setProvisionWhop(e.target.checked)}
                        disabled={isProvisioning}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                        provisionWhop ? "bg-indigo-600 border-indigo-600" : "border-zinc-600"
                      }`}>
                        {provisionWhop && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <ShoppingBag className={`w-3.5 h-3.5 ${provisionWhop ? "text-indigo-400" : "text-zinc-500"}`} />
                      <div className="flex-1">
                        <span className="text-xs font-medium text-zinc-300">Whop Account</span>
                        <p className="text-[10px] text-zinc-600">Marketplace presence</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Provisioning Progress */}
            {provisioningSteps.length > 0 && (
              <div className="px-4 py-3 border-t border-zinc-800/50 space-y-2 fade-in">
                <div className="flex items-center gap-1.5 mb-2">
                  {isProvisioning ? (
                    <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                  ) : provisioningComplete ? (
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-red-400" />
                  )}
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isProvisioning ? "text-amber-400" : provisioningComplete ? "text-green-400" : "text-red-400"
                  }`}>
                    {isProvisioning ? "Provisioning..." : provisioningComplete ? "Provisioning Complete" : "Provisioning Failed"}
                  </span>
                </div>

                {provisioningSteps.map((step) => {
                  const styles = STATUS_STYLES[step.status];
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all duration-500 ${styles.bg} ${styles.border}`}
                    >
                      <div className="flex-shrink-0">{styles.icon}</div>
                      <div className="flex-shrink-0">
                        {STEP_ICONS[step.id]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-medium ${styles.color}`}>
                          {step.label}
                        </span>
                        {step.message && (
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                            {step.message}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {provisioningError && (
                  <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 mt-2">
                    <p className="text-[11px] text-red-400">{provisioningError}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={!isProvisioning ? onClose : undefined}
              disabled={isProvisioning}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-700/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            {autoProvision && !provisioningComplete && !isProvisioning && provisioningSteps.length === 0 ? (
              <button
                type="button"
                disabled={!name.trim() || !role.trim() || isProvisioning}
                onClick={() => {
                  const agentId = name
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "");
                  runProvisioning(agentId);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25"
              >
                <Rocket className="w-4 h-4" />
                Provision Infrastructure
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {provisioningComplete ? "Add to Network" : "Deploy Agent"}
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
