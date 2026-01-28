export type ChatType = "dm" | "group" | "team" | "meeting";

export interface Chat {
  id: string;
  name: string;
  type: ChatType;
  members: string[];
  createdAt: string;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  chatId: string;
  sender: string;
  content: string;
  timestamp: string;
}

export interface Meeting {
  id: string;
  title: string;
  time: string;
  attendees: string[];
  chatId: string;
  createdAt: string;
}

export interface MessagesData {
  chats: Chat[];
  messages: Message[];
  meetings: Meeting[];
}
