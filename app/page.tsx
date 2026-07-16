"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DATA_RANGE, EMPTY_FILTERS, INTENTS, INTENT_COLOR, TOPIC_LABELS, actionItems, amplifyThemes, applyFilters,
  campaignWindows, competitorGaps, dailyTrend, engagement, engagementInsights, inRange, intentTrend,
  languageBreakdown, launchReadiness, platformBreakdown, queryToView, rangeLabel,
  repeatedPatterns, SENTIMENTS, sentimentSplit, shareOfVoice, topicBreakdown, viewToQuery,
  type DateRange, type Filters, type Post, type QualityReport, type Sentiment,
} from "@/lib/data";
import { IntentTrendChart, LanguageDonut, PlatformChart, SentimentDonut, TopicSentimentChart, TrendChart } from "@/components/Charts";
import {
  ActionPanel, CAL_ICON, CampaignPlanner, CompetitorPanel, DateRangePicker, EngagementPanel, FilterBar, PostsTable,
  RepeatedIssues, Sidebar, StatTiles,
} from "@/components/Panels";
import { Chatbot, type ChatApplied } from "@/components/Chatbot";
import { ExportMenu } from "@/components/ExportMenu";

const EMPTY: Filters = EMPTY_FILTERS;

interface ApiData {
  records: Post[];
  quality: QualityReport;
}

