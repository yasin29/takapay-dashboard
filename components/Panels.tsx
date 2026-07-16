"use client";

import { useEffect, useRef, useState } from "react";
import {
  QUALITY, SENTIMENT_COLOR, SENTIMENTS, TOPIC_LABELS, engagement,
  type ActionItem, type Filters, type Post, type Sentiment,
} from "@/lib/data";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n: number) => n.toLocaleString("en-US");

/* ---------- Sidebar ---------- */

const NAV = [
  ["#overview", "Overview"],
  ["#attention", "Needs attention"],
  ["#sentiment", "Sentiment"],
  ["#topics", "Topics"],
  ["#platforms", "Platforms"],
  ["#quality", "Data quality"],
  ["#posts", "Posts"],
] as const;

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-mark">T</span> TakaPay Pulse
      </div>
      <nav className="nav">
        {NAV.map(([href, label], i) => (
          <a key={href} href={href} className={i === 0 ? "active" : ""}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /></svg>
            {label}
          </a>
        ))}
      </nav>
      <div className="sidebar-foot">
        Take-home task — Markopolo AI (DeepDive)
        <br />
        <a href="https://github.com/yasin29/takapay-dashboard">Source on GitHub</a>
      </div>
    </aside>
  );
}

/* ---------- Filters ---------- */

