# TakaPay Pulse — social listening dashboard

Take-home task for Associate Product Engineer (DeepDive) at Markopolo AI.

**Live demo:** _deploy in progress — URL added shortly_

**Stack:** Next.js and TypeScript end to end. Recharts for charts. The data pipeline is plain TypeScript behind an API route — no database needed at this size.

## What I built

A dashboard that turns 660 raw social posts about TakaPay into what a brand manager should do next — with an ingestion pipeline in front of it, so the dashboard never renders a record that has not passed every stage:

```
sources (adapters) → validate → normalize → dedupe → relevance → sentiment audit → /api/data → UI
```

- **Sources are adapters** (`pipeline/sources.ts`). The provided dataset is one adapter. Adding a live platform API later means writing one more adapter — the pipeline does not change.
- **Validate** is a schema gate: wrong type, missing field, impossible score → rejected with a reason.
- **Normalize** puts every source into one shape (timestamps, whitespace, booleans).
- **Dedupe** removes exact copy-paste posts (same text, different authors) so they count once.
- **Relevance** drops posts flagged `brand_mention: true` that say nothing about the brand.
- **Sentiment audit** corrects labels that plainly contradict their own text (details below).

`GET /api/data` returns the cleaned records plus a full quality report: every excluded or corrected record, with the evidence. Nothing is changed silently. Corrected posts carry a small "fixed" chip in the UI.

## The insight I added and why

**"What needs attention first."** A brand manager's question is not "what is the sentiment" — it is "what do I do today". The panel ranks issues by negative volume weighted by how much attention each post draws, with a plain-language action per issue. In this data the answer is loud: failed transactions are 215 posts, 100% negative after the label audit, and the most engaged theme on the feed.

Two supporting calls:

- **"What people keep repeating."** Masking the template slots in each post (amounts, operators, family words, area names) exposes near-identical messages posted again and again by different accounts. The top pattern — money deducted but recharge never arrived — repeats 44 times. High repetition means a systemic issue, or coordinated posting. Either way the brand team should know.
- **Topics grouped by team ownership** (transactions / app / customer care / offers / competitor), because that is how the work gets routed, not by a flat topic list.
- **Campaign planner.** A launch is an attention magnet — it amplifies whatever people already feel. The panel makes the three launch calls from the same feed: a fix-before-you-launch gate (promote now and failed transactions become the campaign's comment section — verdict: hold), proof points to amplify in the customers' own words (cashback, send money, recharge — all ≥96% positive), and where/when the audience actually responds (positive share by platform, engagement by weekday × daypart).
- **Competitor watch, framed honestly.** All NgoodPay data here is posts about TakaPay that praise NgoodPay — a switching-risk signal, not NgoodPay's own sentiment (a true benchmark is one source adapter away). Weekly share of voice rose 11.9% → 18.9% across June. Each competitor claim is matched to what our own posts say on the same theme: "lower cash-out charges" lands on a real weakness (charges & fees, 83% negative — exposed), "bigger cashback" lands on our best-loved theme (100% positive — defensible), and "more agents" lands on silence (all 26 agent posts neutral — unproven, nobody vouches for us).

## What I noticed about the data

The brief warns the data is messy. Here is what the pipeline found (all listed with record-level evidence at `/api/data`):

1. **61 off-topic posts** flagged `brand_mention: true` — traffic, food, exams. Counting them would poison every number, so they are excluded and reported.
2. **10 exact duplicates** — same text, different authors. Kept once.
3. **37 sentiment labels contradict their own text — in both scripts.** English praise labeled negative ("done before I finished my tea", score 7) and Bangla complaints labeled positive ("এখনো পৌঁছায়নি" — "still hasn't arrived" — score 91). An English-only check catches 22 and silently misses the 15 Bangla ones. This is the mixed-language accuracy problem DeepDive exists to solve, planted in miniature.
4. **Competitor sentiment is relative.** All 81 NgoodPay posts are labeled negative — negative *for TakaPay*. Treated as a "watch" signal, not a "fix" item.
5. **Name collision in the real world.** TakaPay is also Bangladesh Bank's national card scheme (launched 2023). Production monitoring of this name would need entity disambiguation, or card-scheme news would contaminate wallet sentiment.

## What I'd improve with another week

- Replace the phrase rules in the sentiment audit with a small bilingual classifier (or an LLM annotation pass) calibrated on the corrected set — and keep the phrase rules as regression tests for it.
- Live source adapters with scheduled ingestion and a real store (the current in-memory cache is right for one file, not for streams).
- A proper compare period (deltas currently compare the two halves of June).
- An author-level view behind "What people keep repeating" to separate systemic bugs from seeded campaigns.
- Entity disambiguation for the TakaPay name collision above.

## Where AI helped, and where I overrode it

I used AI (Claude Code) heavily and deliberately — it wrote most of the component, chart, and CSS boilerplate, and the first draft of the cleaning rules. The decisions are mine, and two of them came from catching the machine being wrong or lazy:

- **The first cleaning pass was English-only.** Reviewing the posts table showed Bangla-script complaints still labeled positive — the rules missed all 15 of them. I had the audit extended with Bangla phrases; corrections went from 22 to 37. The lesson matches the job: an English-first pass on Bangladeshi social data silently under-counts the negative.
- **Trend-dashboard convention colors "up" green.** A rising negative share must be red no matter which way the arrow points, so the delta chips are colored by meaning, not direction.
- Judgment calls I made against the easy default: exclude off-topic rather than toggle it, correct mislabels with full disclosure rather than silently (or not at all), competitor as "watch" not "fix", topics grouped by who owns the fix.

## Run locally

```
npm install
npm run dev     # http://localhost:3000
```

The provided dataset is committed at `data/raw.json` so the pipeline runs reproducibly. The quality report is at `/api/data`.
