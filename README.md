# TakaPay Pulse — social listening dashboard

Take-home task for Associate Product Engineer (DeepDive) at Markopolo AI.

**Live demo:** _deploy in progress — URL added shortly_

**Stack:** Next.js and TypeScript end to end. Recharts for charts. The data pipeline is plain TypeScript behind an API route — no database needed at this size. The assistant uses Gemini through its OpenAI-compatible endpoint.

## What I built

A dashboard that turns 660 raw social posts about TakaPay into what a brand manager should do next. In front of it sits an ingestion pipeline, so the dashboard never renders a record that has not passed every stage:

```
sources (adapters) → validate → normalize → dedupe → relevance → sentiment audit → /api/data → UI
```

- **Sources are adapters** (`pipeline/sources.ts`). The provided dataset is one adapter. Adding a live platform API later means writing one more adapter — the pipeline does not change.
- **Validate** rejects broken records with a reason. **Normalize** puts every source into one shape. **Dedupe** counts copy-paste posts once. **Relevance** drops posts flagged `brand_mention: true` that say nothing about the brand. **Sentiment audit** corrects labels that plainly contradict their own text (details below).
- `GET /api/data` returns the cleaned records **plus a full quality report**: every excluded or corrected record, with the evidence. Nothing is changed silently — corrected posts carry a small "fixed" chip in the UI.

On top of that, the dashboard a brand manager actually touches:

- **A real date-range picker with comparison.** The main range filters everything; the "compared to" range drives the delta chips on the stat card. Comparison defaults to *None* on purpose: comparing the full month against its own first half would inflate every delta.
- **Filters that behave like the product** — sentiment / topic / channel pills plus free-text search over the posts (Bangla and English both work).
- **Shareable views.** The URL carries the whole view state (filters, search, ranges, focused topic), so a manager can send a colleague exactly what they're looking at.
- Sentiment donut and daily trend, a **Topic Sentiment Split** chart (click any bar to see the posts behind it), **intents** (what each post is trying to do — complaint, question, support ask, billing, praise — labeled by simple rules I disclose, since the dataset has no intent field), an **engagement panel** (below), platform and language breakdowns, and a paginated posts table — the receipts behind every number.
- **"Ask Pulse", a chat assistant.** Questions in plain language ("compare failed transactions in the first vs second half of June") become tool calls over the cleaned data — every number in an answer is computed by code, never estimated by the model. Answers show which filters they used, and one click applies them to the dashboard. 👍/👎 on answers feeds a small learning store.
- **Export.** Excel (full data, including Bangla text) and a PDF one-pager of the current view — the export link carries the same URL state, so the file matches the screen.

## The insight I added and why

**"What needs attention first."** A brand manager's question is not "what is the sentiment" — it is "what do I do today". This panel ranks issues by negative volume weighted by how much attention each post draws, with a plain-language action per issue. In this data the answer is loud: failed transactions are 215 posts, 100% negative after the label audit, and the most engaged theme on the feed.

Supporting calls, each earning its place:

