// The learning store — what makes the assistant improve over time without any
// model retraining. Three record kinds live in one append-friendly JSON file:
//
//   qa       — cached question→answer pairs; an exact repeat costs 0 tokens,
//              and similar past answers are surfaced to the model as context.
//   feedback — 👍/👎 (+ optional comment) on an answer. A 👎 evicts the cached
//              answer and is injected as a "known bad answer" warning when a
//              similar question comes back.
//   note     — distilled knowledge (from feedback distillation or an analyst),
//              retrieved by the search_learnings tool.
//
// File-based on purpose: right-sized for this project, and swapping it for a
// real store later only touches this module. On serverless hosts the file is
// per-instance and ephemeral — fine for a demo, a note for production.

import { promises as fs } from "fs";
import path from "path";

export type LearningKind = "qa" | "feedback" | "note";

export interface Learning {
  id: string;
  kind: LearningKind;
  createdAt: string;
  question?: string;
  answer?: string;
  verdict?: "up" | "down";
  comment?: string;
  note?: string;
}

const FILE = path.join(process.cwd(), "data", "learnings.json");

let cache: Learning[] | null = null;

async function load(): Promise<Learning[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8")) as Learning[];
  } catch {
    cache = [];
  }
  return cache;
}

async function save(list: Learning[]): Promise<void> {
  cache = list;
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf8");
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeQuestion = (q: string) =>
  q.toLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();

/** Exact-repeat cache: a question asked before (and not voted down) is free. */
export async function cachedAnswer(question: string): Promise<Learning | null> {
  const norm = normalizeQuestion(question);
  const list = await load();
  return (
    [...list].reverse().find((l) => l.kind === "qa" && l.question && normalizeQuestion(l.question) === norm) ?? null
  );
}

export async function rememberAnswer(question: string, answer: string): Promise<void> {
  const list = await load();
  const norm = normalizeQuestion(question);
  const kept = list.filter((l) => !(l.kind === "qa" && l.question && normalizeQuestion(l.question) === norm));
  kept.push({ id: newId(), kind: "qa", createdAt: new Date().toISOString(), question, answer });
  await save(kept.slice(-500)); // hard cap — the store compacts, never balloons
}

export async function recordFeedback(entry: {
  question: string;
  answer: string;
  verdict: "up" | "down";
  comment?: string;
}): Promise<void> {
  const list = await load();
  list.push({ id: newId(), kind: "feedback", createdAt: new Date().toISOString(), ...entry });
  // A downvoted answer must never be served from cache again.
  if (entry.verdict === "down") {
    const norm = normalizeQuestion(entry.question);
    for (let i = list.length - 1; i >= 0; i--) {
      const l = list[i];
      if (l.kind === "qa" && l.question && normalizeQuestion(l.question) === norm) list.splice(i, 1);
    }
  }
  await save(list.slice(-500));
}

export async function addNote(note: string): Promise<void> {
  const list = await load();
  list.push({ id: newId(), kind: "note", createdAt: new Date().toISOString(), note });
  await save(list.slice(-500));
}

/* ---------- Retrieval over learnings (word-overlap ranking) ----------
   Small corpus, so simple scoring is enough: shared words between the query
   and the learning's text, weighted toward notes and negative feedback. */

const words = (s: string) => new Set(normalizeQuestion(s).split(" ").filter((w) => w.length > 2));

export async function searchLearnings(query: string, limit = 5) {
  const list = await load();
  const qWords = words(query);
  if (qWords.size === 0) return [];
  const scored = list
    .map((l) => {
      const text = [l.question, l.answer, l.comment, l.note].filter(Boolean).join(" ");
      let overlap = 0;
      words(text).forEach((w) => {
        if (qWords.has(w)) overlap++;
      });
      const weight = l.kind === "note" ? 1.5 : l.kind === "feedback" && l.verdict === "down" ? 1.3 : 1;
      return { l, score: overlap * weight };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ l }) => ({
    kind: l.kind,
    ...(l.kind === "note"
      ? { note: l.note }
      : l.kind === "feedback"
        ? { question: l.question, verdict: l.verdict, comment: l.comment, past_answer: l.answer?.slice(0, 300) }
        : { question: l.question, past_answer: l.answer?.slice(0, 300) }),
  }));
}

export async function allLearnings(): Promise<Learning[]> {
  return load();
}
