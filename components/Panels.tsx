"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AttentionShareChart, ShareOfVoiceChart, TopicGroupBars } from "@/components/Charts";
import {
  DATA_RANGE, SENTIMENT_CHIP, SENTIMENT_COLOR, SENTIMENTS, TOPIC_GROUPS, TOPIC_LABELS, engagement,
  type ActionItem, type AmplifyTheme, type CampaignWindows, type CompetitorGap, type DateRange,
  type EngagementInsights, type Filters, type HeatCell,
  type LaunchReadiness, type Post, type RepeatedPattern, type Sentiment, type VoiceWeek,
} from "@/lib/data";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Lakh-style grouping (1,42,262) — the convention DeepDive's own dashboards use
const fmt = (n: number) => n.toLocaleString("en-IN");

function Chevron({ open, className = "chev" }: { open?: boolean; className?: string }) {
  return (
    <svg className={`${className}${open ? " open" : ""}`} viewBox="0 0 20 20">
      <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SentimentChip({ sentiment }: { sentiment: Sentiment }) {
  const c = SENTIMENT_CHIP[sentiment];
  return (
    <span className="chip" style={{ background: c.bg, borderColor: c.border, color: c.text }}>
      {cap(sentiment)}
    </span>
  );
}

/* Brand-colored platform glyphs, as in DeepDive's flagged-content table */
const PLATFORM_ICONS: Record<string, JSX.Element> = {
  Facebook: (
    <svg viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.3h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" /></svg>
  ),
  Instagram: (
    <svg viewBox="0 0 24 24"><path fill="#E4405F" d="M12 2.2c3.2 0 3.6 0 4.9.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.6 4.8-4.9 4.9-1.3.1-1.6.1-4.9.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9-.1-1.3-.1-1.6-.1-4.8s0-3.6.1-4.8C2.4 4 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 3.6a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4zm0 10.2a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-10.5a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z" /></svg>
  ),
  Twitter: (
    <svg viewBox="0 0 24 24"><path fill="#1E1D21" d="M18.9 1.2h3.7l-8.1 9.3L24 22.8h-7.5l-5.9-7.7-6.7 7.7H.2l8.7-9.9L-.2 1.2h7.7l5.3 7 6.1-7zm-1.3 19.4h2L6.4 3.3H4.2l13.4 17.3z" /></svg>
  ),
  YouTube: (
    <svg viewBox="0 0 24 24"><path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.5 15.6V8.4L15.8 12l-6.3 3.6z" /></svg>
  ),
  TikTok: (
    <svg viewBox="0 0 24 24"><path fill="#1E1D21" d="M19.6 6.7a5 5 0 0 1-3.8-4.3V2h-3.4v13.7a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.4a6.3 6.3 0 1 0 5.4 6.2V8.9a8.3 8.3 0 0 0 4.4 1.3V6.8l-.6-.1z" /></svg>
  ),
  Reddit: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#FF4500" />
      <circle cx="8.6" cy="12.5" r="1.5" fill="#fff" />
      <circle cx="15.4" cy="12.5" r="1.5" fill="#fff" />
      <path d="M8.5 16.2c1 .9 2.2 1.3 3.5 1.3s2.5-.4 3.5-1.3" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="17.8" cy="6.4" r="1.4" fill="#fff" />
      <path d="M12.2 8.6l1-4 3.4.9" stroke="#fff" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  ),
  "News/Media": (
    <svg viewBox="0 0 24 24"><path fill="#6C6E79" d="M22 3H2v16h20V3zm-2 14H4V5h16v12zM6 7h8v4H6V7zm10 0h2v2h-2V7zm0 4h2v2h-2v-2zM6 13h12v2H6v-2z" /></svg>
  ),
};

function PlatformCell({ platform }: { platform: string }) {
  return (
    <span className="plat-cell">
      {PLATFORM_ICONS[platform] ?? PLATFORM_ICONS["News/Media"]}
      {platform}
    </span>
  );
}

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
  ["#intents", "Intents", "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm0-9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
  ["#reactions", "Engagement", "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"],
  ["#repeats", "Repeated Issues", "M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"],
  ["#platforms", "Social Listening", "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9a3 3 0 0 0 0 6c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92z"],
  ["#campaign", "Campaign Planner", "M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"],
  ["#competitor", "Competitor Watch", "M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z"],
  ["#posts", "Content", "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"],
];

export function Sidebar() {
  // Scrollspy: the active item follows both clicks and scrolling. A section is
  // "current" when its top has passed the 120px line under the header.
  const [active, setActive] = useState(NAV[0][0]);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        let cur = NAV[0][0];
        for (const [href] of NAV) {
          const el = document.getElementById(href.slice(1));
          if (el && el.getBoundingClientRect().top <= 120) cur = href;
        }
        setActive(cur);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
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
        {NAV.map(([href, label, d]) => (
          <a key={href} href={href} className={active === href ? "active" : ""} onClick={() => setActive(href)}>
            <svg viewBox="0 0 24 24"><path d={d} /></svg>
            {label}
          </a>
        ))}
      </nav>
      <a className="user-card" href="https://github.com/yasin29/takapay-dashboard" target="_blank" rel="noreferrer">
        <LogoMark />
        <span>
          <b>TakaPay Pulse</b>
          <small>Source on GitHub ↗</small>
        </span>
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
        <span className="count">{selected.length > 0 ? selected.length : options.length}</span>
        <Chevron open={open} />
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

/* ---------- Date-range picker — DeepDive's modal: preset rail + two-month
   calendar + Apply/Cancel (+ Remove Comparison in compare mode). The dataset
   spans June 2026, so days outside it are shown but disabled. ---------- */

export const CAL_ICON = "M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z";

const fmtIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return fmtIso(d);
};
const spanDays = (r: DateRange) =>
  Math.round((new Date(`${r.b}T12:00:00`).getTime() - new Date(`${r.a}T12:00:00`).getTime()) / 86400000) + 1;
const fmtLong = (iso: string) => {
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(iso.slice(5, 7), 10) - 1];
  return `${m} ${parseInt(iso.slice(8, 10), 10)}, ${iso.slice(0, 4)}`;
};
const inData = (iso: string) => iso >= DATA_RANGE.a && iso <= DATA_RANGE.b;
const clampRange = (r: DateRange): DateRange | null =>
  r.a > DATA_RANGE.b || r.b < DATA_RANGE.a ? null : { a: r.a < DATA_RANGE.a ? DATA_RANGE.a : r.a, b: r.b > DATA_RANGE.b ? DATA_RANGE.b : r.b };

