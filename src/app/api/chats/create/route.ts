import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/messages-store";
import type { Chat } from "@/types/chat";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, members } = body;

    if (!name || !type || !members || !Array.isArray(members)) {
      return NextResponse.json(
        { error: "name, type, and members[] are required" },
        { status: 400 }
      );
    }

    const data = readData();

    const chat: Chat = {
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      type,
      members,
      createdAt: new Date().toISOString(),
      lastMessageAt: null,
    };

    data.chats.push(chat);
    writeData(data);

    return NextResponse.json(chat, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
