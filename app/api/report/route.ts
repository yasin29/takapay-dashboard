// GET /api/report?format=xlsx|pdf — downloadable reports over the current
// dashboard view. Accepts the SAME query params as the dashboard's shareable
// URLs (s/t/p/q/r via queryToView), so the export always matches what's on
// screen. Excel carries the full data including Bangla post text; the PDF is
// the executive one-pager. ?summary=1 adds an AI-written brief (one small
// Gemini call, cached for 5 minutes per view).

import { NextResponse } from "next/server";

import { getPipelineResult } from "@/lib/server-data";
import { buildReportData, type ReportData } from "@/lib/report";
import { queryToView } from "@/lib/data";

export const dynamic = "force-dynamic";

/* ---------- optional AI executive summary ---------- */

const summaryCache = new Map<string, { at: number; text: string }>();
const SUMMARY_TTL = 5 * 60 * 1000;

async function aiSummary(data: ReportData, cacheKey: string): Promise<string | undefined> {
  if (!process.env.OPENAI_API_KEY) return undefined;
  const hit = summaryCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SUMMARY_TTL) return hit.text;
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI();
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL ?? "gemini-3.1-flash-lite",
      max_completion_tokens: 300,
      messages: [
        {
          role: "user",
          content:
            "Write a 3-4 sentence executive summary in English for a brand manager, based only on these exact numbers (do not invent any). Lead with the most urgent finding.\n" +
            JSON.stringify({ range: data.range, filters: data.filterSummary, kpis: data.kpis, topics: data.topics.slice(0, 6), actions: data.actions }),
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (text) summaryCache.set(cacheKey, { at: Date.now(), text });
    return text ?? undefined;
  } catch {
    return undefined; // report still ships without the summary
  }
}

/* ---------- Excel ---------- */

async function excelReport(data: ReportData): Promise<Buffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "TakaPay Pulse";

  const head = (ws: import("exceljs").Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).border = { bottom: { style: "medium" } };
  };

  const ov = wb.addWorksheet("Overview");
  ov.columns = [{ header: "Metric", key: "m", width: 34 }, { header: "Value", key: "v", width: 40 }];
  ov.addRows([
    { m: "Date range", v: data.range },
    { m: "Filters", v: data.filterSummary },
    { m: "Generated (UTC)", v: data.generatedAt },
    { m: "Posts in view", v: data.kpis.matched },
    { m: "Counted posts (whole feed)", v: data.kpis.counted },
    { m: "Positive", v: data.kpis.positive },
    { m: "Neutral", v: data.kpis.neutral },
    { m: "Negative", v: data.kpis.negative },
    { m: "Negative share", v: `${data.kpis.negSharePct}%` },
    { m: "Total engagement", v: data.kpis.totalEngagement },
    { m: "Campaign launch gate", v: data.kpis.launchVerdict },
  ]);
  head(ov);

  const act = wb.addWorksheet("Attention");
  act.columns = [
    { header: "Issue", key: "issue", width: 26 }, { header: "Kind", key: "kind", width: 8 },
    { header: "Posts", key: "posts", width: 8 }, { header: "Negative %", key: "negPct", width: 11 },
    { header: "Recommended action", key: "note", width: 90 },
  ];
  act.addRows(data.actions);
  head(act);

  const top = wb.addWorksheet("Topics");
  top.columns = [
    { header: "Topic", key: "topic", width: 26 }, { header: "Posts", key: "total", width: 8 },
    { header: "Positive", key: "positive", width: 9 }, { header: "Neutral", key: "neutral", width: 9 },
    { header: "Negative", key: "negative", width: 9 }, { header: "Negative %", key: "negPct", width: 11 },
    { header: "Engagement", key: "engagement", width: 12 },
  ];
  top.addRows(data.topics);
  head(top);

  const plat = wb.addWorksheet("Platforms");
  plat.columns = [
    { header: "Platform", key: "platform", width: 16 }, { header: "Posts", key: "total", width: 8 },
    { header: "Positive", key: "positive", width: 9 }, { header: "Neutral", key: "neutral", width: 9 },
    { header: "Negative", key: "negative", width: 9 },
  ];
  plat.addRows(data.platforms);
  head(plat);

  const day = wb.addWorksheet("Daily trend");
  day.columns = [
    { header: "Date", key: "date", width: 10 }, { header: "Positive", key: "positive", width: 9 },
    { header: "Neutral", key: "neutral", width: 9 }, { header: "Negative", key: "negative", width: 9 },
  ];
  day.addRows(data.daily);
  head(day);

  const q = wb.addWorksheet("Data quality");
  q.columns = [{ header: "Metric", key: "metric", width: 32 }, { header: "Value", key: "value", width: 10 }];
  q.addRows(data.quality);
  q.addRow({});
  q.addRow({ metric: "Corrected sentiment labels (evidence at /api/data):" }).font = { bold: true };
  const rel = q.addRow({ metric: "Post id", value: "from -> to, text" });
  rel.font = { bold: true };
  data.relabeled.forEach((r) => q.addRow({ metric: r.id, value: `${r.from} -> ${r.to} | ${r.text}` }));
  head(q);

  const posts = wb.addWorksheet("Posts");
  posts.columns = [
    { header: "ID", key: "id", width: 7 }, { header: "Date", key: "date", width: 17 },
    { header: "Platform", key: "platform", width: 12 }, { header: "Author", key: "author", width: 18 },
    { header: "Language", key: "language", width: 9 }, { header: "Topic", key: "topic", width: 20 },
    { header: "Sentiment", key: "sentiment", width: 10 }, { header: "Score", key: "score", width: 7 },
    { header: "Reactions", key: "reactions", width: 10 }, { header: "Comments", key: "comments", width: 10 },
    { header: "Label corrected", key: "corrected", width: 14 }, { header: "Text", key: "text", width: 110 },
  ];
  posts.addRows(
    data.posts.map((p) => ({
      id: p.id, date: p.timestamp, platform: p.platform, author: p.author, language: p.language,
      topic: p.topic, sentiment: p.sentiment, score: p.sentiment_score,
      reactions: p.reactions, comments: p.comments, corrected: p.corrected ? "yes" : "", text: p.text,
    }))
  );
  head(posts);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- route ---------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "xlsx";
  const withSummary = url.searchParams.get("summary") === "1";

  const result = await getPipelineResult();
  const view = queryToView(url.search);
  const data = buildReportData(result, view);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const buf = await excelReport(data);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="takapay-pulse-${stamp}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const summary = withSummary ? await aiSummary(data, url.search) : undefined;
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { ReportDocument } = await import("@/lib/report-pdf");
    // Call the component directly: the returned element is the <Document>
    // root, which is what renderToBuffer's DocumentProps type expects.
    const buf = await renderToBuffer(ReportDocument({ data, aiSummary: summary }));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="takapay-pulse-${stamp}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "format must be 'xlsx' or 'pdf'" }, { status: 400 });
}
