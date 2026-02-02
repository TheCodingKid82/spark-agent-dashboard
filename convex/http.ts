import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Helper to parse JSON body
async function parseBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Helper to create response
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Tasks API
http.route({
  path: "/api/tasks",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const assignedTo = url.searchParams.get("assignedTo");
    const createdBy = url.searchParams.get("createdBy");
    const board = url.searchParams.get("board") === "true";
    
    if (board) {
      const boardData = await ctx.runQuery(api.tasks.getBoard, {});
      return jsonResponse({ success: true, board: boardData });
    }
    
    if (status) {
      const tasks = await ctx.runQuery(api.tasks.getByStatus, { status: status as any });
      return jsonResponse({ success: true, tasks, count: tasks.length });
    }
    
    if (assignedTo) {
      const tasks = await ctx.runQuery(api.tasks.getByAssignedTo, { assignedTo });
      return jsonResponse({ success: true, tasks, count: tasks.length });
    }
    
    if (createdBy) {
      const tasks = await ctx.runQuery(api.tasks.getByCreatedBy, { createdBy });
      return jsonResponse({ success: true, tasks, count: tasks.length });
    }
    
    const tasks = await ctx.runQuery(api.tasks.getAll, { limit: 500 });
    return jsonResponse({ success: true, tasks, count: tasks.length });
  }),
});

http.route({
  path: "/api/tasks",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await parseBody(req);
    
    if (!body.title || !body.created_by) {
      return jsonResponse({ success: false, error: "Missing required fields: title, created_by" }, 400);
    }
    
    const taskId = await ctx.runMutation(api.tasks.create, {
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      createdBy: body.created_by,
      assignedTo: body.assigned_to,
      dueDate: body.due_date ? new Date(body.due_date).getTime() : undefined,
      tags: body.tags,
    });
    
    const task = await ctx.runQuery(api.tasks.getById, { id: taskId });
    return jsonResponse({ success: true, task });
  }),
});

// Task Detail API
http.route({
  path: "/api/tasks/:taskId",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const taskId = url.pathname.split("/").pop()!;
    
    // Need to query by _id, but API uses custom IDs
    // Return all tasks and find by custom id field
    const tasks = await ctx.runQuery(api.tasks.getAll, { limit: 1000 });
    const task = tasks.find((t: any) => t._id === taskId || t.id === taskId);
    
    if (!task) {
      return jsonResponse({ success: false, error: "Task not found" }, 404);
    }
    
    const messages = await ctx.runQuery(api.messages.getByTask, { taskId: task._id });
    return jsonResponse({ success: true, task, messages, messageCount: messages.length });
  }),
});

http.route({
  path: "/api/tasks/:taskId",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const taskId = url.pathname.split("/").pop()!;
    const body = await parseBody(req);
    
    // Get tasks to find the Convex _id
    const tasks = await ctx.runQuery(api.tasks.getAll, { limit: 1000 });
    const task = tasks.find((t: any) => t._id === taskId || t.id === taskId);
    
    if (!task) {
      return jsonResponse({ success: false, error: "Task not found" }, 404);
    }
    
    const updatedTask = await ctx.runMutation(api.tasks.update, {
      id: task._id,
      updatedBy: body.updated_by || "system",
      title: body.title,
      description: body.description,
      status: body.status,
      priority: body.priority,
      assignedTo: body.assigned_to,
      dueDate: body.due_date ? new Date(body.due_date).getTime() : undefined,
      tags: body.tags,
    });
    
    return jsonResponse({ success: true, task: updatedTask });
  }),
});

http.route({
  path: "/api/tasks/:taskId",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const taskId = url.pathname.split("/").pop()!;
    
    // Get tasks to find the Convex _id
    const tasks = await ctx.runQuery(api.tasks.getAll, { limit: 1000 });
    const task = tasks.find((t: any) => t._id === taskId || t.id === taskId);
    
    if (!task) {
      return jsonResponse({ success: false, error: "Task not found" }, 404);
    }
    
    await ctx.runMutation(api.tasks.remove, { id: task._id });
    return jsonResponse({ success: true, deleted: taskId });
  }),
});

// Messages API
http.route({
  path: "/api/messages",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    const authorId = url.searchParams.get("authorId");
    
    if (taskId) {
      const messages = await ctx.runQuery(api.messages.getByTask, { taskId: taskId as any });
      return jsonResponse({ success: true, messages });
    }
    
    if (authorId) {
      const messages = await ctx.runQuery(api.messages.getByAuthor, { authorId });
      return jsonResponse({ success: true, messages });
    }
    
    return jsonResponse({ success: false, error: "Missing taskId or authorId" }, 400);
  }),
});

