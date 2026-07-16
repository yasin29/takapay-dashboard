// Data cleaning for the TakaPay take-home.
// Three transparent rules, every change logged to data/quality-report.json:
//   1. Exclude off_topic posts from brand metrics (they mention nothing about TakaPay).
//   2. Remove exact-duplicate texts (copy-paste posts), keeping the earliest.
//   3. Re-label records whose text plainly contradicts both the sentiment label
//      and its score (phrase rules below, one-sided match only — ambiguous stays).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = JSON.parse(readFileSync(join(root, "data", "raw.json"), "utf8"));

// Phrase rules. Deliberately narrow: only unmistakable wording flips a label.
// The mislabels are planted in BOTH scripts — an English-only pass misses the
// Bangla ones (e.g. "এখনো পৌঁছায়নি" = "still hasn't arrived" labeled positive).
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

const matches = (text, phrases) => {
  const t = text.toLowerCase();
  return phrases.filter((p) => t.includes(p));
};

const offTopic = [];
const duplicates = [];
const relabeled = [];
const kept = [];
const seenText = new Map();

const sorted = [...raw].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

for (const rec of sorted) {
  // Rule 1: off-topic noise (traffic, food, exams) wrongly flagged brand_mention=true
  if (rec.topic === "off_topic") {
    offTopic.push({ id: rec.id, text: rec.text });
    continue;
  }
  // Rule 2: exact duplicate text (different authors) — copy-paste, keep earliest
  if (seenText.has(rec.text)) {
    duplicates.push({ id: rec.id, duplicate_of: seenText.get(rec.text), text: rec.text });
    continue;
  }
  seenText.set(rec.text, rec.id);

  // Rule 3: label vs text contradiction (one-sided phrase match only)
  const pos = matches(rec.text, POSITIVE_PHRASES);
  const neg = matches(rec.text, NEGATIVE_PHRASES);
  let out = { ...rec, corrected: false };
  if (pos.length > 0 && neg.length === 0 && rec.sentiment === "negative") {
    out = { ...out, sentiment: "positive", sentiment_score: 100 - rec.sentiment_score, corrected: true };
    relabeled.push({ id: rec.id, from: "negative", to: "positive", score: rec.sentiment_score, evidence: pos, text: rec.text });
  } else if (neg.length > 0 && pos.length === 0 && rec.sentiment === "positive") {
    out = { ...out, sentiment: "negative", sentiment_score: 100 - rec.sentiment_score, corrected: true };
    relabeled.push({ id: rec.id, from: "positive", to: "negative", score: rec.sentiment_score, evidence: neg, text: rec.text });
  }
  kept.push(out);
}

const report = {
  raw_records: raw.length,
  counted_records: kept.length,
  excluded_off_topic: offTopic.length,
  removed_duplicates: duplicates.length,
  relabeled_sentiment: relabeled.length,
  off_topic: offTopic,
  duplicates,
  relabeled,
};

writeFileSync(join(root, "data", "cleaned.json"), JSON.stringify(kept, null, 1));
writeFileSync(join(root, "data", "quality-report.json"), JSON.stringify(report, null, 1));

console.log(`raw: ${raw.length}`);
console.log(`counted: ${kept.length}`);
console.log(`off_topic excluded: ${offTopic.length}`);
console.log(`duplicates removed: ${duplicates.length}`);
console.log(`sentiment re-labeled: ${relabeled.length}`);
for (const r of relabeled) console.log(`  [${r.id}] ${r.from} -> ${r.to} (${r.evidence.join(", ")}): ${r.text.slice(0, 70)}`);
