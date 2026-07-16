// POST /api/chat — the insight assistant. Gemini (via its OpenAI-compatible
// endpoint) translates a natural-language question into tool calls; the tools
// run deterministic TypeScript over pipeline-cleaned records, so every number
// in an answer is computed, never estimated. Token diet: cached answers for
// repeated questions, compact aggregate-shaped tool results, a non-thinking
// model, and a short system prompt.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { getPipelineResult } from "@/lib/server-data";
import { comparePeriods, overview, resolveTopic, summarizeSlice, type ComparePeriodsArgs, type PostQuery } from "@/lib/search";
import { cachedAnswer, rememberAnswer, searchLearnings } from "@/lib/learnings";
import { TOPIC_LABELS } from "@/lib/data";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_CHAT_MODEL ?? "gemini-3.1-flash-lite";
const MAX_TOOL_ROUNDS = 6;

const client = new OpenAI(); // OPENAI_API_KEY + OPENAI_BASE_URL from env

const SYSTEM_PROMPT = `You are the TakaPay Pulse insight assistant, embedded in a social-listening dashboard for TakaPay (a Bangladeshi mobile wallet). The data: 660 cleaned social posts about TakaPay from June 2026 (2026-06-01 to 2026-06-30) across 7 platforms, in Bangla, English, and mixed "Banglish".

Rules:
- NEVER state a number you did not get from a tool this turn. Always call tools for counts, shares, comparisons, and examples.
- Answer briefly for a brand manager: the finding first, then 1-3 supporting numbers, then (only if useful) one recommended action. No filler.
- When the user gives a vague time ("first week", "late June"), translate it to explicit dates within June 2026 and say which dates you used.
- Competitor (NgoodPay) posts are posts about TakaPay that praise NgoodPay — a switching-risk signal, not NgoodPay's own sentiment. Frame them that way.
- Use search_learnings when the question might relate to past feedback or saved insights; if a past answer to a similar question was voted down, do better and avoid its mistake.
- Topics: ${Object.values(TOPIC_LABELS).join(", ")}.`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "query_posts",
      description:
        "Filter and aggregate the cleaned posts. Returns counts, sentiment shares, top topics, engagement, and a few sample posts for the matching slice. Use for any 'how many / what share / show me' question.",
      parameters: {
        type: "object",
        properties: {
          topics: { type: "array", items: { type: "string" }, description: "Topic names, e.g. ['Failed transactions']" },
          sentiments: { type: "array", items: { type: "string", enum: ["positive", "neutral", "negative"] } },
          platforms: { type: "array", items: { type: "string" } },
          dateFrom: { type: "string", description: "YYYY-MM-DD, within 2026-06" },
          dateTo: { type: "string", description: "YYYY-MM-DD, within 2026-06" },
          search: { type: "string", description: "Keyword search over post text (Bangla and English both work)" },
          limit: { type: "number", description: "Sample posts to return (default 5, max 12)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_periods",
      description:
        "Compare two date ranges: post volume, sentiment shares, engagement, top topics, and deltas. Optional topic/sentiment/platform filters apply to both periods.",
      parameters: {
        type: "object",
        properties: {
          periodA: {
            type: "object",
            properties: { from: { type: "string" }, to: { type: "string" } },
            required: ["from", "to"],
          },
          periodB: {
            type: "object",
            properties: { from: { type: "string" }, to: { type: "string" } },
            required: ["from", "to"],
          },
          topics: { type: "array", items: { type: "string" } },
          sentiments: { type: "array", items: { type: "string", enum: ["positive", "neutral", "negative"] } },
          platforms: { type: "array", items: { type: "string" } },
        },
        required: ["periodA", "periodB"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_overview",
      description:
        "Whole-month overview: totals, sentiment, all topics, what needs attention first, campaign-launch readiness, and the data-quality report. Use for broad questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_learnings",
      description:
        "Search saved knowledge: past Q&A, user feedback on previous answers, and distilled insight notes. Check this when a question may repeat or build on earlier ones.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
];

/** Filters the assistant applied, surfaced to the UI as chips + "apply to dashboard". */
interface AppliedFilters {
  topics: string[];
  sentiments: string[];
  platforms: string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function POST(req: Request) {
  let body: { question?: string; history?: { role: "user" | "assistant"; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const question = body.question?.trim();
  if (!question) return NextResponse.json({ error: "Missing 'question'" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server" }, { status: 500 });
  }

  // 0-token path: exact repeat of a question that wasn't voted down.
  const history = (body.history ?? []).slice(-6);
  if (history.length === 0) {
    const hit = await cachedAnswer(question);
    if (hit?.answer) {
      return NextResponse.json({ answer: hit.answer, cached: true, applied: null });
    }
  }

  const { records } = await getPipelineResult();
  const result = await getPipelineResult();

  const applied: AppliedFilters = { topics: [], sentiments: [], platforms: [] };
  const mergeApplied = (q: PostQuery) => {
    // Canonical topic keys, so the dashboard can apply these chips directly.
    q.topics
      ?.map(resolveTopic)
      .filter((t): t is string => t !== null)
      .forEach((t) => !applied.topics.includes(t) && applied.topics.push(t));
    q.sentiments?.forEach((s) => !applied.sentiments.includes(s) && applied.sentiments.push(s));
    q.platforms?.forEach((p) => !applied.platforms.includes(p) && applied.platforms.push(p));
    if (q.dateFrom) applied.dateFrom = q.dateFrom;
    if (q.dateTo) applied.dateTo = q.dateTo;
    if (q.search) applied.search = q.search;
  };

  const runTool = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    switch (name) {
      case "query_posts":
        mergeApplied(args as PostQuery);
        return summarizeSlice(records, records, args as PostQuery);
      case "compare_periods":
        mergeApplied(args as PostQuery);
        return comparePeriods(records, args as unknown as ComparePeriodsArgs);
      case "get_overview":
        return overview(result);
      case "search_learnings":
        return await searchLearnings(String(args.query ?? question));
      default:
        return { error: `Unknown tool: ${name}` };
    }
  };

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
    { role: "user", content: question },
  ];

  let totalTokens = 0;
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOLS,
        // Non-thinking model — the whole budget goes to the visible answer.
        max_completion_tokens: 900,
      });
      totalTokens += completion.usage?.total_tokens ?? 0;
      const msg = completion.choices[0]?.message;
      if (!msg) break;

      if (msg.tool_calls?.length && round < MAX_TOOL_ROUNDS) {
        // Push the assistant turn verbatim — Gemini attaches thought signatures
        // in extra fields that must round-trip untouched.
        messages.push(msg as ChatCompletionMessageParam);
        for (const call of msg.tool_calls) {
          if (call.type !== "function") continue;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            /* leave args empty — the tool will answer over the whole feed */
          }
          const toolResult = await runTool(call.function.name, args);
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(toolResult) });
        }
        continue;
      }

      const answer = msg.content?.trim();
      if (!answer) break;
      if (history.length === 0) await rememberAnswer(question, answer);
      const hasFilters =
        applied.topics.length > 0 || applied.sentiments.length > 0 || applied.platforms.length > 0 ||
        !!applied.dateFrom || !!applied.search;
      return NextResponse.json({
        answer,
        cached: false,
        applied: hasFilters ? applied : null,
        tokens: totalTokens,
      });
    }
    return NextResponse.json(
      { error: "The model did not produce an answer — please rephrase and try again." },
      { status: 502 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Model call failed: ${msg}` }, { status: 502 });
  }
}