- **"What people keep repeating."** Masking the template slots in each post (amounts, operators, family words, area names) exposes near-identical messages posted again and again by different accounts. The top pattern — money deducted, recharge never arrived — repeats 44×. High repetition means a systemic issue, or coordinated posting. Either way the brand team should know.
- **"Where the attention goes."** Reactions and comments measure attention, so I compared each topic's share of engagement against its share of posts. The finding is the *absence* of a gap — see the data section below; it turned out to be evidence, not filler.
- **Campaign planner.** A launch amplifies whatever people already feel. The panel makes the three launch calls from the same feed: a fix-before-you-launch gate (verdict: hold — promote now and failed transactions become the campaign's comment section), proof points to amplify in customers' own words (cashback, send money, recharge — all ≥96% positive), and where/when the audience responds (positive share by platform, engagement by weekday × daypart).
- **Competitor watch, framed honestly.** All NgoodPay data here is posts about TakaPay that praise NgoodPay — a switching-risk signal, not NgoodPay's own sentiment (a true benchmark is one source adapter away). Weekly share of voice rose 11.9% → 18.9% across June. Each claim is matched against what our own posts say on the same theme: "lower charges" lands on a real weakness (charges & fees, 83% negative — *exposed*), "bigger cashback" lands on our best-loved theme (100% positive — *defensible*), "more agents" lands on silence (all 26 agent posts neutral — *unproven*).

## What I noticed about the data

The brief warns the data is messy. Everything below is listed with record-level evidence at `/api/data`:

1. **61 off-topic posts** flagged `brand_mention: true` — traffic, food, exams. Counting them would poison every number, so they are excluded and reported.
2. **10 exact duplicates** — same text, different authors. Kept once.
3. **37 sentiment labels contradict their own text — in both scripts.** English praise labeled negative ("done before I finished my tea", score 7) and Bangla complaints labeled positive ("এখনো পৌঁছায়নি" — "still hasn't arrived" — score 91). An English-only check catches 22 and silently misses the 15 Bangla ones — and those 15 are exactly the Bangla-script records. This is the mixed-language accuracy problem DeepDive exists to solve, planted in miniature.
4. **Engagement is suspiciously flat.** In a real feed a handful of posts dominates; here the ten most-engaged posts hold just 3.3% of all engagement, and the single biggest post is only ~2× the median. No topic earns attention out of proportion to its volume. Flat engagement plus templated wording points the same way: volume that is manufactured, not amplified.
5. **Competitor sentiment is relative.** All 81 NgoodPay posts are labeled negative — negative *for TakaPay*. Treated as a "watch" signal, not a "fix" item.
6. **Name collision in the real world.** TakaPay is also Bangladesh Bank's national card scheme (launched 2023). Production monitoring of this name would need entity disambiguation, or card-scheme news would contaminate wallet sentiment.

## What I'd improve with another week

- Replace the phrase rules in the sentiment audit with a small bilingual classifier calibrated on the corrected set — and keep the phrase rules as regression tests for it.
- Live source adapters with scheduled ingestion and a real store (the in-memory cache is right for one file, not for streams). The assistant's learning memory has the same limit: it's a JSON file today, fine for a demo, a real store in production.
- An author-level view behind "What people keep repeating", to separate systemic bugs from seeded campaigns.
- Entity disambiguation for the TakaPay name collision.
- Mobile polish — the layout is desktop-first and overflows on a phone.

## Where AI helped, and where I overrode it

I used AI (Claude Code) heavily and deliberately — it wrote most of the component, chart, and CSS boilerplate, the first draft of the cleaning rules, and it ran the end-to-end checks. The decisions are mine, and several came from catching the machine — or its defaults — being wrong:

- **The first cleaning pass was English-only.** Reviewing the posts table showed Bangla-script complaints still labeled positive — the rules missed all 15 of them. I had the audit extended with Bangla phrases; corrections went from 22 to 37. The lesson matches the job: an English-first pass on Bangladeshi social data silently under-counts the negative.
- **I rejected two AI drafts of the topics panel as misleading.** Both made every topic's bar the same width, so a 2-post topic looked as big as a 215-post one. Bar length has to encode volume; the shipped chart is a plain stacked bar chart on a labeled axis.
- **The engagement panel's first framing had no story.** The standard playbook is "which topics get amplified beyond their volume" — but when we computed it, this data is flat. Instead of shipping four empty comparisons, the flatness itself became the finding (see data note 4). The data overruled the template.
- **Trend-dashboard convention colors "up" green.** A rising negative share must be red no matter which way the arrow points, so the delta chips are colored by meaning, not direction.
- **AI checked AI's work before ship.** A scripted browser sweep (29 checks: filters, search, date picker, comparison math, pagination, click-throughs, the assistant answering with real computed numbers) caught a deploy-breaking detail — the chat route needs its model key present at build time — before it could break the live demo.
- Judgment calls made against the easy default: exclude off-topic rather than toggle it, correct mislabels with full disclosure rather than silently, competitor as "watch" not "fix", comparison defaults to None rather than a flattering delta.

## Run locally

```
cp .env.example .env   # add a free Gemini key (link inside) — powers the assistant and AI report summary
npm install
npm run dev            # http://localhost:3000
```

The provided dataset is committed at `data/raw.json` so the pipeline runs reproducibly. The quality report is at `/api/data`. Note: `npm run build` (and deploying) needs the env vars from `.env.example` set — the assistant's model client initializes at build time.
