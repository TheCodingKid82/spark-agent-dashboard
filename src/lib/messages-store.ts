import fs from "fs";
import path from "path";
import type { MessagesData } from "@/types/chat";

const DATA_PATH = path.join(process.cwd(), "src", "data", "messages.json");

export function readData(): MessagesData {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as MessagesData;
}

export function writeData(data: MessagesData): void {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}
