// The chatbot's retrieval engine. Everything here is deterministic TypeScript
// over pipeline-cleaned records — the model asks for slices and aggregates via
// tools, and this module computes them exactly. No LLM tokens are spent on
// retrieval, and the model never sees more than a small, relevant slice.

import type { PipelineResult } from "@/pipeline";
import {
  TOPIC_LABELS, actionItems, engagement, launchReadiness, sentimentSplit, topicBreakdown,
  type Post, type Sentiment,
} from "@/lib/data";

/* ---------- BM25 keyword index ----------
   At 660 posts a keyword index answers "find posts about X" instantly and for
   free. Tokenization keeps Bangla script (unicode letter runs), so bilingual
   queries work. The index is rebuilt only when the pipeline result changes. */

const tokenize = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

interface Bm25Index {
  df: Map<string, number>;
  docTokens: Map<number, Map<string, number>>; // post id -> term freq
  docLen: Map<number, number>;
  avgLen: number;
  n: number;
}

function buildIndex(posts: Post[]): Bm25Index {
  const df = new Map<string, number>();
  const docTokens = new Map<number, Map<string, number>>();
  const docLen = new Map<number, number>();
  let totalLen = 0;
  for (const p of posts) {
    const tokens = tokenize(p.text + " " + (TOPIC_LABELS[p.topic] ?? p.topic));
    const tf = new Map<string, number>();
    tokens.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    tf.forEach((_, term) => df.set(term, (df.get(term) ?? 0) + 1));
    docTokens.set(p.id, tf);
    docLen.set(p.id, tokens.length);
    totalLen += tokens.length;
  }
  return { df, docTokens, docLen, avgLen: totalLen / Math.max(posts.length, 1), n: posts.length };
}

let indexCache: { posts: Post[]; index: Bm25Index } | null = null;

const getIndex = (posts: Post[]): Bm25Index => {
  if (!indexCache || indexCache.posts !== posts) indexCache = { posts, index: buildIndex(posts) };
  return indexCache.index;
};

const K1 = 1.4;
const B = 0.75;

export function bm25Scores(posts: Post[], query: string): Map<number, number> {
  const idx = getIndex(posts);
  const scores = new Map<number, number>();
  for (const term of tokenize(query)) {
    const df = idx.df.get(term);
    if (!df) continue;
    const idf = Math.log(1 + (idx.n - df + 0.5) / (df + 0.5));
    for (const [id, tf] of Array.from(idx.docTokens.entries())) {
      const f = tf.get(term);
      if (!f) continue;
      const len = idx.docLen.get(id)!;
      const s = idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (len / idx.avgLen))));
      scores.set(id, (scores.get(id) ?? 0) + s);
    }
  }
  return scores;
}

/* ---------- Structured queries — the tool the model calls most ---------- */

export interface PostQuery {
  topics?: string[];
  sentiments?: Sentiment[];
  platforms?: string[];
  dateFrom?: string; // "YYYY-MM-DD"
  dateTo?: string;
  search?: string;
  limit?: number; // sample posts to include, default 5
}

const pct = (n: number, total: number) => Math.round((100 * n) / Math.max(total, 1));

// Topic arguments arrive from a language model — accept keys ("failed_transaction")
// or labels ("Failed transactions") or loose words ("failed transactions").
const resolveTopic = (raw: string): string | null => {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (t in TOPIC_LABELS) return t;
  const byLabel = Object.entries(TOPIC_LABELS).find(([, label]) => label.toLowerCase() === raw.trim().toLowerCase());
  if (byLabel) return byLabel[0];
  const loose = Object.entries(TOPIC_LABELS).find(
    ([key, label]) => label.toLowerCase().includes(raw.trim().toLowerCase()) || key.includes(t)
  );
  return loose ? loose[0] : null;
};

export function filterPosts(posts: Post[], q: PostQuery): Post[] {
  const topics = q.topics?.map(resolveTopic).filter((t): t is string => t !== null) ?? [];
  let out = posts.filter((p) => {
    const day = p.timestamp.slice(0, 10);
    return (
      (topics.length === 0 || topics.includes(p.topic)) &&
      (!q.sentiments?.length || q.sentiments.includes(p.sentiment)) &&
      (!q.platforms?.length || q.platforms.some((pl) => pl.toLowerCase() === p.platform.toLowerCase())) &&
      (!q.dateFrom || day >= q.dateFrom) &&
      (!q.dateTo || day <= q.dateTo)
    );
  });
  if (q.search?.trim()) {
    const scores = bm25Scores(posts, q.search);
    out = out.filter((p) => scores.has(p.id)).sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  }
  return out;
}

