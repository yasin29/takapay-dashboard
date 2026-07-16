"use client";

// Floating insight assistant. Questions go to /api/chat, where Gemini turns
// them into deterministic tool calls over the cleaned feed. Answers arrive
// with the filters the assistant applied — shown as chips, and one click
// pushes them onto the dashboard itself. 👍/👎 feeds the learning store.

import { useEffect, useRef, useState } from "react";
import { TOPIC_LABELS } from "@/lib/data";

export interface ChatApplied {
  topics: string[];
  sentiments: string[];
  platforms: string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  applied?: ChatApplied | null;
  cached?: boolean;
  feedback?: "up" | "down";
  error?: boolean;
}

const STARTERS = [
  "What needs attention first?",
  "Compare failed transactions in the first vs second half of June",
  "Which platform is most positive about cashback offers?",
];

const appliedChips = (a: ChatApplied): string[] => [
  ...a.topics.map((t) => TOPIC_LABELS[t] ?? t),
  ...a.sentiments,
  ...a.platforms,
  ...(a.dateFrom || a.dateTo ? [`${a.dateFrom ?? "…"} → ${a.dateTo ?? "…"}`] : []),
  ...(a.search ? [`"${a.search}"`] : []),
];

export function Chatbot({ onApply }: { onApply: (a: ChatApplied) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    const history = messages
      .filter((m) => !m.error)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((ms) => [...ms, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `API ${res.status}`);
      setMessages((ms) => [...ms, { role: "assistant", content: data.answer, applied: data.applied, cached: data.cached }]);
    } catch (e) {
      setMessages((ms) => [
        ...ms,
        { role: "assistant", content: e instanceof Error ? e.message : String(e), error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const sendFeedback = async (idx: number, verdict: "up" | "down") => {
    const answer = messages[idx];
    const question = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (!answer || !question) return;
    setMessages((ms) => ms.map((m, i) => (i === idx ? { ...m, feedback: verdict } : m)));
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.content, answer: answer.content, verdict }),
    }).catch(() => {});
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label="Ask Pulse">
        {open ? (
          <svg viewBox="0 0 24 24"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24"><path d="M12 3C7 3 3 6.6 3 11c0 2.2 1 4.2 2.7 5.6-.2 1-.7 2.1-1.5 3 1.7-.2 3.2-.8 4.3-1.5 1.1.4 2.3.6 3.5.6 5 0 9-3.6 9-8S17 3 12 3z" /></svg>
        )}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div>
              <b>Ask Pulse</b>
              <small>Answers computed from the cleaned feed — filters, dates, comparisons all work</small>
            </div>
          </div>

          <div className="chat-scroll" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="chat-starters">
                <div className="chat-hint">Try one of these:</div>
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}${m.error ? " error" : ""}`}>
                <div className="chat-bubble">{m.content}</div>
                {m.role === "assistant" && !m.error && (
                  <div className="chat-meta">
                    {m.applied && appliedChips(m.applied).length > 0 && (
                      <div className="chat-chips">
                        {appliedChips(m.applied).map((c) => (
                          <span key={c} className="chat-chip">{c}</span>
                        ))}
                        <button className="chat-apply" onClick={() => onApply(m.applied!)}>
                          Apply to dashboard
                        </button>
                      </div>
                    )}
                    <div className="chat-actions">
                      {m.cached && <span className="chat-cached">from memory — 0 tokens</span>}
                      <button
                        className={m.feedback === "up" ? "on" : ""}
                        disabled={!!m.feedback}
                        onClick={() => sendFeedback(i, "up")}
                        aria-label="Good answer"
                      >
                        <svg viewBox="0 0 24 24"><path d="M2 20h2c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1H2v10zm19.8-7.8c.1-.3.2-.6.2-.9v-.6c0-1-.8-1.7-1.7-1.7H15l.8-4.1v-.3c0-.4-.2-.7-.4-1L14.4 3 8.6 8.9c-.4.3-.6.8-.6 1.3v7.9c0 1 .8 1.9 1.9 1.9h6.5c.7 0 1.3-.4 1.6-1l3.8-6.8z" /></svg>
                      </button>
                      <button
                        className={m.feedback === "down" ? "on" : ""}
                        disabled={!!m.feedback}
                        onClick={() => sendFeedback(i, "down")}
                        aria-label="Bad answer"
                      >
                        <svg viewBox="0 0 24 24" style={{ transform: "rotate(180deg)" }}><path d="M2 20h2c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1H2v10zm19.8-7.8c.1-.3.2-.6.2-.9v-.6c0-1-.8-1.7-1.7-1.7H15l.8-4.1v-.3c0-.4-.2-.7-.4-1L14.4 3 8.6 8.9c-.4.3-.6.8-.6 1.3v7.9c0 1 .8 1.9 1.9 1.9h6.5c.7 0 1.3-.4 1.6-1l3.8-6.8z" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="chat-msg assistant">
                <div className="chat-bubble chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about topics, dates, platforms…"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
              <svg viewBox="0 0 24 24"><path d="M3 20v-6l8-2-8-2V4l19 8z" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
