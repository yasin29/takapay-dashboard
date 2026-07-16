// Aggregation helpers for the dashboard. All of them operate on records that
// already came through the pipeline (/api/data) — nothing here re-cleans.

import type { CleanRecord, QualityReport, Sentiment } from "@/pipeline/types";

export type Post = CleanRecord;
export type { QualityReport, Sentiment };

export const TOPIC_LABELS: Record<string, string> = {
  failed_transaction: "Failed transactions",
  competitor: "Competitor (NgoodPay)",
  cashback_offer: "Cashback offers",
  send_money: "Send money",
  recharge: "Mobile recharge",
  charges_fees: "Charges & fees",
  agent_network: "Agent network",
  bill_payment: "Bill payment",
  feature_query: "Feature questions",
  customer_care: "Customer care",
  app_crash: "App crashes",
  login_otp: "Login & OTP",
  app_experience: "App experience",
  product_news: "Product news",
};

export const LANGUAGE_LABELS: Record<string, string> = {
  "bn-en": "Banglish (mixed)",
  bn: "Bangla",
  en: "English",
};

export const SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

// DeepDive series colors, sampled from their product mocks: teal / purple / sky
export const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: "#2EA093",
  neutral: "#602494",
  negative: "#0FB7E6",
};

// Status-chip colors — DeepDive styles table sentiment as green/red/gray pills,
// deliberately distinct from the chart series palette above
export const SENTIMENT_CHIP: Record<Sentiment, { bg: string; border: string; text: string }> = {
  positive: { bg: "#ECFDF3", border: "#ABEFC6", text: "#067647" },
  negative: { bg: "#FEF3F2", border: "#FECDCA", text: "#B42318" },
  neutral: { bg: "#F4F4F5", border: "#E0DFE3", text: "#56535E" },
};

export interface Filters {
  sentiments: Sentiment[];
  topics: string[];
  platforms: string[];
}

export const engagement = (p: Post) => p.reactions + p.comments;

export function applyFilters(posts: Post[], f: Filters): Post[] {
  return posts.filter(
    (p) =>
      (f.sentiments.length === 0 || f.sentiments.includes(p.sentiment)) &&
      (f.topics.length === 0 || f.topics.includes(p.topic)) &&
      (f.platforms.length === 0 || f.platforms.includes(p.platform))
  );
}

export function sentimentSplit(posts: Post[]) {
  const c: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  posts.forEach((p) => c[p.sentiment]++);
  return c;
}

export function dailyTrend(posts: Post[]) {
  const days = new Map<string, Record<Sentiment, number>>();
  for (const p of posts) {
    const d = p.timestamp.slice(0, 10);
    if (!days.has(d)) days.set(d, { positive: 0, neutral: 0, negative: 0 });
    days.get(d)![p.sentiment]++;
  }
  return [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, c]) => ({ date: date.slice(8), ...c }));
}

export function topicBreakdown(posts: Post[]) {
  const t = new Map<string, { topic: string; positive: number; neutral: number; negative: number; total: number; eng: number; reactions: number; comments: number }>();
  for (const p of posts) {
    if (!t.has(p.topic)) t.set(p.topic, { topic: p.topic, positive: 0, neutral: 0, negative: 0, total: 0, eng: 0, reactions: 0, comments: 0 });
    const row = t.get(p.topic)!;
    row[p.sentiment]++;
    row.total++;
    row.eng += engagement(p);
    row.reactions += p.reactions;
    row.comments += p.comments;
  }
  return [...t.values()].sort((a, b) => b.total - a.total);
}

/* ---------- Topic groups — how a brand manager slices the conversation ---------- */

export const TOPIC_GROUPS: { name: string; topics: string[] }[] = [
  { name: "Transactions & money movement", topics: ["failed_transaction", "send_money", "bill_payment", "recharge", "charges_fees"] },
  { name: "App & website", topics: ["app_crash", "login_otp", "app_experience", "feature_query"] },
  { name: "Customer care & agents", topics: ["customer_care", "agent_network"] },
  { name: "Offers & news", topics: ["cashback_offer", "product_news", "competitor"] },
];

/* ---------- Repeated complaints — near-identical wording across accounts ----------
   Numbers, operator names, family words, and area names are template slots;
   masking them exposes how many posts are the same message written again
   and again. High repetition = systemic issue (or seeded posting). */

export interface RepeatedPattern {
  sample: string;
  count: number;
  topic: string;
  dominant: Sentiment;
  dominantShare: number;
  reactions: number;
  comments: number;
}

