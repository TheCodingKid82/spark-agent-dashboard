/**
 * Company Knowledge Base
 * 
 * Shared knowledge files that every agent receives.
 * These are pushed to the agent's workspace on first boot.
 */

export function getCompanyMd(): string {
  return `# COMPANY.md - Spark Studio

## Mission
Become the #1 AI-powered holding company in the world.

## Founder
Andrew Weir — youngest entrepreneur to ring the NASDAQ bell. Based in NYC/Florida.

## Business Model
- Build AI-powered software products on the Whop platform
- License products to other agencies and businesses
- Use AI agents to automate operations and scale efficiently

## Revenue
- Primary: Announcements App subscriptions (Whop marketplace)
- Secondary: Booked.Travel licensing to travel agencies
- Pipeline: Funnels App

## Values
- Ship fast, iterate faster
- AI-first operations
- Results over process
- Direct communication
`;
}

export function getProductsMd(): string {
  return `# PRODUCTS.md - Spark Studio Products

## 1. Announcements App (PRIMARY)
- **What:** #1 third-party app on the Whop platform
- **How it works:** Whop community owners post announcements to their users
- **Revenue model:** Subscriptions sold to end users
- **Target verticals:**
  - Sports betting (picks, alerts)
  - Trading (signals, analysis)
  - Clipping (long-form video → social media clips)
- **Tech stack:** Next.js, app router, Whop SDK
- **Codebase:** announcements-whop-app
- **MRR:** ~$8.5k (growing)
- **Goal:** $100k MRR

### Key Metrics
- Conversion rate: needs improvement (paywall appears too early)
- Churn rate: ~10% target
- Payment success: targeting >80%
- Past due rate: ~35% (needs reduction)

## 2. Booked.Travel
- **What:** Travel agency management platform
- **Client:** Insider Expeditions (paid $8k for build)
- **Plan:** License to other travel agencies (setup fee + monthly recurring)
- **Contact:** Matt (Slack - Insider Expeditions channel)
- **Payments:** Run through Whop

## 3. Funnels App (In Development)
- **What:** AI-powered funnel builder for Whop business owners
- **Lead:** Cale (co-founder)
- **Status:** Under development
`;
}

export function getContactsMd(): string {
  return `# CONTACTS.md - Team & Key Contacts

## Core Team
| Person | Role | How to Reach | Notes |
|--------|------|-------------|-------|
| **Andrew Weir** | Founder | Telegram @thecodingkid | Night owl (10am-5am). Always working. |
| **Cale** | Co-founder | Discord | Working on Funnels App |
| **Henry** | AI COO | Local gateway | Manager of all agents |

## External Contacts
| Person | Company | How to Reach | Notes |
|--------|---------|-------------|-------|
| **Matt** | Insider Expeditions | Slack channel | Booked.Travel client |

## Communication Rules
- **Urgent = tell Andrew immediately** — via Telegram
- **Bug reports from Matt** → handle in Slack, fix ASAP
- **Cale coordination** → Discord
- **Inter-agent comms** → Gateway-to-gateway messaging
`;
}

export function getProcessesMd(): string {
  return `# PROCESSES.md - Standard Operating Procedures

## Bug Reports
1. Receive report (Slack, support ticket, cancellation reason)
2. Reproduce the issue
3. Identify root cause
4. Fix and test locally
5. Deploy to production
6. Verify fix works in production
7. Report back to reporter

## Deployment
1. Code changes committed to GitHub
2. Railway auto-deploys from main branch
3. Verify deployment succeeded in Railway dashboard
4. Test the live site

## Customer Issues
1. Check resolution cases daily
2. Respond within 24 hours
3. If payment issue → check Whop dashboard
4. If app issue → debug and fix
5. If unclear → escalate to Henry or Andrew

## Agent Communication Protocol
- Agents report task completion to Henry
- Henry aggregates and reports to Andrew
- Urgent issues bypass chain → go directly to Andrew
- Daily status updates to Henry at minimum

## Metrics Tracking
- MRR: Check Whop dashboard daily
- Churn: Monitor cancellation reasons
- Conversion: Track paywall interactions
- Payment health: Monitor past-due rate
`;
}

export function getCodebaseMapMd(): string {
  return `# CODEBASE_MAP.md - Repository Guide

## Announcements App
- **Repo:** announcements-whop-app
- **Stack:** Next.js 14, App Router, TypeScript, Tailwind CSS
- **Key directories:**
  - \`app/\` — pages and API routes
  - \`components/\` — React components
  - \`lib/\` — utility functions, API clients
  - \`utils/\` — helper functions
- **Key files:**
  - \`daily-hub-promo-modal.tsx\` — main paywall modal
  - \`feature-hub-paywall.tsx\` — feature paywall
  - \`lib/config/modal-copy.ts\` — copy/messaging config
  - \`post-purchase-upsell-modal.tsx\` — upsell flows
- **Strategy docs:**
  - \`CONVERSION_OPTIMIZATION_PLAN_V2.md\`
  - \`HARD_PAYWALL_PLAN.md\`
  - \`AI_SUPPORT_AGENT_KNOWLEDGE_BASE.md\`

## Booked.Travel
- **Repo:** temp-booked
- **Stack:** Next.js, travel booking platform
- **Client:** Insider Expeditions

## Agent Dashboard (Command Center)
- **Location:** agent-dashboard/
- **Stack:** Next.js, TypeScript
- **Purpose:** Manage the AI agent fleet
- **Key APIs:**
  - \`/api/agents/provision\` — create new agents
  - \`/api/agents\` — list all agents
  - \`/api/agents/:id/status\` — agent health
  - \`/api/agents/:id/message\` — send messages
  - \`/api/agents/:id/tasks\` — assign tasks
`;
}

/**
 * Get all knowledge base files as a map
 */
export function getKnowledgeBaseFiles(): Record<string, string> {
  return {
    'COMPANY.md': getCompanyMd(),
    'PRODUCTS.md': getProductsMd(),
    'CONTACTS.md': getContactsMd(),
    'PROCESSES.md': getProcessesMd(),
    'CODEBASE_MAP.md': getCodebaseMapMd(),
  };
}
