// Agent schedule utilities for determining running/next states

interface AgentSchedule {
  id: string;
  cronMinutes: number[];  // e.g., [2, 17, 32, 47]
}

// Parse cron pattern like "2,17,32,47 * * * *" into minute array
export function parseCronMinutes(cron: string): number[] {
  const minutePart = cron.split(' ')[0];
  return minutePart.split(',').map(m => parseInt(m, 10));
}

// Get next run time for an agent
export function getNextRunTime(cronMinutes: number[]): Date {
  const now = new Date();
  const currentMinute = now.getMinutes();
  
  // Find the next minute in the schedule
  let nextMinute = cronMinutes.find(m => m > currentMinute);
  
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  if (nextMinute !== undefined) {
    // Next run is in this hour
    next.setMinutes(nextMinute);
  } else {
    // Next run is in the next hour (first minute in schedule)
    next.setHours(now.getHours() + 1);
    next.setMinutes(cronMinutes[0]);
  }
  
  return next;
}

// Check if agent is currently running (within 1 minute of scheduled time)
export function isCurrentlyRunning(cronMinutes: number[]): boolean {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  
  // Consider "running" if we're within the scheduled minute (0-59 seconds)
  return cronMinutes.includes(currentMinute);
}

// Get time until next run in human-readable format
export function getTimeUntilRun(nextRun: Date): string {
  const now = new Date();
  const diffMs = nextRun.getTime() - now.getTime();
  const diffMinutes = Math.ceil(diffMs / 60000);
  
  if (diffMinutes <= 0) return 'now';
  if (diffMinutes === 1) return 'in 1 min';
  if (diffMinutes < 60) return `in ${diffMinutes} min`;
  
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  if (mins === 0) return `in ${hours}h`;
  return `in ${hours}h ${mins}m`;
}

// Format next run time
export function formatNextRunTime(nextRun: Date): string {
  return nextRun.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export interface AgentRunStatus {
  isRunning: boolean;
  isNext: boolean;
  nextRunTime: Date;
  timeUntil: string;
  formattedTime: string;
}

// Calculate status for all agents
export function calculateAgentStatuses(
  agents: Array<{ id: string; heartbeatCron?: string }>
): Map<string, AgentRunStatus> {
  const statuses = new Map<string, AgentRunStatus>();
  
  // First pass: calculate next run times for all agents
  const agentTimes: Array<{ id: string; nextRun: Date; cronMinutes: number[] }> = [];
  
  for (const agent of agents) {
    if (!agent.heartbeatCron) continue;
    
    const cronMinutes = parseCronMinutes(agent.heartbeatCron);
    const nextRun = getNextRunTime(cronMinutes);
    const isRunning = isCurrentlyRunning(cronMinutes);
    
    agentTimes.push({ id: agent.id, nextRun, cronMinutes });
    
    statuses.set(agent.id, {
      isRunning,
      isNext: false,
      nextRunTime: nextRun,
      timeUntil: getTimeUntilRun(nextRun),
      formattedTime: formatNextRunTime(nextRun),
    });
  }
  
  // Second pass: find the next agent (earliest next run time, excluding currently running)
  const notRunning = agentTimes.filter(a => !statuses.get(a.id)?.isRunning);
  if (notRunning.length > 0) {
    notRunning.sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());
    const nextAgent = notRunning[0];
    const status = statuses.get(nextAgent.id);
    if (status) {
      status.isNext = true;
    }
  }
  
  return statuses;
}
