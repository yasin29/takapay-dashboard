"use client";

import { useEffect, useRef, useState } from "react";
import {
  SENTIMENT_COLOR, SENTIMENTS, TOPIC_GROUPS, TOPIC_LABELS, engagement,
  type ActionItem, type Filters, type Post, type RepeatedPattern, type Sentiment,
} from "@/lib/data";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (n: number) => n.toLocaleString("en-US");

/* ---------- DeepDive logo mark (provided brand asset) ---------- */

function LogoMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.2145 1.77603C22.3969 2.02563 22.4017 2.56324 22.4065 3.42244C22.4065 4.09444 22.4065 4.77123 22.4065 5.45283C22.3825 8.08803 22.5313 10.8048 22.0513 13.2432C20.8993 21.1824 11.3136 25.0128 5.08805 19.872C1.91045 17.3328 0.470449 12.9408 1.56005 9.02884C2.41925 5.66404 5.06885 2.80323 8.41925 1.74243C9.64805 1.34883 11.664 1.53603 13.2241 1.49283C14.7553 1.49283 16.3873 1.49283 17.9137 1.49283C19.3105 1.49283 20.5345 1.48803 21.2737 1.49283C21.6049 1.51203 21.9937 1.48323 22.2097 1.75683V1.76643L22.2145 1.77603Z" fill="#1E1D21" />
      <path d="M10.32 10.1232C9.48001 10.9584 8.65441 11.8128 7.79521 12.624C7.63681 12.7728 7.32481 12.8688 7.10881 12.8304C6.94081 12.8016 6.70561 12.5328 6.69601 12.36C6.68161 12.144 6.81601 11.8608 6.97441 11.6976C8.18881 10.4544 9.42721 9.23038 10.656 8.00158C11.0736 7.58398 11.4912 7.16158 11.9136 6.74398C12.2496 6.41758 12.6432 6.39838 12.8976 6.67678C13.152 6.95038 13.1184 7.31518 12.8016 7.63678C11.976 8.46718 11.1456 9.29758 10.3152 10.1232H10.32Z" fill="white" />
      <path d="M16.2913 8.26568C13.6849 10.8721 11.0785 13.4785 8.47206 16.0849C8.01606 16.5409 7.64646 16.6081 7.34886 16.2913C7.06086 15.9841 7.12806 15.6385 7.57446 15.1921C8.88486 13.8769 10.2001 12.5665 11.5105 11.2561C12.8209 9.94568 14.1313 8.62568 15.4513 7.32488C15.6049 7.17608 15.8353 7.02728 16.0369 7.01768C16.2145 7.00808 16.4833 7.14728 16.5649 7.30088C16.6561 7.46888 16.6081 7.73288 16.5649 7.94408C16.5361 8.06408 16.3921 8.16008 16.2913 8.26088V8.26568Z" fill="white" />
      <path d="M16.9008 11.7744C15.2544 13.4256 13.6032 15.072 11.952 16.7232C11.5392 17.136 10.9968 17.0736 10.824 16.5984C10.7184 16.3104 10.824 16.08 11.0304 15.8688C11.8704 15.0336 12.7104 14.1936 13.5456 13.3584C14.3664 12.5376 15.1824 11.7168 16.008 10.9008C16.3632 10.5456 16.7472 10.5072 17.0208 10.7952C17.2848 11.0784 17.2464 11.4336 16.9008 11.7792V11.7744Z" fill="white" />
      <path d="M15.96 16.8384C15.6864 17.088 15.336 17.064 15.0912 16.824C14.856 16.5888 14.8416 16.2336 15.0816 15.9552C15.2496 15.7632 15.4416 15.5904 15.624 15.408C15.7872 15.2448 15.9408 15.072 16.1136 14.9184C16.4064 14.6592 16.7712 14.6592 17.0112 14.904C17.2416 15.1392 17.2608 15.5136 17.0208 15.7776C16.68 16.1472 16.3296 16.5024 15.96 16.8384Z" fill="white" />
      <path d="M6.39844 7.64643C7.13764 7.53123 7.55044 7.10403 7.67524 6.36963C7.71364 6.69603 7.83364 6.98883 8.06884 7.22403C8.30404 7.45923 8.58724 7.59363 8.92324 7.64163C8.59204 7.69443 8.30884 7.81923 8.07364 8.05443C7.83844 8.29443 7.71364 8.58243 7.67524 8.91843C7.62724 8.58243 7.50724 8.28963 7.26724 8.05443C7.02724 7.81923 6.73924 7.68963 6.40324 7.65123L6.39844 7.64643Z" fill="white" />
    </svg>
  );
}

/* ---------- Sidebar (DeepDive style) ---------- */

