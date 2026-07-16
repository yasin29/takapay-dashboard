// GET /api/data — runs the ingestion pipeline over all configured sources
// and returns the cleaned records plus the full quality report. Cached in
// memory for 5 minutes per server instance; with live source adapters this
// is the knob that decides data freshness.

import { NextResponse } from "next/server";
import { getPipelineResult } from "@/lib/server-data";

// Run the pipeline on request (with the TTL cache in lib/server-data) instead
// of freezing its output into the build — live sources would never update
// otherwise. The same cache backs the chatbot's tools and the report exporter.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPipelineResult(), {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