function FilterPill({
  label, options, selected, onToggle, onClear, render,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  render?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="filter" ref={ref}>
      <button className="filter-btn" onClick={() => setOpen(!open)}>
        {label}
        {selected.length > 0 && <span className="count">{selected.length}</span>}
        <span className="chev">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="filter-menu">
          {options.map((o) => (
            <label key={o}>
              <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} />
              {render ? render(o) : o}
            </label>
          ))}
          {selected.length > 0 && (
            <button className="filter-clear" onClick={onClear}>Clear</button>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  filters, setFilters, topics, platforms,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  topics: string[];
  platforms: string[];
}) {
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  return (
    <div className="filters">
      <FilterPill
        label="Sentiment" options={SENTIMENTS} selected={filters.sentiments} render={cap}
        onToggle={(v) => setFilters({ ...filters, sentiments: toggle(filters.sentiments, v) as Sentiment[] })}
        onClear={() => setFilters({ ...filters, sentiments: [] })}
      />
      <FilterPill
        label="Topic" options={topics} selected={filters.topics} render={(t) => TOPIC_LABELS[t] ?? t}
        onToggle={(v) => setFilters({ ...filters, topics: toggle(filters.topics, v) })}
        onClear={() => setFilters({ ...filters, topics: [] })}
      />
      <FilterPill
        label="Platform" options={platforms} selected={filters.platforms}
        onToggle={(v) => setFilters({ ...filters, platforms: toggle(filters.platforms, v) })}
        onClear={() => setFilters({ ...filters, platforms: [] })}
      />
    </div>
  );
}

/* ---------- Stat tiles ---------- */

export function StatTiles({ posts }: { posts: Post[] }) {
  const total = posts.length;
  const neg = posts.filter((p) => p.sentiment === "negative").length;
  const pos = posts.filter((p) => p.sentiment === "positive").length;
  const eng = posts.reduce((s, p) => s + engagement(p), 0);
  const negShare = total ? Math.round((100 * neg) / total) : 0;
  const posShare = total ? Math.round((100 * pos) / total) : 0;
  const tiles = [
    { label: "Brand mentions counted", value: fmt(total), note: `${fmt(QUALITY.raw_records)} raw, noise removed` },
    { label: "Negative share", value: `${negShare}%`, note: `${fmt(neg)} negative posts` },
    { label: "Positive share", value: `${posShare}%`, note: `${fmt(pos)} positive posts` },
    { label: "Total engagement", value: fmt(eng), note: "reactions and comments" },
  ];
  return (
    <div className="grid tiles" id="overview">
      {tiles.map((t) => (
        <div className="card tile" key={t.label}>
          <div className="tile-label">{t.label}</div>
          <div className="tile-value">{t.value}</div>
          <div className="tile-note">{t.note}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Action panel (the product call) ---------- */

export function ActionPanel({ items, onFocus }: { items: ActionItem[]; onFocus: (topic: string) => void }) {
  return (
    <div className="card" id="attention">
      <h3>What needs attention first</h3>
      <div className="card-sub">
        Issues ranked by negative volume weighted by how much attention each post draws. Click one to see the actual posts.
      </div>
      <div className="action-list">
        {items.map((a, i) => (
          <div className="action-item" key={a.topic} onClick={() => onFocus(a.topic)}>
            <div className="action-rank">{i + 1}</div>
            <div className="action-body">
              <div className="action-title-row">
                <span className="action-title">{a.label}</span>
                <span className={`badge ${a.kind}`}>{a.kind === "fix" ? "! act now" : "~ watch"}</span>
              </div>
              <div className="action-stats">
                <b>{fmt(a.total)}</b> posts · <b>{a.negShare}%</b> negative · <b>{fmt(a.eng)}</b> engagement
              </div>
              <div className="action-note">{a.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Data quality card ---------- */

export function QualityCard() {
  return (
    <div className="card" id="quality">
      <h3>Data quality — what the numbers above do not include</h3>
      <div className="card-sub">
        The raw feed is messy. Every exclusion and correction is rule-based, logged, and listed here — nothing was changed silently.
      </div>
      <div className="quality-flow">
        <span className="q-num">{fmt(QUALITY.raw_records)}</span>
        <span className="q-arrow">raw records →</span>
        <span className="q-num">{fmt(QUALITY.counted_records)}</span>
        <span className="q-arrow">counted</span>
        <span className="q-chip">{QUALITY.excluded_off_topic} off-topic</span>
        <span className="q-chip">{QUALITY.removed_duplicates} duplicates</span>
        <span className="q-chip">{QUALITY.relabeled_sentiment} re-labeled</span>
      </div>
      <div className="quality-rows">
        <details>
          <summary><span className="q-count">{QUALITY.excluded_off_topic}</span> off-topic posts excluded — flagged as brand mentions, but about traffic, food, or exams</summary>
          <ul>{QUALITY.off_topic.slice(0, 6).map((r) => <li key={r.id}>[{r.id}] {r.text}</li>)}
            {QUALITY.off_topic.length > 6 && <li>… and {QUALITY.off_topic.length - 6} more (see quality-report.json)</li>}
          </ul>
        </details>
        <details>
          <summary><span className="q-count">{QUALITY.removed_duplicates}</span> exact duplicates removed — same text posted by different authors</summary>
          <ul>{QUALITY.duplicates.slice(0, 6).map((r) => <li key={r.id}>[{r.id}] duplicate of [{r.duplicate_of}]: {r.text}</li>)}
            {QUALITY.duplicates.length > 6 && <li>… and {QUALITY.duplicates.length - 6} more</li>}
          </ul>
        </details>
        <details>
          <summary><span className="q-count">{QUALITY.relabeled_sentiment}</span> sentiment labels corrected — text plainly contradicted the label and its score</summary>
          <ul>{QUALITY.relabeled.slice(0, 6).map((r) => <li key={r.id}>[{r.id}] {r.from} → {r.to} (evidence: {r.evidence.join(", ")}): {r.text}</li>)}
            {QUALITY.relabeled.length > 6 && <li>… and {QUALITY.relabeled.length - 6} more</li>}
          </ul>
        </details>
      </div>
    </div>
  );
}

/* ---------- Posts table (receipts) ---------- */

export function PostsTable({ posts, focusLabel, onClearFocus }: { posts: Post[]; focusLabel?: string; onClearFocus?: () => void }) {
  const [limit, setLimit] = useState(25);
  const shown = posts.slice(0, limit);
  return (
    <div className="card" id="posts">
      <h3>The posts behind the numbers {focusLabel ? `— ${focusLabel}` : ""}</h3>
      <div className="card-sub">
        Every chart above is backed by these records — sorted by engagement.
        {focusLabel && onClearFocus && (
          <> <button className="filter-clear" style={{ width: "auto", display: "inline" }} onClick={onClearFocus}>Clear focus</button></>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="posts-table">
          <thead>
            <tr><th>Date</th><th>Platform</th><th>Post</th><th>Topic</th><th>Sentiment</th><th>Engage</th></tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td style={{ whiteSpace: "nowrap" }}>Jun {parseInt(p.timestamp.slice(8, 10))}</td>
                <td>{p.platform}</td>
                <td className="text-cell">{p.text}</td>
                <td style={{ whiteSpace: "nowrap" }}>{TOPIC_LABELS[p.topic] ?? p.topic}</td>
                <td>
                  <span className="sent-badge" style={{ background: `${SENTIMENT_COLOR[p.sentiment]}18`, color: SENTIMENT_COLOR[p.sentiment] }}>
                    <span className="dot" style={{ background: SENTIMENT_COLOR[p.sentiment] }} />
                    {cap(p.sentiment)}
                  </span>
                  {p.corrected && <span className="corrected-chip" title="Label corrected by the cleaning rules — see Data quality">fixed</span>}
                </td>
                <td>{fmt(engagement(p))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-note">
        Showing {shown.length} of {fmt(posts.length)} posts.{" "}
        {limit < posts.length && (
          <button className="filter-clear" style={{ width: "auto", display: "inline" }} onClick={() => setLimit(limit + 50)}>
            Show more
          </button>
        )}
      </div>
    </div>
  );
}
