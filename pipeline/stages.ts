// Pipeline stages. Each stage takes records, returns the survivors, and logs
// every record it dropped or changed into the quality report. Nothing is
// silent: if a number on the dashboard moved, the report says why.

import type { CleanRecord, QualityReport, RawRecord, Sentiment } from "./types";

const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

/* ---------- Stage 1: validate — the schema gate ----------
   A record that lies about its own shape cannot be trusted about anything
   else. Wrong type, missing field, impossible score → rejected with reason. */

export function validate(records: RawRecord[], report: QualityReport): RawRecord[] {
  const ok: RawRecord[] = [];
  for (const r of records) {
    const reason = invalidReason(r);
    if (reason) {
      report.rejected_invalid++;
      report.rejects.push({ id: r.id, reason });
    } else {
      ok.push(r);
    }
  }
  return ok;
}

function invalidReason(r: RawRecord): string | null {
  if (typeof r.id !== "number") return "id missing or not a number";
  for (const f of ["platform", "timestamp", "author", "text", "language", "topic"]) {
    if (typeof r[f] !== "string" || (r[f] as string).trim() === "") return `${f} missing or empty`;
  }
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(r.timestamp as string)) return "timestamp not parseable";
  if (!SENTIMENTS.includes(r.sentiment as Sentiment)) return `sentiment "${String(r.sentiment)}" not one of ${SENTIMENTS.join("/")}`;
  const score = r.sentiment_score;
  if (typeof score !== "number" || score < 0 || score > 100) return "sentiment_score outside 0-100";
  for (const f of ["reactions", "comments"]) {
    const v = r[f];
    if (typeof v !== "number" || v < 0 || !Number.isFinite(v)) return `${f} not a non-negative number`;
  }
  return null;
}

/* ---------- Stage 2: normalize — one shape for everything ----------
   Sources disagree about details (T vs space in timestamps, stray whitespace,
   boolean-ish strings). Normalize once here so no stage downstream ever
   special-cases a source. */

export function normalize(records: RawRecord[]): CleanRecord[] {
  return records.map((r) => ({
    id: r.id as number,
    platform: (r.platform as string).trim(),
    timestamp: (r.timestamp as string).replace("T", " ").slice(0, 19),
    author: (r.author as string).trim(),
    text: (r.text as string).trim(),
    language: (r.language as string).trim().toLowerCase(),
    brand_mention: r.brand_mention === true || r.brand_mention === "True" || r.brand_mention === "true",
    sentiment: r.sentiment as Sentiment,
    sentiment_score: r.sentiment_score as number,
    topic: (r.topic as string).trim(),
    reactions: r.reactions as number,
    comments: r.comments as number,
    corrected: false,
  }));
}

/* ---------- Stage 3: dedupe — copy-paste posts count once ----------
   Identical text from different authors inflates every count it touches.
   Keep the earliest, log the rest. */

export function dedupe(records: CleanRecord[], report: QualityReport): CleanRecord[] {
  const seen = new Map<string, number>();
  const ok: CleanRecord[] = [];
  const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const r of sorted) {
    const prior = seen.get(r.text);
    if (prior !== undefined) {
      report.removed_duplicates++;
      report.duplicates.push({ id: r.id, duplicate_of: prior, text: r.text });
    } else {
      seen.set(r.text, r.id);
      ok.push(r);
    }
  }
  return ok;
}

/* ---------- Stage 4: relevance — off-topic noise out of brand metrics ----------
   Posts about traffic, food, and exams arrive flagged brand_mention=true.
   Counting them poisons the sentiment picture. */

export function relevance(records: CleanRecord[], report: QualityReport): CleanRecord[] {
  const ok: CleanRecord[] = [];
  for (const r of records) {
    if (r.topic === "off_topic") {
      report.excluded_off_topic++;
      report.off_topic.push({ id: r.id, text: r.text });
    } else {
      ok.push(r);
    }
  }
  return ok;
}

/* ---------- Stage 5: sentiment audit — labels must match the words ----------
   The provided labels are wrong on a slice of records, in BOTH scripts:
   English/Banglish praise labeled negative, Bangla complaints labeled
   positive ("এখনো পৌঁছায়নি" = "still hasn't arrived"). Narrow, one-sided
   phrase rules flip only unmistakable contradictions; ambiguous text is
   left alone. Every flip is logged with its evidence. */

const POSITIVE_PHRASES = [
  "before i finished my tea", "darun", "joss", "impressed", "never failed",
  "problem solve kore dilo", "dhonnobad", "thanks a lot", "valo laglo",
  "cashback pelam", "love this app", "khub valo service",
  "সাথে সাথে চলে গেল", "দারুণ", "ভালো লাগলো",
];
const NEGATIVE_PHRASES = [
  "transaction fail", "fail holo", "atke ache", "atke achi", "kete nilo",
  "katlo but", "pay nai", "response nai", "pending!", "dhore pending",
  "fraud", "scam", "hoyrani", "bhoganti", "crash", "otp ash", "fix koro",
  "refund pai nai", "taka gayeb",
  "পৌঁছায়নি", "আটকে", "হেল্প নেই", "রিচার্জ হয়নি", "কেটে নিয়েছে কিন্তু",
  "টাকা গায়েব", "প্রতারণা",
];

const matches = (text: string, phrases: string[]) => {
  const t = text.toLowerCase();
  return phrases.filter((p) => t.includes(p));
};

export function sentimentAudit(records: CleanRecord[], report: QualityReport): CleanRecord[] {
  return records.map((r) => {
    const pos = matches(r.text, POSITIVE_PHRASES);
    const neg = matches(r.text, NEGATIVE_PHRASES);
    if (pos.length > 0 && neg.length === 0 && r.sentiment === "negative") {
      report.relabeled_sentiment++;
      report.relabeled.push({ id: r.id, from: "negative", to: "positive", score: r.sentiment_score, evidence: pos, text: r.text });
      return { ...r, sentiment: "positive" as Sentiment, sentiment_score: 100 - r.sentiment_score, corrected: true };
    }
    if (neg.length > 0 && pos.length === 0 && r.sentiment === "positive") {
      report.relabeled_sentiment++;
      report.relabeled.push({ id: r.id, from: "positive", to: "negative", score: r.sentiment_score, evidence: neg, text: r.text });
      return { ...r, sentiment: "negative" as Sentiment, sentiment_score: 100 - r.sentiment_score, corrected: true };
    }
    return r;
  });
}
