import { NextResponse } from "next/server";
import { readData } from "@/lib/messages-store";

export async function GET() {
  try {
    const data = readData();
    return NextResponse.json(data.meetings);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
