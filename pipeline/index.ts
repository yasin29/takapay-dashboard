// The pipeline: sources → validate → normalize → dedupe → relevance →
// sentiment audit → { records, quality }. The dashboard only ever renders
// what comes out of here, so what it shows is accurate by construction —
// and the quality report says exactly what was excluded or corrected, why,
// with per-record evidence.

import { defaultSources, type Source } from "./sources";
import { dedupe, normalize, relevance, sentimentAudit, validate } from "./stages";
import { emptyReport, type CleanRecord, type QualityReport, type RawRecord } from "./types";

export interface PipelineResult {
  records: CleanRecord[];
  quality: QualityReport;
}

export async function runPipeline(sources: Source[] = defaultSources): Promise<PipelineResult> {
  const report = emptyReport();

  const raw: RawRecord[] = [];
  for (const source of sources) {
    const fetched = await source.fetch();
    report.sources.push({ name: source.name, fetched: fetched.length });
    raw.push(...fetched);
  }
  report.raw_records = raw.length;

  const valid = validate(raw, report);
  const normalized = normalize(valid);
  const unique = dedupe(normalized, report);
  const relevant = relevance(unique, report);
  const audited = sentimentAudit(relevant, report);

  report.counted_records = audited.length;
  return { records: audited, quality: report };
}

export type { CleanRecord, QualityReport, Sentiment } from "./types";
