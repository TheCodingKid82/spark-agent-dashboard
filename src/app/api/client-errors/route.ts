import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.error("[CLIENT_ERROR]", JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[CLIENT_ERROR] parse_failed", e);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
