"use client";

import {
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar, LabelList,
} from "recharts";
import { SENTIMENT_COLOR, TOPIC_LABELS, type Sentiment } from "@/lib/data";

const GRID = "#efeff1";
const AXIS = { fontSize: 11, fill: "#73707e" };
const AXIS_TITLE = { fontSize: 11, fill: "#a19faa" };
const TOOLTIP_STYLE = {
  borderRadius: 10, border: "1px solid #efeff1", fontSize: 12.5, fontFamily: "inherit",
  boxShadow: "0 4px 14px rgb(0 0 0 / 8%)",
};
const LEGEND = { fontSize: 12.5 };
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
        <Legend verticalAlign="top" align="center" iconType="square" iconSize={10} wrapperStyle={LEGEND} />
        <Pie
          isAnimationActive={false}
          data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94}
          paddingAngle={2} stroke="#ffffff" strokeWidth={2}
        >
          {data.map((d) => (
            <Cell key={d.key} fill={SENTIMENT_COLOR[d.key]} />
          ))}
        </Pie>
        <text x="50%" y="52%" textAnchor="middle" style={{ fontSize: 24, fontWeight: 700, fill: "#1e1d21" }}>
          {total.toLocaleString("en-IN")}
        </text>
        <text x="50%" y="61%" textAnchor="middle" style={{ fontSize: 11, fill: "#73707e" }}>
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
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 14 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={3}
          label={{ value: "Days", position: "insideBottom", offset: -10, style: AXIS_TITLE }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false}
          label={{ value: "Mentions", angle: -90, position: "insideLeft", offset: 18, style: AXIS_TITLE }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => `June ${d}, 2026`} formatter={(v: number, n: string) => [`${v} posts`, cap(n)]} />
        <Legend verticalAlign="top" align="center" formatter={(v) => cap(v)} iconType="square" iconSize={10} wrapperStyle={{ ...LEGEND, paddingBottom: 8 }} />
        <Line isAnimationActive={false} type="linear" dataKey="positive" stroke={SENTIMENT_COLOR.positive} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line isAnimationActive={false} type="linear" dataKey="neutral" stroke={SENTIMENT_COLOR.neutral} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line isAnimationActive={false} type="linear" dataKey="negative" stroke={SENTIMENT_COLOR.negative} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PlatformChart({ data }: { data: { platform: string; positive: number; neutral: number; negative: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: -14, bottom: 0 }} barSize={26}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="platform" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} posts`, cap(n)]} cursor={{ fill: "#f4f4f5" }} />
        <Legend verticalAlign="top" align="center" formatter={(v) => cap(v)} iconType="square" iconSize={10} wrapperStyle={{ ...LEGEND, paddingBottom: 8 }} />
        <Bar isAnimationActive={false} dataKey="positive" stackId="s" fill={SENTIMENT_COLOR.positive} stroke="#fff" strokeWidth={2} />
        <Bar isAnimationActive={false} dataKey="neutral" stackId="s" fill={SENTIMENT_COLOR.neutral} stroke="#fff" strokeWidth={2} />
        <Bar isAnimationActive={false} dataKey="negative" stackId="s" fill={SENTIMENT_COLOR.negative} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]}>
          <LabelList dataKey="total" position="top" style={{ fontSize: 11, fill: "#73707e" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Horizontal stacked bars for one topic group — length = post count, honest scale */
export function TopicGroupBars({
  data, onFocus,
}: {
  data: { topic: string; label: string; positive: number; neutral: number; negative: number; total: number }[];
  onFocus: (topic: string) => void;
}) {
  const height = data.length * 40 + 36;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 34, left: 12, bottom: 0 }} barSize={16}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ ...AXIS, fontSize: 12, fill: "#47454e" }} tickLine={false} axisLine={false} width={128} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} posts`, cap(n)]} cursor={{ fill: "#f4f4f5" }} />
        <Bar isAnimationActive={false} dataKey="positive" stackId="s" fill={SENTIMENT_COLOR.positive} stroke="#fff" strokeWidth={1} onClick={(d) => onFocus(d.topic)} cursor="pointer" />
        <Bar isAnimationActive={false} dataKey="neutral" stackId="s" fill={SENTIMENT_COLOR.neutral} stroke="#fff" strokeWidth={1} onClick={(d) => onFocus(d.topic)} cursor="pointer" />
        <Bar isAnimationActive={false} dataKey="negative" stackId="s" fill={SENTIMENT_COLOR.negative} stroke="#fff" strokeWidth={1} radius={[0, 4, 4, 0]} onClick={(d) => onFocus(d.topic)} cursor="pointer">
          <LabelList dataKey="total" position="right" style={{ fontSize: 11, fontWeight: 700, fill: "#56535e" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Competitor share of the conversation, weekly. Bars, not a line — five points
   is too few for a trend line to be honest. Purple = the "watch" series color. */
export function ShareOfVoiceChart({ data }: { data: { week: string; total: number; competitor: number; share: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: -18, bottom: 0 }} barSize={34}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" allowDecimals={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "#f4f4f5" }}
          formatter={(v: number, _n, item) => {
            const p = item.payload as { competitor: number; total: number };
            return [`${v}% — ${p.competitor} of ${p.total} posts`, "NgoodPay mentions"];
          }}
        />
        <Bar isAnimationActive={false} dataKey="share" fill="#602494" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="share" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 700, fill: "#56535e" }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Topic Sentiment Split — every topic on one axis, stacked by sentiment.
   Bar height = mentions, so big topics read big; click a bar to see the posts. */
export function TopicSentimentChart({
  data, onFocus,
}: {
  data: { topic: string; label: string; positive: number; neutral: number; negative: number; total: number }[];
  onFocus: (topic: string) => void;
}) {
  const shorten = (s: string) => (s.length > 10 ? `${s.slice(0, 9)}..` : s);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 14 }} barSize={26}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickFormatter={shorten} tickLine={false} axisLine={{ stroke: GRID }} interval={0}
          label={{ value: "Topics", position: "insideBottom", offset: -10, style: AXIS_TITLE }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false}
          label={{ value: "Mentions", angle: -90, position: "insideLeft", offset: 18, style: AXIS_TITLE }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} posts`, cap(n)]} cursor={{ fill: "#f4f4f5" }} />
        <Legend verticalAlign="top" align="center" formatter={(v) => cap(v)} iconType="square" iconSize={10} wrapperStyle={{ ...LEGEND, paddingBottom: 10 }} />
        <Bar isAnimationActive={false} dataKey="positive" stackId="s" fill={SENTIMENT_COLOR.positive} stroke="#fff" strokeWidth={1} onClick={(d) => onFocus(d.topic)} cursor="pointer" />
        <Bar isAnimationActive={false} dataKey="negative" stackId="s" fill={SENTIMENT_COLOR.negative} stroke="#fff" strokeWidth={1} onClick={(d) => onFocus(d.topic)} cursor="pointer" />
        <Bar isAnimationActive={false} dataKey="neutral" stackId="s" fill={SENTIMENT_COLOR.neutral} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} onClick={(d) => onFocus(d.topic)} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Intent Based Mentions — daily counts per derived conversation signal */
export function IntentTrendChart({
  data, intents, colors,
}: {
  data: Record<string, number | string>[];
  intents: readonly string[];
  colors: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 14 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={3}
          label={{ value: "Days", position: "insideBottom", offset: -10, style: AXIS_TITLE }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false}
          label={{ value: "Mentions", angle: -90, position: "insideLeft", offset: 18, style: AXIS_TITLE }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(d) => `June ${d}, 2026`} formatter={(v: number, n: string) => [`${v} posts`, n]} />
        <Legend verticalAlign="top" align="center" iconType="square" iconSize={10} wrapperStyle={{ ...LEGEND, paddingBottom: 8 }} />
        {intents.map((i) => (
          <Line key={i} isAnimationActive={false} type="linear" dataKey={i} stroke={colors[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

const LANG_COLORS = ["#2EA093", "#602494", "#0FB7E6"];

export function LanguageDonut({ data, total }: { data: { lang: string; n: number }[]; total: number }) {
  const rows = data.map((d) => ({
    ...d,
    label: total > 0 ? `${d.lang} - ${((100 * d.n) / total).toFixed(1)}%` : d.lang,
  }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Legend verticalAlign="top" align="center" iconType="square" iconSize={10} wrapperStyle={LEGEND} />
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