export default function Page() {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [focusTopic, setFocusTopic] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  // Date ranges: the main range filters the whole dashboard; the comparison
  // range only drives the delta chips on the stat card.
  // Comparison defaults to None: the full month compared to its own first half
  // would inflate every delta. Pick a range via "compared to".
  const [range, setRange] = useState<DateRange>(DATA_RANGE);
  const [compareRange, setCompareRange] = useState<DateRange | null>(null);
  const [picker, setPicker] = useState<"main" | "compare" | null>(null);

  // Shareable views: the URL is the whole view state. Read it once on mount
  // (in an effect, not the initializers, so server and client render the same
  // first frame), then mirror every state change back with replaceState.
  const urlSynced = useRef(false);
  useEffect(() => {
    const v = queryToView(window.location.search);
    setFilters(v.filters);
    setRange(v.range);
    setCompareRange(v.compareRange);
    setFocusTopic(v.focusTopic);
  }, []);
  useEffect(() => {
    // Skip the first pass — state still holds defaults until the parse above lands.
    if (!urlSynced.current) {
      urlSynced.current = true;
      return;
    }
    const qs = viewToQuery({ filters, range, compareRange, focusTopic });
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [filters, range, compareRange, focusTopic]);

  useEffect(() => {
    fetch("/api/data")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`))))
      .then((d) => {
        setData(d);
        setUpdatedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      })
      .catch((e) => setError(String(e)));
  }, []);

  const posts = useMemo(() => data?.records ?? [], [data]);
  const allTopics = useMemo(() => topicBreakdown(posts).map((t) => t.topic), [posts]);
  const allPlatforms = useMemo(() => platformBreakdown(posts).map((p) => p.platform), [posts]);

  const filtered = useMemo(
    () => applyFilters(posts, filters).filter((p) => inRange(p, range)),
    [posts, filters, range]
  );
  // Same pill filters over the comparison window, so deltas compare like with like.
  const comparePosts = useMemo(
    () => (compareRange ? applyFilters(posts, filters).filter((p) => inRange(p, compareRange)) : null),
    [posts, filters, compareRange]
  );
  const split = useMemo(() => sentimentSplit(filtered), [filtered]);
  const trend = useMemo(() => dailyTrend(filtered), [filtered]);
  const topics = useMemo(() => topicBreakdown(filtered), [filtered]);
  const topicSplitData = useMemo(
    () => topics.map((t) => ({ ...t, label: TOPIC_LABELS[t.topic] ?? t.topic })),
    [topics]
  );
  const intents = useMemo(() => intentTrend(filtered), [filtered]);
  const attention = useMemo(() => engagementInsights(filtered), [filtered]);
  const platforms = useMemo(() => platformBreakdown(filtered), [filtered]);
  const languages = useMemo(() => languageBreakdown(filtered), [filtered]);
  const actions = useMemo(() => actionItems(posts), [posts]);
  const repeats = useMemo(() => repeatedPatterns(filtered), [filtered]);
  // Strategic panels read the full counted feed, not the filtered view — a
  // launch call should not change because a filter pill is on (same as actions).
  const readiness = useMemo(() => launchReadiness(posts), [posts]);
  const amplify = useMemo(() => amplifyThemes(posts), [posts]);
  const windows = useMemo(() => campaignWindows(posts), [posts]);
  const sov = useMemo(() => shareOfVoice(posts), [posts]);
  const gaps = useMemo(() => competitorGaps(posts), [posts]);

  const tablePosts = useMemo(() => {
    const base = focusTopic ? filtered.filter((p) => p.topic === focusTopic) : filtered;
    return [...base].sort((a, b) => engagement(b) - engagement(a));
  }, [filtered, focusTopic]);

  const focusAndScroll = (topic: string) => {
    setFocusTopic(topic);
    document.getElementById("posts")?.scrollIntoView({ behavior: "smooth" });
  };

  // A chat answer's filters become the dashboard's filters — one click turns
  // "compare failed transactions on Facebook in early June" into the same
  // filtered view the assistant computed its numbers from.
  const applyFromChat = (a: ChatApplied) => {
    setFilters({
      sentiments: a.sentiments.filter((s): s is Sentiment => (SENTIMENTS as string[]).includes(s)),
      topics: a.topics.filter((t) => t in TOPIC_LABELS),
      platforms: a.platforms
        .map((raw) => allPlatforms.find((p) => p.toLowerCase() === raw.toLowerCase()))
        .filter((p): p is string => !!p),
      // The chat's search is word-ranked (BM25); the dashboard box is exact
      // substring — carrying it over would zero out results, so it stays chat-only.
      query: "",
    });
    if (a.dateFrom || a.dateTo) {
      const clamp = (d: string) => (d < DATA_RANGE.a ? DATA_RANGE.a : d > DATA_RANGE.b ? DATA_RANGE.b : d);
      setRange({ a: clamp(a.dateFrom ?? DATA_RANGE.a), b: clamp(a.dateTo ?? DATA_RANGE.b) });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (error) {
    return (
      <div className="shell">
        <Sidebar />
        <main className="main">
          <h1>Something broke</h1>
          <div className="page-sub">The data pipeline failed to respond: {error}</div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="shell">
        <Sidebar />
        <main className="main">
          <h1>Overview</h1>
          <div className="page-sub">Running the data pipeline — validating, deduplicating, and auditing the feed…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <div className="page-head">
          <div>
            <h1>Overview</h1>
            <div className="page-sub">
              What people said about TakaPay across 7 platforms — and what to do about it.
            </div>
          </div>
          <div className="head-controls">
            <button className="date-chip as-btn" onClick={() => setPicker("main")}>
              <svg viewBox="0 0 24 24"><path d={CAL_ICON} /></svg>
              {rangeLabel(range)}
            </button>
            <span className="cmp-label">compared to</span>
            <button className="date-chip as-btn" onClick={() => setPicker("compare")}>
              {compareRange ? (
                <>
                  <svg viewBox="0 0 24 24"><path d={CAL_ICON} /></svg>
                  {rangeLabel(compareRange)}
                </>
              ) : (
                "None"
              )}
            </button>
            <ExportMenu view={{ filters, range, compareRange, focusTopic }} />
          </div>
        </div>

        {picker && (
          <DateRangePicker
            mode={picker}
            value={picker === "main" ? range : compareRange}
            anchor={range}
            onApply={(r) => (picker === "main" ? setRange(r) : setCompareRange(r))}
            onRemove={picker === "compare" ? () => setCompareRange(null) : undefined}
            onClose={() => setPicker(null)}
          />
        )}

        <FilterBar filters={filters} setFilters={setFilters} topics={allTopics} platforms={allPlatforms} updatedAt={updatedAt} />

        <StatTiles posts={filtered} comparePosts={comparePosts} rawCount={data.quality.raw_records} />

        <ActionPanel items={actions} onFocus={focusAndScroll} />

        <div className="grid two" id="sentiment" style={{ marginTop: 16 }}>
          <div className="card">
            <h3>Overall sentiment</h3>
            <div className="card-sub">Share of counted brand mentions</div>
            <SentimentDonut split={split} total={filtered.length} />
          </div>
          <div className="card">
            <h3>Sentiment over time</h3>
            <div className="card-sub">Daily post counts, June 2026</div>
            <TrendChart data={trend} />
          </div>
        </div>

        <div className="card" id="topics">
          <h3>Topic Sentiment Split</h3>
          <div className="card-sub">Sentiment breakdown across different topics — click a bar to see the posts</div>
          <TopicSentimentChart data={topicSplitData} onFocus={focusAndScroll} />
        </div>

        <div className="card" id="intents" style={{ marginTop: 16 }}>
          <h3>Intent Based Mentions</h3>
          <div className="card-sub">
            Mentions grouped by conversation signals — what each post is trying to do, labeled with
            simple text rules (complaint, question, support ask, billing, praise).
          </div>
          <IntentTrendChart data={intents} intents={INTENTS} colors={{ ...INTENT_COLOR }} />
        </div>

        <div style={{ marginTop: 16 }}>
          <EngagementPanel insights={attention} onFocus={focusAndScroll} />
        </div>

        <div style={{ marginTop: 16 }}>
          <RepeatedIssues patterns={repeats} onFocus={focusAndScroll} />
        </div>

        <div className="grid two-even" id="platforms" style={{ marginTop: 16 }}>
          <div className="card">
            <h3>Where the conversation happens</h3>
            <div className="card-sub">Posts per platform, split by sentiment</div>
            <PlatformChart data={platforms} />
          </div>
          <div className="card">
            <h3>Language mix</h3>
            <div className="card-sub">People post in Bangla, English, and mixed &ldquo;Banglish&rdquo;</div>
            <LanguageDonut data={languages} total={filtered.length} />
            <div className="chart-note">
              Most posts mix Bangla and English in one sentence — any sentiment model for this market has to handle that natively.
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <CampaignPlanner readiness={readiness} themes={amplify} windows={windows} onFocus={focusAndScroll} />
        </div>

        <div style={{ marginTop: 16 }}>
          <CompetitorPanel sov={sov} gaps={gaps} onFocus={focusAndScroll} />
        </div>

        <div style={{ marginTop: 16 }}>
          <PostsTable
            posts={tablePosts}
            focusLabel={focusTopic ? TOPIC_LABELS[focusTopic] ?? focusTopic : undefined}
            onClearFocus={() => setFocusTopic(null)}
          />
        </div>
      </main>

      <Chatbot onApply={applyFromChat} />
    </div>
  );
}
