"use client";

// Report downloads for the current view. The link carries the same query
// params as shareable dashboard URLs (viewToQuery), so the file matches
// exactly what's on screen — filters, search, and date range included.

import { useEffect, useRef, useState } from "react";
import { viewToQuery, type ViewState } from "@/lib/data";

export function ExportMenu({ view }: { view: ViewState }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const href = (extra: string) => {
    const qs = viewToQuery(view);
    return `/api/report?${qs ? qs + "&" : ""}${extra}`;
  };

  return (
    <div className="export-menu" ref={ref}>
      <button className="date-chip as-btn" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24"><path d="M12 16 6.5 10.5l1.4-1.4L11 12.2V3h2v9.2l3.1-3.1 1.4 1.4zM5 21c-.55 0-1-.45-1-1v-4h2v3h12v-3h2v4c0 .55-.45 1-1 1z" /></svg>
        Export
      </button>
      {open && (
        <div className="export-dd">
          <a href={href("format=xlsx")} download onClick={() => setOpen(false)}>
            Excel (.xlsx) <small>full data incl. every post</small>
          </a>
          <a href={href("format=pdf")} download onClick={() => setOpen(false)}>
            PDF report <small>executive one-pager</small>
          </a>
          <a href={href("format=pdf&summary=1")} download onClick={() => setOpen(false)}>
            PDF + AI summary <small>adds a written brief</small>
          </a>
        </div>
      )}
    </div>
  );
}
