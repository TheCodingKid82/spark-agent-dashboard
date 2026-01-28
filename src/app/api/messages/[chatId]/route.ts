import { NextRequest, NextResponse } from "next/server";
import { readData } from "@/lib/messages-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const data = readData();
    const messages = data.messages.filter((m) => m.chatId === chatId);
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