http.route({
  path: "/api/messages",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await parseBody(req);
    
    if (!body.task_id || !body.content || !body.author_id) {
      return jsonResponse({ success: false, error: "Missing required fields: task_id, content, author_id" }, 400);
    }
    
    const messageId = await ctx.runMutation(api.messages.create, {
      taskId: body.task_id,
      authorId: body.author_id,
      authorType: body.author_type || "agent",
      content: body.content,
      messageType: body.message_type,
      parentId: body.parent_id,
    });
    
    const message = await ctx.runQuery(api.messages.getById, { id: messageId });
    return jsonResponse({ success: true, message });
  }),
});

// Activities API
http.route({
  path: "/api/activities",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const actorId = url.searchParams.get("actorId");
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");
    
    let activities;
    if (actorId) {
      activities = await ctx.runQuery(api.activities.getByActor, { actorId, limit });
    } else if (targetType && targetId) {
      activities = await ctx.runQuery(api.activities.getByTarget, { targetType: targetType as any, targetId, limit });
    } else {
      activities = await ctx.runQuery(api.activities.getAll, { limit, offset });
    }
    
    return jsonResponse({ success: true, activities, count: activities.length, hasMore: activities.length === limit });
  }),
});

http.route({
  path: "/api/activities",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await parseBody(req);
    
    if (!body.actor_id || !body.action || !body.target_type || !body.target_id) {
      return jsonResponse({ success: false, error: "Missing required fields" }, 400);
    }
    
    const activityId = await ctx.runMutation(api.activities.create, {
      actorId: body.actor_id,
      actorType: body.actor_type || "agent",
      action: body.action,
      targetType: body.target_type,
      targetId: body.target_id,
      metadata: body.metadata,
    });
    
    return jsonResponse({ success: true, activity: { _id: activityId } });
  }),
});

// Documents API
http.route({
  path: "/api/documents",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    const authorId = url.searchParams.get("authorId");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    
    let documents;
    if (taskId) {
      documents = await ctx.runQuery(api.documents.getByTask, { taskId: taskId as any, limit });
    } else if (authorId) {
      documents = await ctx.runQuery(api.documents.getByAuthor, { authorId, limit });
    } else if (status) {
      documents = await ctx.runQuery(api.documents.getByStatus, { status: status as any, limit });
    } else {
      documents = await ctx.runQuery(api.documents.getAll, { limit });
    }
    
    return jsonResponse({ success: true, documents, count: documents.length });
  }),
});

http.route({
  path: "/api/documents",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await parseBody(req);
    
    if (!body.title || !body.content || !body.author_id) {
      return jsonResponse({ success: false, error: "Missing required fields: title, content, author_id" }, 400);
    }
    
    const documentId = await ctx.runMutation(api.documents.create, {
      title: body.title,
      content: body.content,
      contentType: body.content_type,
      authorId: body.author_id,
      taskId: body.task_id,
      status: body.status,
      tags: body.tags,
    });
    
    const document = await ctx.runQuery(api.documents.getById, { id: documentId });
    return jsonResponse({ success: true, document });
  }),
});

// Document Detail API
http.route({
  path: "/api/documents/:id",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop()!;
    
    // Get all docs and find by _id
    const docs = await ctx.runQuery(api.documents.getAll, { limit: 1000 });
    const doc = docs.find((d: any) => d._id === id);
    
    if (!doc) {
      return jsonResponse({ success: false, error: "Document not found" }, 404);
    }
    
    return jsonResponse({ success: true, document: doc });
  }),
});

http.route({
  path: "/api/documents/:id",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop()!;
    const body = await parseBody(req);
    
    // Get all docs and find by _id
    const docs = await ctx.runQuery(api.documents.getAll, { limit: 1000 });
    const doc = docs.find((d: any) => d._id === id);
    
    if (!doc) {
      return jsonResponse({ success: false, error: "Document not found" }, 404);
    }
    
    const updatedDoc = await ctx.runMutation(api.documents.update, {
      id: doc._id,
      updatedBy: body.updated_by || "system",
      title: body.title,
      content: body.content,
      status: body.status,
      tags: body.tags,
    });
    
    return jsonResponse({ success: true, document: updatedDoc });
  }),
});

