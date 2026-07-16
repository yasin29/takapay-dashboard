// Shared server-side access to the pipeline result. The /api/data route, the
// chatbot's tools, and the report exporter all read from this one cache, so
// every consumer sees the same cleaned, audited records.

import { runPipeline, type PipelineResult } from "@/pipeline";

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; result: PipelineResult } | null = null;

export async function getPipelineResult(): Promise<PipelineResult> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    cache = { at: Date.now(), result: await runPipeline() };
  }
  return cache.result;
}
