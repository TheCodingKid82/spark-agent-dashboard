import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/messages-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sender, chatId, content } = body;

    if (!sender || !chatId || !content) {
      return NextResponse.json(
        { error: "sender, chatId, and content are required" },
        { status: 400 }
      );
    }

    const data = readData();

    const chat = data.chats.find((c) => c.id === chatId);
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      chatId,
      sender,
      content,
      timestamp: new Date().toISOString(),
    };

    data.messages.push(message);
    chat.lastMessageAt = message.timestamp;

    writeData(data);

    return NextResponse.json(message, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
