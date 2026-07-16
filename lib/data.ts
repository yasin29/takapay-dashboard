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

/* ---------- Campaign planner — fix first, amplify what works, pick the window ----------
   A launch decision is three questions: is it safe to draw attention, what do
   we say, and where/when do we say it. All three come from the same feed. */

export type LaunchVerdict = "hold" | "caution" | "ready";

export interface LaunchBlocker {
  topic: string;
  label: string;
  total: number;
  negShare: number;
  severity: "blocker" | "warm";
}

export interface LaunchReadiness {
  verdict: LaunchVerdict;
  negShare: number; // overall negative share, the number the gate watches
  blockers: LaunchBlocker[];
}

// A paid campaign is an attention magnet: promoting while a theme is loudly
// negative fills the campaign's own comments with that complaint. Thresholds
// are deliberately simple and visible: >=20 posts at >=60% negative blocks.
export function launchReadiness(posts: Post[]): LaunchReadiness {
  const rows = topicBreakdown(posts).filter((r) => r.topic !== "competitor");
  const blockers: LaunchBlocker[] = [];
  for (const r of rows) {
    const negShare = Math.round((100 * r.negative) / Math.max(r.total, 1));
    if (r.total >= 20 && negShare >= 60) blockers.push({ topic: r.topic, label: TOPIC_LABELS[r.topic] ?? r.topic, total: r.total, negShare, severity: "blocker" });
    else if (r.total >= 10 && negShare >= 40) blockers.push({ topic: r.topic, label: TOPIC_LABELS[r.topic] ?? r.topic, total: r.total, negShare, severity: "warm" });
  }
  blockers.sort((a, b) => b.total * b.negShare - a.total * a.negShare);
  const neg = posts.filter((p) => p.sentiment === "negative").length;
  const verdict: LaunchVerdict = blockers.some((b) => b.severity === "blocker")
    ? "hold"
    : blockers.length > 0
      ? "caution"
      : "ready";
  return { verdict, negShare: Math.round((100 * neg) / Math.max(posts.length, 1)), blockers: blockers.slice(0, 4) };
}

export interface AmplifyTheme {
  topic: string;
  label: string;
  positive: number;
  posShare: number;
  quotes: { text: string; platform: string; eng: number }[];
}

// The mirror image of the complaints: themes people already praise, with the
// most-engaged real posts. Customers' own words are the campaign copy.
export function amplifyThemes(posts: Post[]): AmplifyTheme[] {
  return topicBreakdown(posts)
    .filter((r) => r.topic !== "competitor" && r.total >= 10 && r.positive / r.total >= 0.6)
    .sort((a, b) => b.positive - a.positive)
    .slice(0, 4)
    .map((r) => {
      const quotes = posts
        .filter((p) => p.topic === r.topic && p.sentiment === "positive")
        .sort((a, b) => engagement(b) - engagement(a))
        .slice(0, 2)
        .map((p) => ({ text: p.text, platform: p.platform, eng: engagement(p) }));
      return {
        topic: r.topic,
        label: TOPIC_LABELS[r.topic] ?? r.topic,
        positive: r.positive,
        posShare: Math.round((100 * r.positive) / r.total),
        quotes,
      };
    });
}

export interface PlatformWindow {
  platform: string;
  total: number;
  posShare: number;
  avgEng: number;
}

export interface HeatCell {
  day: string;
  bucket: string;
  posts: number;
  avgEng: number;
  norm: number; // 0..1 against the busiest cell, for color intensity
}

