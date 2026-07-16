// GET /api/data — runs the ingestion pipeline over all configured sources
// and returns the cleaned records plus the full quality report. Cached in
// memory for 5 minutes per server instance; with live source adapters this
// is the knob that decides data freshness.

import { NextResponse } from "next/server";
import { runPipeline, type PipelineResult } from "@/pipeline";

// Run the pipeline on request (with the TTL cache below) instead of freezing
// its output into the build — live sources would never update otherwise.
export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; result: PipelineResult } | null = null;

export async function GET() {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    cache = { at: Date.now(), result: await runPipeline() };
  }
  return NextResponse.json(cache.result, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
