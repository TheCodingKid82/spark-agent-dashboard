import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tasks/route-task
 * 
 * Routes tasks to agents using keyword matching.
 * Fast and reliable - no external dependencies.
 */

const AGENTS = [
  { id: 'atlas', name: 'Atlas', role: 'Head of Announcements', keywords: ['announcements', 'conversion', 'churn', 'pricing', 'mrr', 'subscription', 'paywall', 'whop'] },
  { id: 'maia', name: 'Maia', role: 'Engineer (Announcements)', keywords: ['bug', 'fix', 'deploy', 'code', 'error', 'crash', 'feature', 'implement'] },
  { id: 'apollo', name: 'Apollo', role: 'Head of Agency', keywords: ['client', 'booked', 'travel', 'insider', 'expeditions', 'matt', 'agency'] },
  { id: 'orpheus', name: 'Orpheus', role: 'Engineer (Client)', keywords: ['booked bug', 'travel fix', 'client code'] },
  { id: 'artemis', name: 'Artemis', role: 'Head of Funnels', keywords: ['funnel', 'funnels', 'landing', 'page builder'] },
  { id: 'callisto', name: 'Callisto', role: 'Engineer (Funnels)', keywords: ['funnel bug', 'funnel code', 'funnel feature'] },
  { id: 'iris', name: 'Iris', role: 'Customer Intelligence', keywords: ['research', 'feedback', 'survey', 'analyze', 'customer', 'competitor', 'market'] },
];

// Priority order for matching (Heads first for ambiguous tasks)
const PRIORITY_ORDER = ['atlas', 'apollo', 'artemis', 'maia', 'orpheus', 'callisto', 'iris'];

function routeTask(title: string, description?: string): { agentId: string; agentName: string; reason: string } | null {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // Score each agent based on keyword matches
  const scores: { agent: typeof AGENTS[0]; score: number }[] = [];
  
  for (const agent of AGENTS) {
    let score = 0;
    for (const keyword of agent.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += keyword.includes(' ') ? 3 : 1; // Multi-word matches score higher
      }
    }
    if (score > 0) {
      scores.push({ agent, score });
    }
  }
  
  if (scores.length === 0) {
    // Default to Atlas (Head of primary product) for unmatched tasks
    const defaultAgent = AGENTS.find(a => a.id === 'atlas')!;
    return {
      agentId: defaultAgent.id,
      agentName: defaultAgent.name,
      reason: 'Default assignment (no keyword match)',
    };
  }
  
  // Sort by score (desc), then by priority order
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return PRIORITY_ORDER.indexOf(a.agent.id) - PRIORITY_ORDER.indexOf(b.agent.id);
  });
  
  const best = scores[0];
  return {
    agentId: best.agent.id,
    agentName: best.agent.name,
    reason: `Matched keywords for ${best.agent.role}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, taskId } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const result = routeTask(title, description);
    
    if (!result) {
      return NextResponse.json({
        success: true,
        assignedTo: null,
        reason: 'Could not determine assignment',
        taskId,
      });
    }

    return NextResponse.json({
      success: true,
      assignedTo: result.agentId,
      agentName: result.agentName,
      reason: result.reason,
      taskId,
    });

  } catch (error) {
    console.error('Route task error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