http.route({
  path: "/api/documents/:id",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop()!;
    
    // Get all docs and find by _id
    const docs = await ctx.runQuery(api.documents.getAll, { limit: 1000 });
    const doc = docs.find((d: any) => d._id === id);
    
    if (!doc) {
      return jsonResponse({ success: false, error: "Document not found" }, 404);
    }
    
    await ctx.runMutation(api.documents.remove, { id: doc._id });
    return jsonResponse({ success: true, deleted: id });
  }),
});

// Notifications API
http.route({
  path: "/api/notifications",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const recipientId = url.searchParams.get("recipientId");
    const unreadOnly = url.searchParams.get("unread") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "50");
    
    if (!recipientId) {
      return jsonResponse({ success: false, error: "Missing recipientId" }, 400);
    }
    
    const notifications = unreadOnly
      ? await ctx.runQuery(api.notifications.getUnreadByRecipient, { recipientId, limit })
      : await ctx.runQuery(api.notifications.getByRecipient, { recipientId, limit });
    
    const unreadCount = await ctx.runQuery(api.notifications.getUnreadCount, { recipientId });
    
    return jsonResponse({ success: true, notifications, unreadCount });
  }),
});

http.route({
  path: "/api/notifications",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await parseBody(req);
    
    if (!body.recipient_id || !body.type || !body.title || !body.message || !body.target_type || !body.target_id) {
      return jsonResponse({ success: false, error: "Missing required fields" }, 400);
    }
    
    const notificationId = await ctx.runMutation(api.notifications.create, {
      recipientId: body.recipient_id,
      senderId: body.sender_id,
      type: body.type,
      title: body.title,
      message: body.message,
      targetType: body.target_type,
      targetId: body.target_id,
    });
    
    return jsonResponse({ success: true, notification: { _id: notificationId } });
  }),
});

http.route({
  path: "/api/notifications",
  method: "PATCH",
  handler: httpAction(async (ctx, req) => {
    const body = await parseBody(req);
    
    if (body.id) {
      const notification = await ctx.runMutation(api.notifications.markAsRead, { id: body.id });
      return jsonResponse({ success: true, notification });
    } else if (body.recipient_id) {
      const result = await ctx.runMutation(api.notifications.markAllAsRead, { recipientId: body.recipient_id });
      return jsonResponse({ success: true, markedAll: true, ...result });
    }
    
    return jsonResponse({ success: false, error: "Missing id or recipient_id" }, 400);
  }),
});

// Subscriptions API
http.route({
  path: "/api/subscriptions",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const subscriberId = url.searchParams.get("subscriberId");
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");
    
    if (subscriberId) {
      const subscriptions = await ctx.runQuery(api.subscriptions.getBySubscriber, { subscriberId });
      return jsonResponse({ success: true, subscriptions });
    }
    
    if (targetType && targetId) {
      const subscriptions = await ctx.runQuery(api.subscriptions.getByTarget, { 
        targetType: targetType as any, 
        targetId 
      });
      return jsonResponse({ success: true, subscriptions });
    }
    
    return jsonResponse({ success: false, error: "Missing subscriberId or targetType/targetId" }, 400);
  }),
});

http.route({
  path: "/api/subscriptions",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await parseBody(req);
    
    if (!body.subscriber_id || !body.target_type || !body.target_id) {
      return jsonResponse({ success: false, error: "Missing required fields" }, 400);
    }
    
    const subscriptionId = await ctx.runMutation(api.subscriptions.subscribe, {
      subscriberId: body.subscriber_id,
      targetType: body.target_type,
      targetId: body.target_id,
      autoSubscribed: body.auto_subscribed,
    });
    
    return jsonResponse({ success: true, subscription: { _id: subscriptionId } });
  }),
});

http.route({
  path: "/api/subscriptions",
  method: "DELETE",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const subscriberId = url.searchParams.get("subscriberId");
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");
    
    if (id) {
      await ctx.runMutation(api.subscriptions.remove, { id: id as any });
      return jsonResponse({ success: true, deleted: id });
    }
    
    if (subscriberId && targetType && targetId) {
      await ctx.runMutation(api.subscriptions.unsubscribe, {
        subscriberId,
        targetType: targetType as any,
        targetId,
      });
      return jsonResponse({ success: true, deleted: true });
    }
    
    return jsonResponse({ success: false, error: "Missing id or subscriberId/targetType/targetId" }, 400);
  }),
});

export default http;
