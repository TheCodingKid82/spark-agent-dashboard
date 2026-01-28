import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/messages-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const data = readData();
    const chat = data.chats.find((c) => c.id === chatId);

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const messages = data.messages.filter((m) => m.chatId === chatId);
    return NextResponse.json({ ...chat, messages });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
