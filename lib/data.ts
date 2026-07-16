import cleaned from "@/data/cleaned.json";
import report from "@/data/quality-report.json";

export type Sentiment = "positive" | "neutral" | "negative";

export interface Post {
  id: number;
  platform: string;
  timestamp: string;
  author: string;
  text: string;
  language: string;
  brand_mention: boolean;
  sentiment: Sentiment;
  sentiment_score: number;
  topic: string;
  reactions: number;
  comments: number;
  corrected: boolean;
}

export const POSTS = cleaned as Post[];
export const QUALITY = report as {
  raw_records: number;
  counted_records: number;
  excluded_off_topic: number;
  removed_duplicates: number;
  relabeled_sentiment: number;
  off_topic: { id: number; text: string }[];
  duplicates: { id: number; duplicate_of: number; text: string }[];
  relabeled: { id: number; from: string; to: string; evidence: string[]; text: string }[];
};

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

// DeepDive-style series colors (validated): positive teal, neutral purple, negative sky
export const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: "#0d9488",
  neutral: "#7c3aed",
  negative: "#0ea5e9",
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
  const t = new Map<string, { topic: string; positive: number; neutral: number; negative: number; total: number; eng: number }>();
  for (const p of posts) {
    if (!t.has(p.topic)) t.set(p.topic, { topic: p.topic, positive: 0, neutral: 0, negative: 0, total: 0, eng: 0 });
    const row = t.get(p.topic)!;
    row[p.sentiment]++;
    row.total++;
    row.eng += engagement(p);
  }
  return [...t.values()].sort((a, b) => b.total - a.total);
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
  eng: number;
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
      eng: r.eng,
      score: r.negative * (r.eng / Math.max(r.total, 1)),
      note: ACTION_NOTES[r.topic],
    }));
  return rows.sort((a, b) => b.score - a.score).slice(0, 4);
}
