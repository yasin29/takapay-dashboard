// Shared shaping for the report exporter: one function turns the pipeline
// result + a dashboard view state (same URL params as shareable views) into
// the tables both the Excel and PDF renderers consume.

import type { PipelineResult } from "@/pipeline";
import {
  TOPIC_LABELS, actionItems, applyFilters, dailyTrend, engagement, inRange, launchReadiness,
  platformBreakdown, rangeLabel, sentimentSplit, topicBreakdown,
  type Post, type ViewState,
} from "@/lib/data";

export interface ReportData {
  generatedAt: string;
  range: string;
  filterSummary: string;
  kpis: {
    counted: number;
    matched: number;
    positive: number;
    neutral: number;
    negative: number;
    negSharePct: number;
    totalEngagement: number;
    launchVerdict: string;
  };
  actions: { issue: string; kind: string; posts: number; negPct: number; note: string }[];
  topics: { topic: string; total: number; positive: number; neutral: number; negative: number; negPct: number; engagement: number }[];
  platforms: { platform: string; total: number; positive: number; neutral: number; negative: number }[];
  daily: { date: string; positive: number; neutral: number; negative: number }[];
  quality: { metric: string; value: number }[];
  relabeled: { id: number; from: string; to: string; text: string }[];
  posts: Post[];
}

const pct = (n: number, total: number) => Math.round((100 * n) / Math.max(total, 1));

export function buildReportData(result: PipelineResult, view: ViewState): ReportData {
  const all = result.records;
  const matched = applyFilters(all, view.filters).filter((p) => inRange(p, view.range));
  const split = sentimentSplit(matched);
  const readiness = launchReadiness(all);

  const parts: string[] = [];
  if (view.filters.topics.length) parts.push(`topics: ${view.filters.topics.map((t) => TOPIC_LABELS[t] ?? t).join(", ")}`);
  if (view.filters.sentiments.length) parts.push(`sentiment: ${view.filters.sentiments.join(", ")}`);
  if (view.filters.platforms.length) parts.push(`platforms: ${view.filters.platforms.join(", ")}`);
  if (view.filters.query.trim()) parts.push(`search: "${view.filters.query.trim()}"`);

  return {
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
    range: rangeLabel(view.range),
    filterSummary: parts.length ? parts.join(" | ") : "none (full feed)",
    kpis: {
      counted: all.length,
      matched: matched.length,
      positive: split.positive,
      neutral: split.neutral,
      negative: split.negative,
      negSharePct: pct(split.negative, matched.length),
      totalEngagement: matched.reduce((s, p) => s + engagement(p), 0),
      launchVerdict: readiness.verdict,
    },
    actions: actionItems(all).map((a) => ({
      issue: a.label, kind: a.kind, posts: a.total, negPct: a.negShare, note: a.note,
    })),
    topics: topicBreakdown(matched).map((t) => ({
      topic: TOPIC_LABELS[t.topic] ?? t.topic, total: t.total,
      positive: t.positive, neutral: t.neutral, negative: t.negative,
      negPct: pct(t.negative, t.total), engagement: t.eng,
    })),
    platforms: platformBreakdown(matched),
    daily: dailyTrend(matched).map((d) => ({ date: `Jun ${d.date}`, positive: d.positive, neutral: d.neutral, negative: d.negative })),
    quality: [
      { metric: "Raw records fetched", value: result.quality.raw_records },
      { metric: "Counted after cleaning", value: result.quality.counted_records },
      { metric: "Rejected (invalid)", value: result.quality.rejected_invalid },
      { metric: "Excluded (off-topic)", value: result.quality.excluded_off_topic },
      { metric: "Removed (duplicates)", value: result.quality.removed_duplicates },
      { metric: "Sentiment labels corrected", value: result.quality.relabeled_sentiment },
    ],
    relabeled: result.quality.relabeled.map((r) => ({ id: r.id, from: r.from, to: r.to, text: r.text })),
    posts: [...matched].sort((a, b) => engagement(b) - engagement(a)),
  };
}
