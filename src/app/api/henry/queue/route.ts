import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
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

async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }
}

async function getQueue(): Promise<QueueItem[]> {
  await ensureDataDir();
  try {
    const data = await readFile(QUEUE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueueItem[]) {
  await ensureDataDir();
  await writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

// GET - Henry polls for pending requests
export async function GET(request: NextRequest) {
  const queue = await getQueue();
  const status = request.nextUrl.searchParams.get('status') || 'pending';
  
  const filtered = queue.filter(item => item.status === status);
  
  return NextResponse.json({
    ok: true,
    items: filtered,
    total: queue.length
  });
}

// POST - Agents submit requests to Henry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, message } = body;
    
    if (!from || !message) {
      return NextResponse.json({ ok: false, error: 'Missing from or message' }, { status: 400 });
    }
    
    const queue = await getQueue();
    
    const newItem: QueueItem = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      from,
      message,
      timestamp: Date.now(),
      status: 'pending'
    };
    
    queue.push(newItem);
    await saveQueue(queue);
    
    return NextResponse.json({
      ok: true,
      id: newItem.id,
      message: 'Request queued for Henry'
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// PATCH - Henry updates a request (mark as processing/completed, add response)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, response } = body;
    
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    }
    
    const queue = await getQueue();
    const item = queue.find(q => q.id === id);
    
    if (!item) {
      return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 });
    }
    
    if (status) item.status = status;
    if (response) item.response = response;
    
    await saveQueue(queue);
    
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

// DELETE - Clean up old completed requests
export async function DELETE(request: NextRequest) {
  const queue = await getQueue();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();
  
  const filtered = queue.filter(item => 
    item.status !== 'completed' || (now - item.timestamp) < maxAge
  );
  
  await saveQueue(filtered);
  
  return NextResponse.json({
    ok: true,
    removed: queue.length - filtered.length,
    remaining: filtered.length
  });
}
