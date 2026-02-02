// Stub: Chat store migrated to Convex
export async function saveMessage(_message?: any) {}
export async function getMessages(_agentId?: string, _limit?: number) { return []; }
export async function getConversation(_agentId?: string, _userId?: string) { return { messages: [] }; }
export async function registerAgent(_agent?: any) {}
export async function getAgent(_agentId?: string) { return null; }
export async function getAllAgents() { return []; }
export async function updateAgentStatus(_agentId?: string, _status?: string) {}
export async function heartbeat(_agentId?: string) {}
export async function getTeamMessages(_limit?: number) { return []; }
export async function saveTeamMessage(_message?: any) {}
export function getOnlineAgentCount() { return 0; }
export async function getAllMessages(_limit?: number) { return []; }
export async function getBroadcastMessages(_limit?: number) { return []; }
export async function getConversations(_agentId?: string) { return []; }
export async function addMessage(_message?: any) {}
export async function removeAgent(_agentId?: string) {}
export async function getGroupChatMessages(_groupId?: string, _since?: number) { return []; }
