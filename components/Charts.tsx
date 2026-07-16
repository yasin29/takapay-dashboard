"use client";

import {
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar, LabelList,
} from "recharts";
import { SENTIMENT_COLOR, TOPIC_LABELS, type Sentiment } from "@/lib/data";

const GRID = "#eef0f2";
const AXIS = { fontSize: 11, fill: "#6b7280" };
const TOOLTIP_STYLE = {
  borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12.5,
  boxShadow: "0 4px 14px rgb(0 0 0 / 8%)",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function SentimentDonut({ split, total }: { split: Record<Sentiment, number>; total: number }) {
  const data = (Object.keys(split) as Sentiment[]).map((k) => ({
    name: total > 0 ? `${cap(k)} - ${((100 * split[k]) / total).toFixed(1)}%` : cap(k),
    key: k,
    value: split[k],
  }));
  return (
    <ResponsiveContainer width="100%" height={270}>
      <PieChart>
        <Legend verticalAlign="top" align="center" iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
        <Pie
          isAnimationActive={false}
          data={data} dataKey="value" nameKey="name" innerRadius={64} outerRadius={94}
          paddingAngle={2} stroke="#ffffff" strokeWidth={2}
        >
          {data.map((d) => (
            <Cell key={d.key} fill={SENTIMENT_COLOR[d.key]} />
          ))}
        </Pie>
        <text x="50%" y="52%" textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: "#111827" }}>
          {total.toLocaleString("en-US")}
        </text>
        <text x="50%" y="61%" textAnchor="middle" style={{ fontSize: 11, fill: "#6b7280" }}>
          mentions
        </text>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} posts`, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: { date: string; positive: number; neutral: number; negative: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={3} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => `June ${d}, 2026`} formatter={(v: number, n: string) => [`${v} posts`, cap(n)]} />
        <Legend verticalAlign="top" align="center" formatter={(v) => cap(v)} iconType="plainline" wrapperStyle={{ fontSize: 12.5, paddingBottom: 8 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="positive" stroke={SENTIMENT_COLOR.positive} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="neutral" stroke={SENTIMENT_COLOR.neutral} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="negative" stroke={SENTIMENT_COLOR.negative} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopicsChart({
  data, onTopicClick,
}: {
  data: { topic: string; positive: number; neutral: number; negative: number; total: number }[];
  onTopicClick?: (topic: string) => void;
}) {
  const rows = data.map((d) => ({ ...d, label: TOPIC_LABELS[d.topic] ?? d.topic }));
  const height = Math.max(240, rows.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, left: 30, bottom: 0 }} barCategoryGap={7}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={140} tick={{ ...AXIS, fill: "#374151" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} posts`, cap(n)]} cursor={{ fill: "#f3f7f7" }} />
        <Legend verticalAlign="top" align="center" formatter={(v) => cap(v)} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5, paddingBottom: 8 }} />
        <Bar isAnimationActive={false} dataKey="positive" stackId="s" fill={SENTIMENT_COLOR.positive} stroke="#fff" strokeWidth={2}
          onClick={(d: { topic?: string }) => d.topic && onTopicClick?.(d.topic)} cursor="pointer" />
        <Bar isAnimationActive={false} dataKey="neutral" stackId="s" fill={SENTIMENT_COLOR.neutral} stroke="#fff" strokeWidth={2}
          onClick={(d: { topic?: string }) => d.topic && onTopicClick?.(d.topic)} cursor="pointer" />
        <Bar isAnimationActive={false} dataKey="negative" stackId="s" fill={SENTIMENT_COLOR.negative} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]}
          onClick={(d: { topic?: string }) => d.topic && onTopicClick?.(d.topic)} cursor="pointer">
          <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: "#6b7280" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PlatformChart({ data }: { data: { platform: string; positive: number; neutral: number; negative: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="platform" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} posts`, cap(n)]} cursor={{ fill: "#f3f7f7" }} />
        <Legend verticalAlign="top" align="center" formatter={(v) => cap(v)} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5, paddingBottom: 8 }} />
        <Bar isAnimationActive={false} dataKey="positive" stackId="s" fill={SENTIMENT_COLOR.positive} stroke="#fff" strokeWidth={2} />
        <Bar isAnimationActive={false} dataKey="neutral" stackId="s" fill={SENTIMENT_COLOR.neutral} stroke="#fff" strokeWidth={2} />
        <Bar isAnimationActive={false} dataKey="negative" stackId="s" fill={SENTIMENT_COLOR.negative} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]}>
          <LabelList dataKey="total" position="top" style={{ fontSize: 11, fill: "#6b7280" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const LANG_COLORS = ["#0d9488", "#7c3aed", "#0ea5e9"];

export function LanguageDonut({ data, total }: { data: { lang: string; n: number }[]; total: number }) {
  const rows = data.map((d) => ({
    ...d,
    label: total > 0 ? `${d.lang} - ${((100 * d.n) / total).toFixed(1)}%` : d.lang,
  }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Legend verticalAlign="top" align="center" iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5 }} />
        <Pie
          isAnimationActive={false}
          data={rows} dataKey="n" nameKey="label" innerRadius={56} outerRadius={84}
          paddingAngle={2} stroke="#ffffff" strokeWidth={2}
        >
          {rows.map((d, i) => (
            <Cell key={d.lang} fill={LANG_COLORS[i % LANG_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} posts`, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
