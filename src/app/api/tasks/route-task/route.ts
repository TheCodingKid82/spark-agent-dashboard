import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tasks/route-task
 * 
 * Uses the gateway (Henry) to intelligently route a task to the best agent.
 * This replaces keyword matching with AI-powered routing.
 */

const AGENTS = [
  { id: 'atlas', name: 'Atlas', role: 'Head of Announcements', domain: 'Announcements app strategy, conversion, churn, pricing decisions' },
  { id: 'maia', name: 'Maia', role: 'Engineer (Announcements)', domain: 'Announcements app code, bugs, features, deployment' },
  { id: 'apollo', name: 'Apollo', role: 'Head of Agency', domain: 'Client projects, Booked.Travel, Insider Expeditions, Matt communication' },
  { id: 'orpheus', name: 'Orpheus', role: 'Engineer (Client)', domain: 'Client project code, Booked.Travel bugs and features' },
  { id: 'artemis', name: 'Artemis', role: 'Head of Funnels', domain: 'Funnels app strategy, product decisions' },
  { id: 'callisto', name: 'Callisto', role: 'Engineer (Funnels)', domain: 'Funnels app code, architecture, implementation' },
  { id: 'iris', name: 'Iris', role: 'Customer Intelligence', domain: 'Research, customer feedback, churn analysis, competitive analysis' },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, taskId } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const gatewayUrl = process.env.HENRY_GATEWAY_URL;
    const gatewayToken = process.env.HENRY_GATEWAY_TOKEN;

    if (!gatewayUrl || !gatewayToken) {
      // Fallback to simple routing if gateway not configured
      return NextResponse.json({
        success: true,
        assignedTo: null,
        reason: 'Gateway not configured - manual assignment required',
      });
    }

    // Build the routing prompt
    const agentList = AGENTS.map(a => `- ${a.id} (${a.name}): ${a.role} - ${a.domain}`).join('\n');
    
    const routingPrompt = `You are a task router for Spark Studio. Analyze this task and decide which agent should handle it.

TASK:
Title: ${title}
Description: ${description || 'No description'}

AVAILABLE AGENTS:
${agentList}

RULES:
- For strategy/decisions → assign to Head (atlas, apollo, artemis)
- For implementation/bugs/code → assign to Engineer (maia, orpheus, callisto)
- For research/analysis → assign to iris
- If unclear, assign to the relevant Head to triage

Respond with ONLY the agent id (e.g., "atlas" or "maia"). Nothing else.`;

    // Call gateway to route
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        tool: 'sessions_spawn',
        params: {
          task: routingPrompt,
          label: `route-task-${taskId || Date.now()}`,
          cleanup: 'delete',
          timeoutSeconds: 30,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Gateway routing failed:', text);
      return NextResponse.json({
        success: false,
        assignedTo: null,
        error: 'Gateway routing failed',
      });
    }

    const result = await res.json();
    
    // Extract agent ID from response
    const responseText = (result.response || result.result || '').toLowerCase().trim();
    const matchedAgent = AGENTS.find(a => responseText.includes(a.id));
    
    return NextResponse.json({
      success: true,
      assignedTo: matchedAgent?.id || null,
      agentName: matchedAgent?.name || null,
      reason: responseText,
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
