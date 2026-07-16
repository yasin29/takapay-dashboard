"use client";

import { useMemo, useState } from "react";
import {
  POSTS, TOPIC_LABELS, actionItems, applyFilters, dailyTrend, engagement,
  languageBreakdown, platformBreakdown, sentimentSplit, topicBreakdown, type Filters,
} from "@/lib/data";
import { LanguageDonut, PlatformChart, SentimentDonut, TopicsChart, TrendChart } from "@/components/Charts";
import { ActionPanel, FilterBar, PostsTable, QualityCard, Sidebar, StatTiles } from "@/components/Panels";

const EMPTY: Filters = { sentiments: [], topics: [], platforms: [] };

export default function Page() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [focusTopic, setFocusTopic] = useState<string | null>(null);

  const allTopics = useMemo(() => topicBreakdown(POSTS).map((t) => t.topic), []);
  const allPlatforms = useMemo(() => platformBreakdown(POSTS).map((p) => p.platform), []);

  const filtered = useMemo(() => applyFilters(POSTS, filters), [filters]);
  const split = useMemo(() => sentimentSplit(filtered), [filtered]);
  const trend = useMemo(() => dailyTrend(filtered), [filtered]);
  const topics = useMemo(() => topicBreakdown(filtered), [filtered]);
  const platforms = useMemo(() => platformBreakdown(filtered), [filtered]);
  const languages = useMemo(() => languageBreakdown(filtered), [filtered]);
  const actions = useMemo(() => actionItems(POSTS), []);

  const tablePosts = useMemo(() => {
    const base = focusTopic ? filtered.filter((p) => p.topic === focusTopic) : filtered;
    return [...base].sort((a, b) => engagement(b) - engagement(a));
  }, [filtered, focusTopic]);

  const focusAndScroll = (topic: string) => {
    setFocusTopic(topic);
    document.getElementById("posts")?.scrollIntoView({ behavior: "smooth" });
  };

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
          <span className="date-chip">
            <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z" /></svg>
            Jun 1 – Jun 30, 2026
          </span>
        </div>

        <FilterBar filters={filters} setFilters={setFilters} topics={allTopics} platforms={allPlatforms} />

        <StatTiles posts={filtered} />

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
          <h3>What people talk about</h3>
          <div className="card-sub">Topics ranked by volume, split by sentiment — click a bar to see the posts</div>
          <TopicsChart data={topics} onTopicClick={focusAndScroll} />
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

        <QualityCard />

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
