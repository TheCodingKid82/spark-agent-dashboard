import { NextRequest, NextResponse } from 'next/server';

const AGENT_URLS: Record<string, string> = {
  atlas: 'https://atlas-production-25a1.up.railway.app',
  apollo: 'https://apollo-production-04cf.up.railway.app',
  artemis: 'https://artemis-production-6c19.up.railway.app',
  maia: 'https://maia-production-5d78.up.railway.app',
  orpheus: 'https://orpheus-production.up.railway.app',
  callisto: 'https://callisto-production.up.railway.app',
  iris: 'https://iris-production-22ad.up.railway.app',
};

/**
 * GET /api/agents/[agentId]/files?path=HEARTBEAT.md
 * Read a file from an agent's workspace
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path') || 'HEARTBEAT.md';
    
    const agentUrl = AGENT_URLS[agentId];
    if (!agentUrl) {
      return NextResponse.json({ success: false, error: 'Unknown agent' }, { status: 400 });
    }
    
    // Ask agent to read the file
    const response = await fetch(`${agentUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GATEWAY_TOKEN || 'spark-studio-2026'}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [{
          role: 'user',
          content: `Read the file "${filePath}" from your workspace and return ONLY its contents, nothing else. If the file doesn't exist, respond with exactly: FILE_NOT_FOUND`
        }],
      }),
    });
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    if (content.trim() === 'FILE_NOT_FOUND') {
      return NextResponse.json({ 
        success: true, 
        exists: false, 
        content: '# HEARTBEAT.md\n\nNo tasks configured yet.\n',
        path: filePath 
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      exists: true,
      content, 
      path: filePath 
    });
  } catch (error) {
    console.error('Read file error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[agentId]/files
 * Write a file to an agent's workspace
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = await request.json();
    const { path: filePath, content } = body;
    
    if (!filePath || content === undefined) {
      return NextResponse.json(
        { success: false, error: 'path and content required' },
        { status: 400 }
      );
    }
    
    const agentUrl = AGENT_URLS[agentId];
    if (!agentUrl) {
      return NextResponse.json({ success: false, error: 'Unknown agent' }, { status: 400 });
    }
    
    // Ask agent to write the file
    const response = await fetch(`${agentUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GATEWAY_TOKEN || 'spark-studio-2026'}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [{
          role: 'user',
          content: `Write the following content to the file "${filePath}" in your workspace. Overwrite if it exists. After writing, respond with exactly: FILE_WRITTEN

Content to write:
\`\`\`
${content}
\`\`\``
        }],
      }),
    });
    
    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';
    
    return NextResponse.json({ 
      success: responseText.includes('FILE_WRITTEN'),
      path: filePath,
      response: responseText,
    });
  } catch (error) {
    console.error('Write file error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