export interface CampaignWindows {
  platforms: PlatformWindow[];
  days: string[];
  buckets: string[];
  cells: HeatCell[];
  best: HeatCell | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_BUCKETS: { name: string; from: number; to: number }[] = [
  { name: "Morning 6–11", from: 6, to: 11 },
  { name: "Afternoon 12–16", from: 12, to: 16 },
  { name: "Evening 17–21", from: 17, to: 21 },
  { name: "Night 22–5", from: 22, to: 5 },
];

// Where and when the audience actually pays attention: platform positive share
// (post the campaign where the mood is), and a weekday x daypart map of average
// engagement per post (post it when people react).
export function campaignWindows(posts: Post[]): CampaignWindows {
  const platforms = platformBreakdown(posts).map((r) => {
    const eng = posts.filter((p) => p.platform === r.platform).reduce((s, p) => s + engagement(p), 0);
    return {
      platform: r.platform,
      total: r.total,
      posShare: Math.round((100 * r.positive) / Math.max(r.total, 1)),
      avgEng: Math.round(eng / Math.max(r.total, 1)),
    };
  });
  platforms.sort((a, b) => b.posShare - a.posShare || b.avgEng - a.avgEng);

  const grid = new Map<string, { posts: number; eng: number }>();
  for (const p of posts) {
    const dt = new Date(p.timestamp.replace(" ", "T"));
    const hour = dt.getHours();
    const bucket = TIME_BUCKETS.find((b) => (b.from <= b.to ? hour >= b.from && hour <= b.to : hour >= b.from || hour <= b.to))!;
    const key = `${DAY_NAMES[dt.getDay()]}|${bucket.name}`;
    if (!grid.has(key)) grid.set(key, { posts: 0, eng: 0 });
    const cell = grid.get(key)!;
    cell.posts++;
    cell.eng += engagement(p);
  }
  const cells: HeatCell[] = [];
  for (const day of DAY_NAMES) {
    for (const b of TIME_BUCKETS) {
      const c = grid.get(`${day}|${b.name}`) ?? { posts: 0, eng: 0 };
      cells.push({ day, bucket: b.name, posts: c.posts, avgEng: c.posts > 0 ? Math.round(c.eng / c.posts) : 0, norm: 0 });
    }
  }
  const max = Math.max(...cells.map((c) => c.avgEng), 1);
  cells.forEach((c) => (c.norm = c.avgEng / max));
  const best = cells.reduce<HeatCell | null>((a, c) => (c.posts >= 5 && (!a || c.avgEng > a.avgEng) ? c : a), null);
  return { platforms, days: DAY_NAMES, buckets: TIME_BUCKETS.map((b) => b.name), cells, best };
}

/* ---------- Competitor watch — share of voice and the gap table ----------
   Honest framing: these are posts about TakaPay that praise NgoodPay, so this
   measures how loudly the competitor features in OUR conversation — not
   NgoodPay's own sentiment. A true benchmark needs an NgoodPay source adapter. */

export interface VoiceWeek {
  week: string;
  total: number;
  competitor: number;
  share: number; // % of all counted posts that week
}

export function shareOfVoice(posts: Post[]): VoiceWeek[] {
  const weeks = new Map<number, { total: number; competitor: number }>();
  for (const p of posts) {
    const day = parseInt(p.timestamp.slice(8, 10), 10);
    const w = Math.min(Math.floor((day - 1) / 7), 4);
    if (!weeks.has(w)) weeks.set(w, { total: 0, competitor: 0 });
    const row = weeks.get(w)!;
    row.total++;
    if (p.topic === "competitor") row.competitor++;
  }
  const label = (w: number) => `Jun ${w * 7 + 1}–${Math.min(w * 7 + 7, 30)}`;
  return [...weeks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([w, r]) => ({ week: label(w), total: r.total, competitor: r.competitor, share: Math.round((1000 * r.competitor) / Math.max(r.total, 1)) / 10 }));
}

export interface CompetitorGap {
  claim: string;
  count: number;
  sample: string;
  againstLabel: string; // the TakaPay theme the claim lands on
  againstTopics: string[];
  againstTotal: number;
  againstNegShare: number;
  againstPosShare: number;
  // exposed: our own posts on that theme are mostly negative — the claim lands
  // on a real weakness. defensible: ours are mostly positive — we have a
  // counter-claim. unproven: ours are neutral — nobody is vouching for us.
  status: "exposed" | "defensible" | "unproven";
}

// Each competitor claim, matched to what OUR posts say on the same theme.
// Where our theme is mostly negative the claim is landing on a real weakness;
// where ours is positive we have a counter-claim ready.
const GAP_MATCHERS: { claim: string; pattern: RegExp; against: string; topics: string[] }[] = [
  { claim: "Better customer care", pattern: /customer care/i, against: "Customer care", topics: ["customer_care"] },
  { claim: "More agents on the ground", pattern: /agent/i, against: "Agent network", topics: ["agent_network"] },
  { claim: "Bigger cashback & recharge bonuses", pattern: /cashback|bonus/i, against: "Cashback offers", topics: ["cashback_offer"] },
  { claim: "Lower cash-out charges", pattern: /charge|switch/i, against: "Charges & fees", topics: ["charges_fees"] },
  { claim: "Faster, cleaner app", pattern: /faster|ui|clean|app/i, against: "App experience", topics: ["app_experience", "app_crash", "login_otp"] },
];

export function competitorGaps(posts: Post[]): CompetitorGap[] {
  const comp = posts.filter((p) => p.topic === "competitor");
  const byTopic = new Map(topicBreakdown(posts).map((r) => [r.topic, r]));
  const out: CompetitorGap[] = [];
  const claimed = new Set<number>();
  for (const m of GAP_MATCHERS) {
    const members = comp.filter((p) => !claimed.has(p.id) && m.pattern.test(p.text));
    if (members.length === 0) continue;
    members.forEach((p) => claimed.add(p.id));
    const rows = m.topics.map((t) => byTopic.get(t)).filter((r): r is NonNullable<typeof r> => !!r);
    const total = rows.reduce((s, r) => s + r.total, 0);
    const neg = rows.reduce((s, r) => s + r.negative, 0);
    const pos = rows.reduce((s, r) => s + r.positive, 0);
    const negShare = Math.round((100 * neg) / Math.max(total, 1));
    const posShare = Math.round((100 * pos) / Math.max(total, 1));
    out.push({
      claim: m.claim,
      count: members.length,
      sample: members.reduce((a, b) => (a.text.length <= b.text.length ? a : b)).text,
      againstLabel: m.against,
      againstTopics: m.topics,
      againstTotal: total,
      againstNegShare: negShare,
      againstPosShare: posShare,
      status: negShare >= 50 ? "exposed" : posShare >= 50 ? "defensible" : "unproven",
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

/* ---------- Intents — what each post is trying to DO ----------
   The dataset has no intent field, so intent is derived from text and topic
   with simple, disclosed rules. Precedence matters: a billing question is a
   billing issue first, a question second. */

export const INTENTS = ["Complaint", "Inquiry", "Support request", "Billing issue", "Praise", "Feedback"] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_COLOR: Record<Intent, string> = {
  Complaint: "#602494",
  Inquiry: "#37C0B0",
  Feedback: "#0FB7E6",
  "Support request": "#F5C451",
  "Billing issue": "#D92D20",
  Praise: "#A1DA6C",
};

const QUESTION_RE = /\?|kivabe|kibhabe|keno\b|kobe\b|kothay|how (?:do|to|can)|why |when will|কিভাবে|কেন|কবে|কোথায়/i;
const SUPPORT_RE = /helpline|customer care|support|complain kor|হেল্প|সাপোর্ট|কাস্টমার কেয়ার/i;

export function intentOf(p: Post): Intent {
  if (p.topic === "charges_fees") return "Billing issue";
  if (p.topic === "customer_care" || SUPPORT_RE.test(p.text)) return "Support request";
  if (p.topic === "feature_query" || QUESTION_RE.test(p.text)) return "Inquiry";
  if (p.sentiment === "negative") return "Complaint";
  if (p.sentiment === "positive") return "Praise";
  return "Feedback";
}

export function intentSummary(posts: Post[]) {
  const c = new Map<Intent, number>();
  posts.forEach((p) => {
    const i = intentOf(p);
    c.set(i, (c.get(i) ?? 0) + 1);
  });
  return INTENTS.map((i) => ({ intent: i, n: c.get(i) ?? 0 })).filter((r) => r.n > 0);
}

export function intentTrend(posts: Post[]) {
  const days = new Map<string, Record<string, number>>();
  for (const p of posts) {
    const d = p.timestamp.slice(0, 10);
    if (!days.has(d)) days.set(d, {});
    const row = days.get(d)!;
    const i = intentOf(p);
    row[i] = (row[i] ?? 0) + 1;
  }
  return [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, row]) => {
      const out: Record<string, number | string> = { date: date.slice(8) };
      for (const i of INTENTS) out[i] = row[i] ?? 0;
      return out;
    });
}

/* ---------- Date ranges — the picker's contract ----------
   Dates are "YYYY-MM-DD" strings; the dataset spans June 2026 only. */

export interface DateRange {
  a: string;
  b: string;
}

export const DATA_RANGE: DateRange = { a: "2026-06-01", b: "2026-06-30" };

export const inRange = (p: Post, r: DateRange) => {
  const d = p.timestamp.slice(0, 10);
  return d >= r.a && d <= r.b;
};

export const rangeLabel = (r: DateRange) => {
  const f = (s: string) => `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(s.slice(5, 7), 10) - 1]} ${parseInt(s.slice(8, 10), 10)}`;
  return `${f(r.a)} — ${f(r.b)}`;
};
