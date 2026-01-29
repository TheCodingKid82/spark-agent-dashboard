import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const QUEUE_FILE = path.join(process.cwd(), 'data', 'henry-queue.json');

interface QueueItem {
  id: string;
  from: string;
  message: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed';
  response?: string;
}

async function getQueue(): Promise<QueueItem[]> {
  try {
    const data = await readFile(QUEUE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// GET - Agent checks if their request has been handled
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const queue = await getQueue();
  const item = queue.find(q => q.id === requestId);
  
  if (!item) {
    return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 });
  }
  
  return NextResponse.json({
    ok: true,
    status: item.status,
    response: item.response || null,
    timestamp: item.timestamp
  });
}