/** Compact, token-efficient summary of a filtered slice — what the model gets back. */
export function summarizeSlice(posts: Post[], all: Post[], q: PostQuery) {
  const matched = filterPosts(all, q);
  const split = sentimentSplit(matched);
  const byTopic = topicBreakdown(matched).slice(0, 6);
  const limit = Math.min(Math.max(q.limit ?? 5, 0), 12);
  const ranked = q.search?.trim() ? matched : [...matched].sort((a, b) => engagement(b) - engagement(a));
  return {
    matched: matched.length,
    of_total: all.length,
    sentiment: {
      positive: split.positive, neutral: split.neutral, negative: split.negative,
      negative_share_pct: pct(split.negative, matched.length),
      positive_share_pct: pct(split.positive, matched.length),
    },
    top_topics: byTopic.map((t) => ({
      topic: TOPIC_LABELS[t.topic] ?? t.topic, posts: t.total,
      negative_pct: pct(t.negative, t.total), positive_pct: pct(t.positive, t.total),
      engagement: t.eng,
    })),
    total_engagement: matched.reduce((s, p) => s + engagement(p), 0),
    sample_posts: ranked.slice(0, limit).map((p) => ({
      date: p.timestamp.slice(0, 10), platform: p.platform,
      topic: TOPIC_LABELS[p.topic] ?? p.topic, sentiment: p.sentiment,
      engagement: engagement(p), text: p.text.length > 220 ? p.text.slice(0, 220) + "…" : p.text,
    })),
  };
}

/* ---------- Period comparison ---------- */

export interface ComparePeriodsArgs {
  periodA: { from: string; to: string };
  periodB: { from: string; to: string };
  topics?: string[];
  sentiments?: Sentiment[];
  platforms?: string[];
}

export function comparePeriods(all: Post[], args: ComparePeriodsArgs) {
  const base: PostQuery = { topics: args.topics, sentiments: args.sentiments, platforms: args.platforms };
  const slice = (from: string, to: string) => {
    const posts = filterPosts(all, { ...base, dateFrom: from, dateTo: to });
    const split = sentimentSplit(posts);
    return {
      posts: posts.length,
      negative: split.negative, positive: split.positive, neutral: split.neutral,
      negative_share_pct: pct(split.negative, posts.length),
      positive_share_pct: pct(split.positive, posts.length),
      engagement: posts.reduce((s, p) => s + engagement(p), 0),
      top_topics: topicBreakdown(posts).slice(0, 5).map((t) => ({
        topic: TOPIC_LABELS[t.topic] ?? t.topic, posts: t.total, negative_pct: pct(t.negative, t.total),
      })),
    };
  };
  const a = slice(args.periodA.from, args.periodA.to);
  const b = slice(args.periodB.from, args.periodB.to);
  return {
    period_a: { ...args.periodA, ...a },
    period_b: { ...args.periodB, ...b },
    delta: {
      posts: a.posts - b.posts,
      negative_share_pts: a.negative_share_pct - b.negative_share_pct,
      positive_share_pts: a.positive_share_pct - b.positive_share_pct,
      engagement: a.engagement - b.engagement,
    },
  };
}

/* ---------- Whole-feed overview — reuses the dashboard's own analytics ---------- */

export function overview(result: PipelineResult) {
  const posts = result.records;
  const split = sentimentSplit(posts);
  const readiness = launchReadiness(posts);
  return {
    data_window: "2026-06-01 to 2026-06-30",
    counted_posts: posts.length,
    platforms: Array.from(new Set(posts.map((p) => p.platform))),
    sentiment: { ...split, negative_share_pct: pct(split.negative, posts.length) },
    topics: topicBreakdown(posts).map((t) => ({
      topic: TOPIC_LABELS[t.topic] ?? t.topic, key: t.topic, posts: t.total,
      negative_pct: pct(t.negative, t.total), positive_pct: pct(t.positive, t.total),
    })),
    what_needs_attention: actionItems(posts).map((a) => ({
      issue: a.label, kind: a.kind, posts: a.total, negative_pct: a.negShare,
    })),
    launch_readiness: {
      verdict: readiness.verdict,
      overall_negative_pct: readiness.negShare,
      blockers: readiness.blockers.map((b) => ({ issue: b.label, posts: b.total, negative_pct: b.negShare })),
    },
    data_quality: {
      raw_records: result.quality.raw_records,
      counted: result.quality.counted_records,
      excluded_off_topic: result.quality.excluded_off_topic,
      removed_duplicates: result.quality.removed_duplicates,
      corrected_sentiment_labels: result.quality.relabeled_sentiment,
    },
  };
}
