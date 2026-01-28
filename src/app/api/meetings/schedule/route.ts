import { NextRequest, NextResponse } from "next/server";
import { readData, writeData } from "@/lib/messages-store";
import type { Chat, Meeting } from "@/types/chat";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, time, attendees, chatId: existingChatId } = body;

    if (!title || !time || !attendees || !Array.isArray(attendees)) {
      return NextResponse.json(
        { error: "title, time, and attendees[] are required" },
        { status: 400 }
      );
    }

    const data = readData();

    // Create a dedicated chat room for the meeting if none provided
    let chatId = existingChatId;
    if (!chatId) {
      const meetingChat: Chat = {
        id: `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `📅 ${title}`,
        type: "meeting",
        members: attendees,
        createdAt: new Date().toISOString(),
        lastMessageAt: null,
      };
      data.chats.push(meetingChat);
      chatId = meetingChat.id;
    }

    const meeting: Meeting = {
      id: `mtg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      time,
      attendees,
      chatId,
      createdAt: new Date().toISOString(),
    };

    data.meetings.push(meeting);
    writeData(data);

    return NextResponse.json(meeting, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
