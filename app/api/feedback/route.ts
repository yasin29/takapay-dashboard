// POST /api/feedback — the learning loop's input. Stores 👍/👎 (+ comment)
// against an answer; a 👎 also evicts that question's cached answer so the
// assistant re-derives it next time, with the negative feedback surfaced to
// the model via search_learnings.

import { NextResponse } from "next/server";
import { recordFeedback } from "@/lib/learnings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { question?: string; answer?: string; verdict?: string; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { question, answer, verdict, comment } = body;
  if (!question || !answer || (verdict !== "up" && verdict !== "down")) {
    return NextResponse.json({ error: "Required: question, answer, verdict ('up'|'down')" }, { status: 400 });
  }
  await recordFeedback({ question, answer, verdict, comment: comment?.slice(0, 500) });
  return NextResponse.json({ ok: true });
}