const TEMPLATE_TOKENS = /\b(robi|airtel|banglalink|teletalk|grameenphone|ma|baba|bhai|bon|friend|colleague|landlord|amar|motijheel|mohakhali|dhanmondi|uttara|mirpur|gulshan|banani|khulna|chittagong|sylhet|farmgate|bashundhara)\b/gi;
const BANGLA_TOKENS = /মা|বাবা|ভাই|বোন|আমার|bon|bhai/g;

const fingerprint = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\d০-৯]+/g, "#")
    .replace(TEMPLATE_TOKENS, "*")
    .replace(BANGLA_TOKENS, "*")
    .replace(/\s+/g, " ")
    .trim();

export function repeatedPatterns(posts: Post[], minCount = 4): RepeatedPattern[] {
  const groups = new Map<string, Post[]>();
  for (const p of posts) {
    const fp = fingerprint(p.text);
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp)!.push(p);
  }
  const out: RepeatedPattern[] = [];
  for (const members of Array.from(groups.values())) {
    if (members.length < minCount) continue;
    const split = sentimentSplit(members);
    const dominant = (Object.keys(split) as Sentiment[]).sort((a, b) => split[b] - split[a])[0];
    const sample = members.reduce((a, b) => (a.text.length <= b.text.length ? a : b));
    out.push({
      sample: sample.text,
      count: members.length,
      topic: sample.topic,
      dominant,
      dominantShare: Math.round((100 * split[dominant]) / members.length),
      reactions: members.reduce((s, p) => s + p.reactions, 0),
      comments: members.reduce((s, p) => s + p.comments, 0),
    });
  }
  return out.sort((a, b) => b.count - a.count || b.reactions - a.reactions).slice(0, 6);
}

export function platformBreakdown(posts: Post[]) {
  const t = new Map<string, { platform: string; positive: number; neutral: number; negative: number; total: number }>();
  for (const p of posts) {
    if (!t.has(p.platform)) t.set(p.platform, { platform: p.platform, positive: 0, neutral: 0, negative: 0, total: 0 });
    const row = t.get(p.platform)!;
    row[p.sentiment]++;
    row.total++;
  }
  return [...t.values()].sort((a, b) => b.total - a.total);
}

export function languageBreakdown(posts: Post[]) {
  const c = new Map<string, number>();
  posts.forEach((p) => c.set(p.language, (c.get(p.language) ?? 0) + 1));
  return [...c.entries()]
    .map(([lang, n]) => ({ lang: LANGUAGE_LABELS[lang] ?? lang, n }))
    .sort((a, b) => b.n - a.n);
}

// "What needs attention first" — issues ranked by negative volume weighted by
// how much attention each post draws (avg engagement). Competitor is a "watch"
// item, not a "fix" item, so it is carded separately.
export interface ActionItem {
  topic: string;
  label: string;
  kind: "fix" | "watch";
  total: number;
  negShare: number;
  reactions: number;
  comments: number;
  score: number;
  note: string;
}

const ACTION_NOTES: Record<string, string> = {
  failed_transaction:
    "Money left the account but never arrived — a third of everything posted this month, and the most engaged theme. This is the fire: route to payments engineering, and reply publicly on stuck-money threads.",
  charges_fees:
    "People feel charged unfairly and say so with receipts. Review the fee table people complain about most (send-money) and publish a plain-language fee page.",
  login_otp:
    "OTP never arrives, users locked out for hours. Small volume, total blocker when it happens — check the SMS gateway delivery rate.",
  app_crash:
    "Crash reports concentrate on bill payment flows. Small but 100% negative — worth a stability pass.",
  competitor:
    "Every NgoodPay mention frames TakaPay as worse: more agents (Motijheel, Mohakhali named), faster app, better cashback. Watch which of their claims starts trending.",
};

export function actionItems(posts: Post[]): ActionItem[] {
  const rows = topicBreakdown(posts)
    .filter((r) => r.negative > 0 && ACTION_NOTES[r.topic])
    .map((r) => ({
      topic: r.topic,
      label: TOPIC_LABELS[r.topic] ?? r.topic,
      kind: (r.topic === "competitor" ? "watch" : "fix") as "fix" | "watch",
      total: r.total,
      negShare: Math.round((100 * r.negative) / r.total),
      reactions: r.reactions,
      comments: r.comments,
      score: r.negative * (r.eng / Math.max(r.total, 1)),
      note: ACTION_NOTES[r.topic],
    }));
  return rows.sort((a, b) => b.score - a.score).slice(0, 4);
}