const NAV: [string, string, string][] = [
  ["#overview", "Overview", "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"],
  ["#attention", "Risk Monitoring", "M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"],
  ["#sentiment", "Sentiment", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 17.5c-2.33 0-4.31-1.46-5.11-3.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5z"],
  ["#topics", "Topics", "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"],
  ["#repeats", "Repeated Issues", "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"],
  ["#platforms", "Social Listening", "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9a3 3 0 0 0 0 6c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z"],
  ["#posts", "Content", "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"],
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <LogoMark />
        <div>
          <div className="logo-name">DeepDive</div>
          <div className="logo-sub">TakaPay pulse — take-home build</div>
        </div>
      </div>
      <nav className="nav">
        {NAV.map(([href, label, d], i) => (
          <a key={href} href={href} className={i === 0 ? "active" : ""}>
            <svg viewBox="0 0 24 24"><path d={d} /></svg>
            {label}
          </a>
        ))}
      </nav>
      <a className="demo-btn" href="https://github.com/yasin29/takapay-dashboard" target="_blank" rel="noreferrer">
        Source on GitHub <span>↗</span>
      </a>
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
        label="Topics" options={topics} selected={filters.topics} render={(t) => TOPIC_LABELS[t] ?? t}
        onToggle={(v) => setFilters({ ...filters, topics: toggle(filters.topics, v) })}
        onClear={() => setFilters({ ...filters, topics: [] })}
      />
      <FilterPill
        label="Channels" options={platforms} selected={filters.platforms}
        onToggle={(v) => setFilters({ ...filters, platforms: toggle(filters.platforms, v) })}
        onClear={() => setFilters({ ...filters, platforms: [] })}
      />
    </div>
  );
}

/* ---------- Stat tiles — one wide card, dividers, delta chips (DeepDive style) ----------
   Delta = second half of June vs first half. Colored by meaning, not direction:
   more negative share is red even though the arrow points up. */

const TILE_ICONS: Record<string, string> = {
  mentions: "M12 2a10 10 0 1 0 3.54 19.36c.46-.17.68-.7.48-1.15-.19-.43-.69-.63-1.13-.47A8 8 0 1 1 20 12v1a1.5 1.5 0 0 1-3 0v-1a5 5 0 1 0-1.46 3.54A3.5 3.5 0 0 0 22 13v-1A10 10 0 0 0 12 2zm0 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z",
  negative: "M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6h-6z",
  reactions: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  comments: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
};

function halfSplit(posts: Post[]) {
  const h1 = posts.filter((p) => p.timestamp.slice(8, 10) <= "15");
  const h2 = posts.filter((p) => p.timestamp.slice(8, 10) > "15");
  return { h1, h2 };
}

