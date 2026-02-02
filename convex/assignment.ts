import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Auto-assignment logic for Mission Control
 * Analyzes task content and assigns to the best-fit agent
 */

// Agent domain keywords for matching
const AGENT_DOMAINS: Record<string, { keywords: string[]; priority: number }> = {
  atlas: {
    keywords: [
      "announcements", "whop", "conversion", "churn", "mrr", "paywall",
      "feature pack", "viral clips", "subscription", "pricing", "retention",
      "onboarding", "trial", "cancellation", "dashboard"
    ],
    priority: 1, // Lead - gets first pick
  },
  maia: {
    keywords: [
      "announcements", "whop", "bug", "fix", "implement", "code", "deploy",
      "feature", "ui", "component", "api", "endpoint", "frontend"
    ],
    priority: 2, // Engineer - gets implementation tasks
  },
  apollo: {
    keywords: [
      "booked", "travel", "insider expeditions", "matt", "client",
      "agency", "project", "deadline", "meeting", "requirement"
    ],
    priority: 1,
  },
  orpheus: {
    keywords: [
      "booked", "travel", "bug", "fix", "implement", "client request",
      "feature", "api", "integration"
    ],
    priority: 2,
  },
  artemis: {
    keywords: [
      "funnels", "funnel builder", "landing page", "ai builder",
      "whop sellers", "conversion page", "sales page", "cale"
    ],
    priority: 1,
  },
  callisto: {
    keywords: [
      "funnels", "implement", "build", "architecture", "infrastructure",
      "database", "api", "frontend"
    ],
    priority: 2,
  },
  iris: {
    keywords: [
      "research", "feedback", "customer", "churn analysis", "competitive",
      "user insights", "survey", "review", "g2", "support ticket",
      "cancellation reason", "why users"
    ],
    priority: 1,
  },
};

// Calculate match score for an agent
function calculateMatchScore(
  taskText: string,
  agentId: string
): number {
  const domain = AGENT_DOMAINS[agentId];
  if (!domain) return 0;

  const text = taskText.toLowerCase();
  let score = 0;

  for (const keyword of domain.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      score += 10; // Base score per keyword match
    }
  }

  // Adjust by priority (leads get slight boost for ambiguous tasks)
  if (domain.priority === 1) {
    score += 5;
  }

  return score;
}

// Find the best agent for a task
export const findBestAgent = query({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const taskText = `${args.title} ${args.description || ""}`;
    
    const scores: { agentId: string; score: number }[] = [];
    
    for (const agentId of Object.keys(AGENT_DOMAINS)) {
      const score = calculateMatchScore(taskText, agentId);
      if (score > 0) {
        scores.push({ agentId, score });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0) {
      // Default to henry for unmatched tasks
      return { agentId: "henry", score: 0, reason: "No domain match - escalating to Henry" };
    }

    const best = scores[0];
    
    // Determine if we should also assign an engineer
    let engineer: string | null = null;
    const leadToEngineer: Record<string, string> = {
      atlas: "maia",
      apollo: "orpheus",
      artemis: "callisto",
    };

    if (leadToEngineer[best.agentId]) {
      // Check if task seems implementation-focused
      const implKeywords = ["fix", "bug", "implement", "build", "code", "deploy"];
      const isImplementation = implKeywords.some(k => taskText.toLowerCase().includes(k));
      
      if (isImplementation) {
        engineer = leadToEngineer[best.agentId];
      }
    }

    return {
      agentId: best.agentId,
      engineerId: engineer,
      score: best.score,
      allScores: scores.slice(0, 3), // Top 3 for debugging
    };
  },
});

// Auto-assign a task based on content
export const autoAssign = mutation({
  args: {
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const taskText = `${task.title} ${task.description || ""}`;
    
    // Calculate scores
    const scores: { agentId: string; score: number }[] = [];
    for (const agentId of Object.keys(AGENT_DOMAINS)) {
      const score = calculateMatchScore(taskText, agentId);
      if (score > 0) {
        scores.push({ agentId, score });
      }
    }
    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0) {
      // No match - leave unassigned for manual review
      return { assigned: false, reason: "No domain match" };
    }

    const best = scores[0];
    
    // Check if engineer should also be assigned
    const leadToEngineer: Record<string, string> = {
      atlas: "maia",
      apollo: "orpheus", 
      artemis: "callisto",
    };
    
    const implKeywords = ["fix", "bug", "implement", "build", "code", "deploy"];
    const isImplementation = implKeywords.some(k => taskText.toLowerCase().includes(k));
    
    let assignee = best.agentId;
    if (isImplementation && leadToEngineer[best.agentId]) {
      assignee = leadToEngineer[best.agentId];
    }

    // Update task
    await ctx.db.patch(args.taskId, {
      assignedTo: assignee,
      status: "assigned",
    });

    // Log activity
    await ctx.db.insert("activities", {
      actorId: "system",
      actorType: "system",
      action: "auto_assigned",
      targetType: "task",
      targetId: args.taskId,
      metadata: {
        assignedTo: assignee,
        score: best.score,
        reason: `Matched domain keywords (score: ${best.score})`,
      },
    });

    // Create notification for assignee
    await ctx.db.insert("notifications", {
      recipientId: assignee,
      senderId: "system",
      type: "assignment",
      title: "New Task Assigned",
      message: `You've been assigned: ${task.title}`,
      targetType: "task",
      targetId: args.taskId,
      read: false,
    });

    return {
      assigned: true,
      assignee,
      score: best.score,
    };
  },
});

// Get undelivered notifications for an agent
export const getUndeliveredNotifications = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_recipient_read", (q) =>
        q.eq("recipientId", args.agentId).eq("read", false)
      )
      .collect();
  },
});

// Mark notification as delivered
export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { read: true });
    return { success: true };
  },
});