function CalendarMonth({
  year, month, sel, onPick,
}: {
  year: number;
  month: number; // 0-based
  sel: { a: string | null; b: string | null };
  onPick: (iso: string) => void;
}) {
  const firstCol = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstCol).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(d);
  const name = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month];
  const state = (iso: string) => {
    if (sel.a && iso === sel.a) return "end";
    if (sel.b && iso === sel.b) return "end";
    if (sel.a && sel.b && iso > sel.a && iso < sel.b) return "in";
    return "";
  };
  return (
    <div className="cal">
      <div className="cal-title">{name} {year}</div>
      <div className="cal-grid">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="cal-dow">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const enabled = inData(iso);
          return (
            <button
              key={iso}
              className={`cal-day ${state(iso)}${enabled ? "" : " off"}`}
              disabled={!enabled}
              onClick={() => onPick(iso)}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  mode, value, anchor, onApply, onRemove, onClose,
}: {
  mode: "main" | "compare";
  value: DateRange | null;
  anchor?: DateRange; // main range, used by compare presets
  onApply: (r: DateRange) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [a, setA] = useState<string | null>(value?.a ?? null);
  const [b, setB] = useState<string | null>(value?.b ?? null);

  const pick = (iso: string) => {
    if (!a || (a && b)) {
      setA(iso);
      setB(null);
    } else if (iso < a) {
      setA(iso);
    } else {
      setB(iso);
    }
  };

  const presets: { label: string; range: DateRange | null }[] =
    mode === "main"
      ? [
          { label: "Today", range: { a: DATA_RANGE.b, b: DATA_RANGE.b } },
          { label: "Yesterday", range: { a: addDays(DATA_RANGE.b, -1), b: addDays(DATA_RANGE.b, -1) } },
          { label: "This week", range: { a: "2026-06-29", b: DATA_RANGE.b } },
          { label: "Last week", range: { a: "2026-06-22", b: "2026-06-28" } },
          { label: "This month", range: DATA_RANGE },
          { label: "Last month", range: null },
          { label: "This year", range: DATA_RANGE },
          { label: "All time", range: DATA_RANGE },
        ]
      : [
          { label: "Previous period", range: anchor ? clampRange({ a: addDays(anchor.a, -spanDays(anchor)), b: addDays(anchor.a, -1) }) : null },
          { label: "Previous week", range: anchor ? clampRange({ a: addDays(anchor.a, -7), b: addDays(anchor.a, -1) }) : null },
          { label: "Previous month", range: null },
          { label: "Previous year", range: null },
        ];

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="picker">
        <button className="picker-x" onClick={onClose} aria-label="Close">✕</button>
        <div className="picker-body">
          <div className="picker-rail">
            {presets.map((p) => (
              <button
                key={p.label}
                className={p.range ? "" : "off"}
                disabled={!p.range}
                onClick={() => { if (p.range) { setA(p.range.a); setB(p.range.b); } }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="picker-cals">
            <CalendarMonth year={2026} month={5} sel={{ a, b }} onPick={pick} />
            <CalendarMonth year={2026} month={6} sel={{ a, b }} onPick={pick} />
          </div>
        </div>
        <div className="picker-foot">
          <span className="picker-input">{a ? fmtLong(a) : "Start date"}</span>
          <span className="picker-dash">–</span>
          <span className="picker-input">{b ? fmtLong(b) : "End date"}</span>
          <span style={{ flex: 1 }} />
          {mode === "compare" && onRemove && (
            <button className="btn-danger" onClick={() => { onRemove(); onClose(); }}>Remove Comparison</button>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-black"
            disabled={!a}
            onClick={() => { if (a) { onApply({ a, b: b ?? a }); onClose(); } }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

const SEARCH_ICON = "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
const LINK_ICON = "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z";

/* The whole view state lives in the URL (see page.tsx), so "share this view"
   is just copying the current address. */
function CopyViewLink() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setCopied(false));
  };
  return (
    <button className="btn-ghost" onClick={copy} title="Copy a link that opens this exact view — filters, search, and dates included">
      <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: "currentColor" }}><path d={LINK_ICON} /></svg>
      {copied ? "Copied ✓" : "Copy view link"}
    </button>
  );
}

export function FilterBar({
  filters, setFilters, topics, platforms, updatedAt,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  topics: string[];
  platforms: string[];
  updatedAt?: string;
}) {
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  return (
    <div className="filters">
      <FilterPill
        label="Sentiments" options={SENTIMENTS} selected={filters.sentiments} render={cap}
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
      <div className="search-box">
        <svg viewBox="0 0 24 24"><path d={SEARCH_ICON} /></svg>
        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          placeholder="Search post text…"
          aria-label="Search post text"
        />
        {filters.query && (
          <button className="search-x" onClick={() => setFilters({ ...filters, query: "" })} aria-label="Clear search">✕</button>
        )}
      </div>
      <CopyViewLink />
      {updatedAt && <span className="updated">Data Last Updated: {updatedAt}</span>}
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

export function StatTiles({ posts, comparePosts, rawCount }: { posts: Post[]; comparePosts?: Post[] | null; rawCount: number }) {
  const total = posts.length;
  const neg = posts.filter((p) => p.sentiment === "negative").length;
  const reactions = posts.reduce((s, p) => s + p.reactions, 0);
  const comments = posts.reduce((s, p) => s + p.comments, 0);
  // Deltas compare the selected range against the comparison range from the
  // date picker. No comparison (or an empty one) → no chips.
  const prev = comparePosts && comparePosts.length > 0 ? comparePosts : null;
  const sum = (list: Post[], f: (p: Post) => number) => list.reduce((s, p) => s + f(p), 0);
  const growth = (cur: number, prevVal: number) => (prev && prevVal > 0 ? ((cur - prevVal) / prevVal) * 100 : null);
  const negShareDelta = prev
    ? (100 * neg) / Math.max(total, 1) - (100 * prev.filter((p) => p.sentiment === "negative").length) / prev.length
    : null;

  const tiles = [
    {
      icon: TILE_ICONS.mentions, label: "Brand Mentions Counted", value: fmt(total),
      delta: growth(total, prev?.length ?? 0), goodWhenUp: true,
      note: `${fmt(rawCount)} raw, noise removed`,
    },
    {
      icon: TILE_ICONS.negative, label: "Negative Share", value: total ? `${Math.round((100 * neg) / total)}%` : "—",
      delta: negShareDelta, goodWhenUp: false,
      note: `${fmt(neg)} negative posts`,
    },
    {
      icon: TILE_ICONS.reactions, label: "Reactions", value: fmt(reactions),
      delta: growth(reactions, prev ? sum(prev, (p) => p.reactions) : 0), goodWhenUp: true,
      note: "likes and reactions on posts",
    },
    {
      icon: TILE_ICONS.comments, label: "Comments", value: fmt(comments),
      delta: growth(comments, prev ? sum(prev, (p) => p.comments) : 0), goodWhenUp: true,
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
      <h3>What needs attention first <span className="count-pill">{items.length} issues</span></h3>
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
  return (
    <div className="card" id="topics">
      <div className="card-head-row">
        <div>
          <h3>What people talk about</h3>
          <div className="card-sub">The conversation, structured the way a brand team owns it — click a bar to see the posts</div>
        </div>
        <div className="chart-note" style={{ marginTop: 4, whiteSpace: "nowrap" }}>
          <span className="legend-sq" style={{ background: SENTIMENT_COLOR.positive }} /> Positive
          <span className="legend-sq" style={{ background: SENTIMENT_COLOR.neutral }} /> Neutral
          <span className="legend-sq" style={{ background: SENTIMENT_COLOR.negative }} /> Negative
        </div>
      </div>
      <div className="tgroup-grid">
        {TOPIC_GROUPS.map((g) => {
          const present = g.topics
            .map((t) => byTopic.get(t))
            .filter((r): r is TopicRow => !!r && r.total > 0);
          if (present.length === 0) return null;
          const total = present.reduce((s, r) => s + r.total, 0);
          const negTotal = present.reduce((s, r) => s + r.negative, 0);
          const data = [...present]
            .sort((a, b) => b.total - a.total)
            .map((r) => ({ ...r, label: TOPIC_LABELS[r.topic] ?? r.topic }));
          return (
            <div className="tgroup" key={g.name}>
              <div className="tgroup-head">
                <span>{g.name}</span>
                <span className="tgroup-meta">
                  {fmt(total)} posts · {Math.round((100 * negTotal) / Math.max(total, 1))}% negative
                </span>
              </div>
              <TopicGroupBars data={data} onFocus={onFocus} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Repeated issues — the same message, again and again ---------- */

const METER_TONE: Record<Sentiment, string> = { negative: "red", positive: "teal", neutral: "gray" };

export function RepeatedIssues({ patterns, onFocus }: { patterns: RepeatedPattern[]; onFocus?: (topic: string) => void }) {
  const copies = patterns.reduce((s, p) => s + p.count, 0);
  const max = Math.max(...patterns.map((p) => p.count), 1);
  return (
    <div className="card" id="repeats">
      <h3>What people keep repeating <span className="count-pill">{fmt(copies)} posts · {patterns.length} messages</span></h3>
      <div className="card-sub">
        <b>{fmt(copies)} posts are near-copies of just {patterns.length} messages</b> — numbers, operators, and places vary; the message doesn&rsquo;t.
        That much repetition means a systemic issue, or coordinated posting. Bar length = how often it repeats, colored by what people feel.
      </div>
      <div className="rep-list">
        {patterns.map((p, i) => (
          <div
            className={`rep-item${i === 0 ? " top" : ""}${onFocus ? " click" : ""}`}
            key={p.sample}
            onClick={onFocus ? () => onFocus(p.topic) : undefined}
          >
            <div className="rep-count-wrap">
              <div className="rep-count">{p.count}×</div>
              <div className="rep-count-sub">posted</div>
            </div>
            <div className="rep-body">
              <div className="rep-text">
                {i === 0 && <span className="loud-chip">loudest message</span>}
                &ldquo;{p.sample}&rdquo;
              </div>
              <div className="meter">
                <span className={`meter-fill ${METER_TONE[p.dominant]}`} style={{ width: `${Math.round((100 * p.count) / max)}%` }} />
              </div>
              <div className="rep-meta">
                {TOPIC_LABELS[p.topic] ?? p.topic} · {p.dominantShare}% {p.dominant} ·{" "}
                {fmt(p.reactions)} reactions · {fmt(p.comments)} comments
              </div>
            </div>
            <SentimentChip sentiment={p.dominant} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Engagement panel — where the audience's attention goes ---------- */

export function EngagementPanel({ insights, onFocus }: { insights: EngagementInsights; onFocus: (topic: string) => void }) {
  const { negAttentionShare, negPostShare, top10Share, maxEng, medianEng, topPlatform, lowPlatform, topPost, rows, totalEng } = insights;
  return (
    <div className="card" id="reactions">
      <div className="card-head-row">
        <div>
          <h3>Where the attention goes <span className="count-pill">{fmt(totalEng)} reactions &amp; comments</span></h3>
          <div className="card-sub">
            Reactions and comments measure attention. Gray bar = a topic&rsquo;s share of posts, teal bar = its share
            of engagement; when teal outruns gray, that topic is spreading faster than it is posted — click a bar to see the posts.
          </div>
        </div>
      </div>
      <div className="mini-tiles">
        <div className="mini">
          <div className="mini-label">Attention on negative posts</div>
          <div className="mini-value">{negAttentionShare}%</div>
          <div className="mini-note">of all engagement, from {negPostShare}% of posts — attention tracks volume almost 1:1</div>
        </div>
        <div className="mini">
          <div className="mini-label">No viral outliers</div>
          <div className="mini-value">{top10Share}%</div>
          <div className="mini-note">
            of engagement sits in the 10 biggest posts (top {fmt(maxEng)} vs median {fmt(medianEng)}) — organic feeds are usually far spikier
          </div>
        </div>
        <div className="mini">
          <div className="mini-label">Best platform per post</div>
          <div className="mini-value">{topPlatform ? topPlatform.name : "—"}</div>
          <div className="mini-note">
            {topPlatform && lowPlatform
              ? `${fmt(topPlatform.avg)} reactions & comments per post, vs ${fmt(lowPlatform.avg)} on ${lowPlatform.name}`
              : ""}
          </div>
        </div>
      </div>
      {rows.length > 0 && <AttentionShareChart rows={rows} onFocus={onFocus} />}
      <div className="chart-note">
        The read for a brand manager: nothing here is going viral — engagement is spread almost uniformly across
        {" "}the feed, and no topic earns attention out of proportion to its volume. In an organic feed a handful of
        posts usually dominates; this flatness, together with the templated wording in &ldquo;What people keep
        repeating&rdquo;, points to volume that is manufactured rather than amplified.
        {topPost && (
          <>
            {" "}Even the single biggest post ({fmt(engagement(topPost))} reactions + comments,{" "}
            {TOPIC_LABELS[topPost.topic] ?? topPost.topic}) is only ~2× the median: &ldquo;
            {topPost.text.length > 90 ? `${topPost.text.slice(0, 90)}…` : topPost.text}&rdquo;
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Posts table (receipts) ---------- */

const PER_PAGE = 25;

// "1 2 3 … 22 23 24" with the current page always visible, DeepDive pagination style
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set([1, 2, 3, current, current + 1, total - 2, total - 1, total]);
  const nums = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (const [i, n] of nums.entries()) {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  }
  return out;
}

type SortKey = "date" | "platform" | "text" | "topic" | "sentiment" | "reactions" | "comments";

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: "Date", key: "date" },
  { label: "Platform", key: "platform" },
  { label: "Post Summary", key: "text" },
  { label: "Topic", key: "topic" },
  { label: "Sentiment", key: "sentiment" },
  { label: "Reactions", key: "reactions" },
  { label: "Comments", key: "comments" },
];

// Sentiment sorts by severity (negative first when descending), not alphabetically
const SENTIMENT_RANK: Record<Sentiment, number> = { positive: 0, neutral: 1, negative: 2 };

const SORT_VALUE: Record<SortKey, (p: Post) => string | number> = {
  date: (p) => p.timestamp,
  platform: (p) => p.platform,
  text: (p) => p.text.toLowerCase(),
  topic: (p) => TOPIC_LABELS[p.topic] ?? p.topic,
  sentiment: (p) => SENTIMENT_RANK[p.sentiment],
  reactions: (p) => p.reactions,
  comments: (p) => p.comments,
};

// Text columns open ascending (A→Z); numeric and date columns open descending
const ASC_FIRST: SortKey[] = ["platform", "text", "topic"];

export function PostsTable({ posts, focusLabel, onClearFocus }: { posts: Post[]; focusLabel?: string; onClearFocus?: () => void }) {
  const [page, setPage] = useState(1);
  // Column sort cycles per header: default direction → flipped → back to the
  // engagement order the posts arrive in.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  useEffect(() => setPage(1), [posts, sort]);
  const sorted = useMemo(() => {
    if (!sort) return posts;
    const val = SORT_VALUE[sort.key];
    return [...posts].sort((x, y) => {
      const a = val(x);
      const b = val(y);
      return (a < b ? -1 : a > b ? 1 : 0) * sort.dir;
    });
  }, [posts, sort]);
  const clickSort = (key: SortKey) => {
    const first: 1 | -1 = ASC_FIRST.includes(key) ? 1 : -1;
    setSort((s) => (!s || s.key !== key ? { key, dir: first } : s.dir === first ? { key, dir: -first as 1 | -1 } : null));
  };
  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const shown = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const sortNote = sort
    ? `sorted by ${COLUMNS.find((c) => c.key === sort.key)!.label.toLowerCase()} (${sort.dir === 1 ? "ascending" : "descending"})`
    : "sorted by engagement — click a column header to re-sort";
  return (
    <div className="card" id="posts">
      <div className="card-head-row">
        <div>
          <h3>
            The posts behind the numbers <span className="count-pill">{fmt(posts.length)} {focusLabel ? `posts · ${focusLabel}` : "posts"}</span>
          </h3>
          <div className="card-sub">Every chart above is backed by these records — {sortNote}.</div>
        </div>
        {focusLabel && onClearFocus && (
          <button className="btn-ghost" onClick={onClearFocus}>Clear focus ✕</button>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="posts-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="sortable" onClick={() => clickSort(c.key)} title={`Sort by ${c.label.toLowerCase()}`}>
                  {c.label}
                  <span className={`sort-arr${sort?.key === c.key ? " active" : ""}`}>
                    {sort?.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : "↕"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td style={{ whiteSpace: "nowrap" }}>Jun {parseInt(p.timestamp.slice(8, 10))}</td>
                <td><PlatformCell platform={p.platform} /></td>
                <td className="text-cell">{p.text}</td>
                <td style={{ whiteSpace: "nowrap" }}>{TOPIC_LABELS[p.topic] ?? p.topic}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <SentimentChip sentiment={p.sentiment} />
                  {p.corrected && <span className="corrected-chip" title="Label corrected by the pipeline's sentiment audit">fixed</span>}
                </td>
                <td>{fmt(p.reactions)}</td>
                <td>{fmt(p.comments)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button className="pg-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>← Previous</button>
        <div className="pg-nums">
          {pageNumbers(page, pages).map((n, i) =>
            n === "…" ? (
              <span key={`d${i}`} className="pg-dots">…</span>
            ) : (
              <button key={n} className={`pg-num${n === page ? " active" : ""}`} onClick={() => setPage(n)}>{n}</button>
            )
          )}
        </div>
        <button className="pg-btn next" disabled={page === pages} onClick={() => setPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}

/* ---------- Campaign planner — is it safe, what to say, where and when ---------- */

const VERDICT_ICONS: Record<LaunchReadiness["verdict"], string> = {
  hold: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.9 7.9 0 0 1 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.9 7.9 0 0 1 20 12c0 4.42-3.58 8-8 8z",
  caution: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  ready: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
};

const VERDICT_LABEL: Record<LaunchReadiness["verdict"], string> = {
  hold: "Hold paid promotion",
  caution: "Proceed with caution",
  ready: "Clear to launch",
};

const STEP_ICONS = {
  fix: "M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z",
  amplify: "M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z",
  where: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z",
  when: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z",
};

function StepHead({ tone, icon, title, sub }: { tone: "red" | "teal" | "purple" | "sky"; icon: string; title: string; sub: string }) {
  return (
    <div className="step-head">
      <span className={`step-ico ${tone}`}><svg viewBox="0 0 24 24"><path d={icon} /></svg></span>
      <span className="step-txt">
        <span className="step-title">{title}</span>
        <span className="step-sub">{sub}</span>
      </span>
    </div>
  );
}

export function CampaignPlanner({
  readiness, themes, windows, onFocus,
}: {
  readiness: LaunchReadiness;
  themes: AmplifyTheme[];
  windows: CampaignWindows;
  onFocus: (topic: string) => void;
}) {
  const hard = readiness.blockers.filter((b) => b.severity === "blocker").length;
  const reason =
    readiness.verdict === "hold"
      ? `${readiness.negShare}% of counted mentions are negative and ${hard} theme${hard === 1 ? " is" : "s are"} loudly negative — a paid campaign now puts budget behind amplifying the complaints.`
      : readiness.verdict === "caution"
        ? `No hard blockers, but ${readiness.blockers.length} warm theme${readiness.blockers.length === 1 ? "" : "s"} could flare up in the campaign's comments — prepare responses first.`
        : "No loudly negative themes in the feed — safe to draw a crowd.";
  return (
    <div className="card" id="campaign">
      <h3>Plan the next campaign</h3>
      <div className="card-sub">
        A launch is an attention magnet — it amplifies whatever people already feel.
        What to fix before drawing a crowd, what to say, and where and when to say it — all from this month&rsquo;s feed.
      </div>
      <div className={`verdict-banner ${readiness.verdict}`}>
        <svg viewBox="0 0 24 24"><path d={VERDICT_ICONS[readiness.verdict]} /></svg>
        <div>
          <b>{VERDICT_LABEL[readiness.verdict]}</b>
          <span>{reason}</span>
        </div>
      </div>
      <div className="cp-grid">
        <div className="cp-block">
          <StepHead tone="red" icon={STEP_ICONS.fix} title="Fix before you launch" sub="Loud negative themes — promote now and these fill the campaign's comments. Click to read them." />
          {readiness.blockers.map((b) => (
            <div className="gate-row" key={b.topic} onClick={() => onFocus(b.topic)}>
              <div className="gate-top">
                <span className="gate-label">{b.label}</span>
                <span className={`badge ${b.severity === "blocker" ? "fix" : "watch"}`}>
                  {b.severity === "blocker" ? "! blocker" : "~ warm"}
                </span>
                <span className="gate-meta"><b>{b.negShare}%</b> negative · {fmt(b.total)} posts</span>
              </div>
              <div className="meter"><span className="meter-fill red" style={{ width: `${b.negShare}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="cp-block">
          <StepHead tone="teal" icon={STEP_ICONS.amplify} title="Amplify what already works" sub="Themes people praise unprompted — the most-engaged post is the campaign copy, in their own words." />
          {themes.map((t) => (
            <div className="gate-row" key={t.topic} onClick={() => onFocus(t.topic)}>
              <div className="gate-top">
                <span className="gate-label">{t.label}</span>
                <span className="gate-meta"><b>{t.posShare}%</b> positive · {fmt(t.positive)} posts</span>
              </div>
              <div className="meter"><span className="meter-fill teal" style={{ width: `${t.posShare}%` }} /></div>
              {t.quotes[0] && <div className="amp-quote">&ldquo;{t.quotes[0].text}&rdquo;</div>}
            </div>
          ))}
        </div>
        <div className="cp-block">
          <StepHead tone="purple" icon={STEP_ICONS.where} title="Where to run it" sub="Positive share by platform — run the promotion where the mood is, answer complaints where they are." />
          {windows.platforms.map((p, i) => (
            <div className={`plat-row${i === 0 ? " lead" : ""}`} key={p.platform}>
              <span className="plat-row-name">{p.platform}</span>
              <span className="meter"><span className="meter-fill teal" style={{ width: `${p.posShare}%` }} /></span>
              <span className="gate-meta"><b>{p.posShare}%</b> positive · {fmt(p.avgEng)} avg eng.</span>
            </div>
          ))}
        </div>
        <HeatBlock windows={windows} />
      </div>
    </div>
  );
}

/* ---------- "When to post" heatmap — one grid, three lenses ----------
   The same weekday x daypart grid can answer three different questions:
   when posts get the most attention (avg engagement), when the conversation
   is loudest (volume), and when the mood is friendliest (% positive). */

type HeatMetric = "avgEng" | "posts" | "posShare";

const HEAT_METRICS: { key: HeatMetric; label: string; sub: string }[] = [
  { key: "avgEng", label: "Avg engagement", sub: "Average reactions + comments per post — when the audience is paying attention." },
  { key: "posts", label: "Post volume", sub: "How many posts land in each window — when the conversation is loudest." },
  { key: "posShare", label: "% positive", sub: "Share of posts that are positive — when the mood is friendliest to a promotion." },
];

function HeatBlock({ windows }: { windows: CampaignWindows }) {
  const [metric, setMetric] = useState<HeatMetric>("avgEng");
  const value = (c: HeatCell) => (metric === "avgEng" ? c.avgEng : metric === "posts" ? c.posts : c.posShare);
  const max = Math.max(...windows.cells.map(value), 1);
  // Rate metrics need a volume floor — a 100%-positive slot with 2 posts is not a window
  const best = windows.cells.reduce<HeatCell | null>(
    (a, c) => (c.posts >= 5 && (!a || value(c) > value(a)) ? c : a),
    null
  );
  const bestNote = best
    ? metric === "avgEng"
      ? `avg ${best.avgEng} reactions + comments per post`
      : metric === "posts"
        ? `${best.posts} posts — the busiest slot`
        : `${best.posShare}% positive across ${best.posts} posts`
    : "";
  return (
    <div className="cp-block">
      <StepHead tone="sky" icon={STEP_ICONS.when} title="When to post" sub={`By weekday and daypart. ${HEAT_METRICS.find((m) => m.key === metric)!.sub}`} />
      <div className="seg" role="tablist" aria-label="Heatmap metric">
        {HEAT_METRICS.map((m) => (
          <button key={m.key} role="tab" aria-selected={metric === m.key} className={metric === m.key ? "active" : ""} onClick={() => setMetric(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="heat-grid">
        <span />
        {windows.days.map((d) => (
          <span className="heat-axis" key={d}>{d}</span>
        ))}
        {windows.buckets.map((b, bi) => (
          <Fragment key={b}>
            <span className="heat-axis row">{b.split(" ")[0]}</span>
            {windows.days.map((d, di) => {
              const c = windows.cells.find((x) => x.day === d && x.bucket === b)!;
              const isBest = best && c.day === best.day && c.bucket === best.bucket;
              return (
                <span
                  key={d + b}
                  className={`heat-cell${isBest ? " best" : ""}`}
                  style={{
                    background: `rgba(46, 160, 147, ${(0.06 + 0.66 * (value(c) / max)).toFixed(2)})`,
                    animationDelay: `${(bi * 7 + di) * 22}ms`,
                  }}
                  title={`${d} ${c.bucket}: ${c.posts} posts, avg ${c.avgEng} reactions+comments, ${c.posShare}% positive`}
                >
                  {metric === "posShare" ? `${c.posShare}%` : value(c)}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
      {best && (
        <div className="best-window">
          <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
          <span>Best window: <b>{best.day}, {best.bucket.toLowerCase()}</b> — {bestNote}.</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Competitor watch — how loudly NgoodPay features in OUR feed ---------- */

const GAP_STATUSES: CompetitorGap["status"][] = ["exposed", "defensible", "unproven"];

export function CompetitorPanel({
  sov, gaps, onFocus,
}: {
  sov: VoiceWeek[];
  gaps: CompetitorGap[];
  onFocus: (topic: string) => void;
}) {
  const mentions = sov.reduce((s, w) => s + w.competitor, 0);
  const [status, setStatus] = useState<CompetitorGap["status"] | "all">("all");
  const shownGaps = status === "all" ? gaps : gaps.filter((g) => g.status === status);
  return (
    <div className="card" id="competitor">
      <div className="card-head-row">
        <div>
          <h3>Competitor watch — NgoodPay <span className="count-pill">{fmt(mentions)} mentions</span></h3>
          <div className="card-sub">
            These are posts about TakaPay that praise NgoodPay — a switching-risk signal, not NgoodPay&rsquo;s own sentiment.
            A true benchmark needs an NgoodPay source adapter in the pipeline.
          </div>
        </div>
        <button className="btn-ghost" onClick={() => onFocus("competitor")}>Read the posts →</button>
      </div>
      <div className="cp-grid">
        <div className="cp-block">
          <div className="mini-head">Share of the conversation, weekly</div>
          <ShareOfVoiceChart data={sov} />
          <div className="chart-note">A rising share means competitor comparisons are crowding out your own story — the early-warning line to watch.</div>
        </div>
        <div className="cp-block">
          <div className="mini-head">What they&rsquo;re praised for — and where it lands on us</div>
          <div className="status-chips">
            <button className={`status-chip${status === "all" ? " active" : ""}`} onClick={() => setStatus("all")}>
              All <b>{gaps.length}</b>
            </button>
            {GAP_STATUSES.map((s) => {
              const n = gaps.filter((g) => g.status === s).length;
              return (
                <button
                  key={s}
                  className={`status-chip ${s}${status === s ? " active" : ""}`}
                  disabled={n === 0}
                  onClick={() => setStatus(status === s ? "all" : s)}
                >
                  {s} <b>{n}</b>
                </button>
              );
            })}
          </div>
          {shownGaps.length === 0 && <div className="chart-note">No claims with this status in the current feed.</div>}
          {shownGaps.map((g) => (
            <div className="gap-row" key={g.claim}>
              <div className="rep-count">{g.count}×</div>
              <div className="rep-body">
                <div className="gap-claim">{g.claim}</div>
                <div className="rep-text">&ldquo;{g.sample}&rdquo;</div>
                <div className="rep-meta">
                  lands on <b>{g.againstLabel}</b> — our own {fmt(g.againstTotal)} posts there are{" "}
                  {g.status === "exposed" ? `${g.againstNegShare}% negative` : g.status === "defensible" ? `${g.againstPosShare}% positive` : "neutral (nobody vouches for us)"}
                </div>
              </div>
              <span className={`badge ${g.status === "exposed" ? "fix" : g.status === "defensible" ? "def" : "watch"}`}>{g.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
