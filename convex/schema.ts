import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    id: v.string(),
    name: v.string(),
    role: v.string(),
    emoji: v.optional(v.string()),
    status: v.string(),
    purpose: v.optional(v.string()),
    specialties: v.optional(v.array(v.string())),
    parentId: v.optional(v.string()),
    reportsTo: v.optional(v.string()),
    level: v.string(),
    workspace: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    heartbeatCron: v.optional(v.string()),
    tools: v.optional(v.array(v.string())),
  })
    .index("by_agent_id", ["id"])
    .index("by_status", ["status"])
    .index("by_reports_to", ["reportsTo"]),

  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("inbox"), v.literal("assigned"), v.literal("in_progress"), v.literal("review"), v.literal("done")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    createdBy: v.string(),
    assignedTo: v.optional(v.string()),
    dueDate: v.optional(v.number()), // timestamp
    tags: v.optional(v.array(v.string())),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_created_by", ["createdBy"]),

  messages: defineTable({
    taskId: v.optional(v.id("tasks")),
    authorId: v.string(),
    authorType: v.union(v.literal("agent"), v.literal("human")),
    content: v.string(),
    messageType: v.union(v.literal("comment"), v.literal("system"), v.literal("activity")),
    parentId: v.optional(v.id("messages")),
    mentions: v.optional(v.array(v.string())),
  })
    .index("by_task", ["taskId"])
    .index("by_author", ["authorId"]),

  activities: defineTable({
    actorId: v.string(),
    actorType: v.union(v.literal("agent"), v.literal("human"), v.literal("system")),
    action: v.string(),
    targetType: v.union(v.literal("task"), v.literal("message"), v.literal("document"), v.literal("agent")),
    targetId: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_actor", ["actorId"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_time", ["_creationTime"]),

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    contentType: v.union(v.literal("markdown"), v.literal("text"), v.literal("json")),
    authorId: v.string(),
    taskId: v.optional(v.id("tasks")),
    status: v.union(v.literal("draft"), v.literal("in_review"), v.literal("approved"), v.literal("archived")),
    version: v.number(),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_task", ["taskId"])
    .index("by_author", ["authorId"])
    .index("by_status", ["status"]),

  notifications: defineTable({
    recipientId: v.string(),
    senderId: v.optional(v.string()),
    type: v.union(v.literal("mention"), v.literal("assignment"), v.literal("comment"), v.literal("status_change"), v.literal("system")),
    title: v.string(),
    message: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    read: v.boolean(),
  })
    .index("by_recipient", ["recipientId"])
    .index("by_recipient_read", ["recipientId", "read"]),

  subscriptions: defineTable({
    subscriberId: v.string(),
    targetType: v.union(v.literal("task"), v.literal("document")),
    targetId: v.string(),
    autoSubscribed: v.boolean(),
  })
    .index("by_subscriber", ["subscriberId"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_unique", ["subscriberId", "targetType", "targetId"]),
});
