// PDF report — @react-pdf/renderer document. Deliberately numbers-and-labels
// only: the built-in Helvetica cannot shape Bangla script, so raw post text
// ships in the Excel export instead (Excel is natively UTF-8). Styled to the
// dashboard's DeepDive-sampled palette.

import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportData } from "@/lib/report";

const C = {
  ink: "#1e1d21",
  body: "#47454e",
  faint: "#73707e",
  line: "#e0dfe3",
  teal: "#2ea093",
  tealSoft: "#f0fbfa",
  red: "#b42318",
  redSoft: "#fef3f2",
  amber: "#b54708",
  amberSoft: "#fffaeb",
  green: "#067647",
  greenSoft: "#ecfdf3",
};

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: C.body },
  h1: { fontSize: 19, fontFamily: "Helvetica-Bold", color: C.ink },
  meta: { fontSize: 9, color: C.faint, marginTop: 3 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 18, marginBottom: 6 },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  kpi: { flex: 1, border: `1 solid ${C.line}`, borderRadius: 6, padding: 8 },
  kpiLabel: { fontSize: 7.5, color: C.faint, textTransform: "uppercase" },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 2 },
  row: { flexDirection: "row", borderBottom: `1 solid ${C.line}`, paddingVertical: 4 },
  headRow: { flexDirection: "row", borderBottom: `1.5 solid ${C.ink}`, paddingVertical: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: C.ink, textTransform: "uppercase" },
  actionCard: { border: `1 solid ${C.line}`, borderRadius: 6, padding: 8, marginBottom: 6 },
  actionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, color: C.ink },
  note: { fontSize: 8.5, color: C.body, marginTop: 3, lineHeight: 1.4 },
  badge: { fontSize: 7.5, fontFamily: "Helvetica-Bold", padding: "2 6", borderRadius: 8 },
  summaryBox: { backgroundColor: C.tealSoft, border: `1 solid ${C.teal}`, borderRadius: 6, padding: 10, marginTop: 12 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7.5, color: C.faint, textAlign: "center" },
});

const col = (flex: number): { flex: number } => ({ flex });

const Table = ({ headers, widths, rows }: { headers: string[]; widths: number[]; rows: (string | number)[][] }) => (
  <View>
    <View style={s.headRow}>
      {headers.map((h, i) => (
        <Text key={h} style={[s.th, col(widths[i])]}>{h}</Text>
      ))}
    </View>
    {rows.map((r, ri) => (
      <View key={ri} style={s.row} wrap={false}>
        {r.map((cell, ci) => (
          <Text key={ci} style={col(widths[ci])}>{String(cell)}</Text>
        ))}
      </View>
    ))}
  </View>
);

const verdictStyle = (v: string) =>
  v === "hold"
    ? { backgroundColor: C.redSoft, color: C.red }
    : v === "caution"
      ? { backgroundColor: C.amberSoft, color: C.amber }
      : { backgroundColor: C.greenSoft, color: C.green };

export function ReportDocument({ data, aiSummary }: { data: ReportData; aiSummary?: string }) {
  const k = data.kpis;
  return (
    <Document title="TakaPay Pulse report" author="TakaPay Pulse">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>TakaPay Pulse — social listening report</Text>
        <Text style={s.meta}>
          Range: {data.range}   |   Filters: {data.filterSummary}   |   Generated: {data.generatedAt} UTC
        </Text>

        <View style={s.kpiRow}>
          <View style={s.kpi}><Text style={s.kpiLabel}>Posts in view</Text><Text style={s.kpiValue}>{k.matched}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>Negative</Text><Text style={s.kpiValue}>{k.negative} ({k.negSharePct}%)</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>Positive</Text><Text style={s.kpiValue}>{k.positive}</Text></View>
          <View style={s.kpi}><Text style={s.kpiLabel}>Engagement</Text><Text style={s.kpiValue}>{k.totalEngagement.toLocaleString()}</Text></View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Launch gate</Text>
            <Text style={[s.kpiValue, { color: verdictStyle(k.launchVerdict).color }]}>{k.launchVerdict.toUpperCase()}</Text>
          </View>
        </View>

        {aiSummary ? (
          <View style={s.summaryBox}>
            <Text style={[s.th, { marginBottom: 4 }]}>AI executive summary</Text>
            <Text style={{ lineHeight: 1.5 }}>{aiSummary}</Text>
          </View>
        ) : null}

        <Text style={s.h2}>What needs attention first</Text>
        {data.actions.map((a) => (
          <View key={a.issue} style={s.actionCard} wrap={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={s.actionTitle}>{a.issue}</Text>
              <Text style={[s.badge, a.kind === "fix" ? { backgroundColor: C.redSoft, color: C.red } : { backgroundColor: C.amberSoft, color: C.amber }]}>
                {a.kind.toUpperCase()} - {a.posts} posts - {a.negPct}% negative
              </Text>
            </View>
            <Text style={s.note}>{a.note}</Text>
          </View>
        ))}

        <Text style={s.h2}>Topics ({data.range}, filters applied)</Text>
        <Table
          headers={["Topic", "Posts", "Positive", "Neutral", "Negative", "Neg %", "Engagement"]}
          widths={[3, 1, 1, 1, 1, 1, 1.4]}
          rows={data.topics.map((t) => [t.topic, t.total, t.positive, t.neutral, t.negative, `${t.negPct}%`, t.engagement.toLocaleString()])}
        />

        <Text style={s.h2}>Platforms</Text>
        <Table
          headers={["Platform", "Posts", "Positive", "Neutral", "Negative"]}
          widths={[3, 1, 1, 1, 1]}
          rows={data.platforms.map((p) => [p.platform, p.total, p.positive, p.neutral, p.negative])}
        />

        <Text style={s.h2}>Data quality (pipeline audit)</Text>
        <Table
          headers={["Metric", "Value"]}
          widths={[4, 1]}
          rows={data.quality.map((q) => [q.metric, q.value])}
        />
        <Text style={[s.note, { marginTop: 6 }]}>
          Per-record evidence for every exclusion and correction is available at /api/data. Raw post text
          (including Bangla script) is included in the Excel export.
        </Text>

        <Text style={s.footer} fixed>
          TakaPay Pulse - generated from the cleaned, audited feed - page numbers exact, never estimated
        </Text>
      </Page>
    </Document>
  );
}