function Delta({ pct, goodWhenUp }: { pct: number | null; goodWhenUp: boolean }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={`delta ${good ? "up" : "down"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function StatTiles({ posts, rawCount }: { posts: Post[]; rawCount: number }) {
  const total = posts.length;
  const neg = posts.filter((p) => p.sentiment === "negative").length;
  const reactions = posts.reduce((s, p) => s + p.reactions, 0);
  const comments = posts.reduce((s, p) => s + p.comments, 0);
  const { h1, h2 } = halfSplit(posts);
  const growth = (a: number, b: number) => (a > 0 ? ((b - a) / a) * 100 : null);
  const shareDelta = (sel: (p: Post) => boolean) => {
    if (h1.length === 0 || h2.length === 0) return null;
    const s1 = (100 * h1.filter(sel).length) / h1.length;
    const s2 = (100 * h2.filter(sel).length) / h2.length;
    return s2 - s1;
  };
  const sum = (list: Post[], f: (p: Post) => number) => list.reduce((s, p) => s + f(p), 0);

  const tiles = [
    {
      icon: TILE_ICONS.mentions, label: "Brand Mentions Counted", value: fmt(total),
      delta: growth(h1.length, h2.length), goodWhenUp: true,
      note: `${fmt(rawCount)} raw, noise removed`,
    },
    {
      icon: TILE_ICONS.negative, label: "Negative Share", value: total ? `${Math.round((100 * neg) / total)}%` : "—",
      delta: shareDelta((p) => p.sentiment === "negative"), goodWhenUp: false,
      note: `${fmt(neg)} negative posts`,
    },
    {
      icon: TILE_ICONS.reactions, label: "Reactions", value: fmt(reactions),
      delta: growth(sum(h1, (p) => p.reactions), sum(h2, (p) => p.reactions)), goodWhenUp: true,
      note: "likes and reactions on posts",
    },
    {
      icon: TILE_ICONS.comments, label: "Comments", value: fmt(comments),
      delta: growth(sum(h1, (p) => p.comments), sum(h2, (p) => p.comments)), goodWhenUp: true,
      note: "replies and discussion",
    },
  ];

  return (
    <div className="card tiles-card" id="overview">
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <div className="tile-label">
            <svg viewBox="0 0 24 24"><path d={t.icon} /></svg>
            {t.label}
          </div>
          <div className="tile-value">
            {t.value}
            <Delta pct={t.delta} goodWhenUp={t.goodWhenUp} />
          </div>
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
                <b>{fmt(a.total)}</b> posts · <b>{a.negShare}%</b> negative · <b>{fmt(a.reactions)}</b> reactions · <b>{fmt(a.comments)}</b> comments
              </div>
              <div className="action-note">{a.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Topic groups — the conversation, structured ---------- */

interface TopicRow {
  topic: string; positive: number; neutral: number; negative: number; total: number;
}

export function TopicGroups({
  rows, onFocus,
}: {
  rows: TopicRow[];
  onFocus: (topic: string) => void;
}) {
  const byTopic = new Map(rows.map((r) => [r.topic, r]));
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="card" id="topics">
      <h3>What people talk about</h3>
      <div className="card-sub">The conversation, structured the way a brand team owns it — click a row to see the posts</div>
      {TOPIC_GROUPS.map((g) => {
        const present = g.topics.map((t) => byTopic.get(t)).filter((r): r is TopicRow => !!r && r.total > 0);
        if (present.length === 0) return null;
        const total = present.reduce((s, r) => s + r.total, 0);
        const negTotal = present.reduce((s, r) => s + r.negative, 0);
        return (
          <div className="tgroup" key={g.name}>
            <div className="tgroup-head">
              <span>{g.name}</span>
              <span className="tgroup-meta">
                {fmt(total)} posts · {Math.round((100 * negTotal) / Math.max(total, 1))}% negative
              </span>
            </div>
            {present.map((r) => (
              <div className="trow" key={r.topic} onClick={() => onFocus(r.topic)} title="See the posts behind this row">
                <div className="trow-label">{TOPIC_LABELS[r.topic] ?? r.topic}</div>
                <div className="trow-bar">
                  {SENTIMENTS.filter((sn) => r[sn] > 0).map((sn) => (
                    <span
                      key={sn}
                      className="seg"
                      style={{ width: `${(100 * r[sn]) / maxTotal}%`, background: SENTIMENT_COLOR[sn] }}
                      title={`${cap(sn)}: ${r[sn]}`}
                    />
                  ))}
                </div>
                <div className="trow-count">{r.total}</div>
              </div>
            ))}
          </div>
        );
      })}
      <div className="chart-note">
        <span className="legend-dot" style={{ background: SENTIMENT_COLOR.positive }} /> Positive
        <span className="legend-dot" style={{ background: SENTIMENT_COLOR.neutral }} /> Neutral
        <span className="legend-dot" style={{ background: SENTIMENT_COLOR.negative }} /> Negative
      </div>
    </div>
  );
}

/* ---------- Repeated issues — the same message, again and again ---------- */

export function RepeatedIssues({ patterns }: { patterns: RepeatedPattern[] }) {
  return (
    <div className="card" id="repeats">
      <h3>What people keep repeating</h3>
      <div className="card-sub">
        Near-identical wording posted again and again by different accounts (numbers, operators, and places vary; the message doesn&rsquo;t).
        High repetition means a systemic issue — or coordinated posting.
      </div>
      <div className="rep-list">
        {patterns.map((p) => (
          <div className="rep-item" key={p.sample}>
            <div className="rep-count">{p.count}×</div>
            <div className="rep-body">
              <div className="rep-text">&ldquo;{p.sample}&rdquo;</div>
              <div className="rep-meta">
                {TOPIC_LABELS[p.topic] ?? p.topic} · {p.dominantShare}% {p.dominant} ·{" "}
                {fmt(p.reactions)} reactions · {fmt(p.comments)} comments
              </div>
            </div>
            <span className="sent-badge" style={{ background: `${SENTIMENT_COLOR[p.dominant]}18`, color: SENTIMENT_COLOR[p.dominant] }}>
              <span className="dot" style={{ background: SENTIMENT_COLOR[p.dominant] }} />
              {cap(p.dominant)}
            </span>
          </div>
        ))}
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
            <tr><th>Date</th><th>Platform</th><th>Post</th><th>Topic</th><th>Sentiment</th><th>Reactions</th><th>Comments</th></tr>
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
                  {p.corrected && <span className="corrected-chip" title="Label corrected by the pipeline's sentiment audit">fixed</span>}
                </td>
                <td>{fmt(p.reactions)}</td>
                <td>{fmt(p.comments)}</td>
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
