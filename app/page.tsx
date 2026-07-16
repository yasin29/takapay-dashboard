"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TOPIC_LABELS, actionItems, applyFilters, dailyTrend, engagement,
  languageBreakdown, platformBreakdown, repeatedPatterns, sentimentSplit, topicBreakdown,
  type Filters, type Post, type QualityReport,
} from "@/lib/data";
import { LanguageDonut, PlatformChart, SentimentDonut, TrendChart } from "@/components/Charts";
import { ActionPanel, FilterBar, PostsTable, RepeatedIssues, Sidebar, StatTiles, TopicGroups } from "@/components/Panels";

const EMPTY: Filters = { sentiments: [], topics: [], platforms: [] };

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

  const filtered = useMemo(() => applyFilters(posts, filters), [posts, filters]);
  const split = useMemo(() => sentimentSplit(filtered), [filtered]);
  const trend = useMemo(() => dailyTrend(filtered), [filtered]);
  const topics = useMemo(() => topicBreakdown(filtered), [filtered]);
  const platforms = useMemo(() => platformBreakdown(filtered), [filtered]);
  const languages = useMemo(() => languageBreakdown(filtered), [filtered]);
  const actions = useMemo(() => actionItems(posts), [posts]);
  const repeats = useMemo(() => repeatedPatterns(filtered), [filtered]);

  const tablePosts = useMemo(() => {
    const base = focusTopic ? filtered.filter((p) => p.topic === focusTopic) : filtered;
    return [...base].sort((a, b) => engagement(b) - engagement(a));
  }, [filtered, focusTopic]);

  const focusAndScroll = (topic: string) => {
    setFocusTopic(topic);
    document.getElementById("posts")?.scrollIntoView({ behavior: "smooth" });
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
            <span className="date-chip">
              <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z" /></svg>
              Jun 1 — Jun 30
            </span>
            <span className="cmp-label">compared to</span>
            <span className="date-chip" title="Delta chips on the stat card compare the two halves of June">
              First half <span style={{ fontWeight: 500, color: "var(--faint)" }}>Jun 1 - Jun 15</span>
              <svg className="chev-sm" viewBox="0 0 20 20"><path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </div>
        </div>

        <FilterBar filters={filters} setFilters={setFilters} topics={allTopics} platforms={allPlatforms} updatedAt={updatedAt} />

        <StatTiles posts={filtered} rawCount={data.quality.raw_records} />

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

        <TopicGroups rows={topics} onFocus={focusAndScroll} />

        <div style={{ marginTop: 16 }}>
          <RepeatedIssues patterns={repeats} />
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
          <PostsTable
            posts={tablePosts}
            focusLabel={focusTopic ? TOPIC_LABELS[focusTopic] ?? focusTopic : undefined}
            onClearFocus={() => setFocusTopic(null)}
          />
        </div>
      </main>
    </div>
  );
}
