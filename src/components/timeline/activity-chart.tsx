"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────
interface DayData {
  date: string;
  count: number;
}

interface WeekData {
  week: string;
  count: number;
}

interface ContributorData {
  name: string;
  login: string | null;
  avatar: string | null;
  count: number;
}

interface ActivityChartProps {
  commitsPerDay: DayData[];
  commitsPerWeek: WeekData[];
  contributors: ContributorData[];
}

// ── Palette ──────────────────────────────────────────────────────
const PIE_COLORS = [
  "#0f8ca3",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#dc2626",
  "#2563eb",
  "#db2777",
  "#0891b2",
];

function formatDay(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeek(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Shared tooltip style ─────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontSize: "12px",
};

// ── DailyLineChart ───────────────────────────────────────────────
export function DailyLineChart({ data }: { data: DayData[] }) {
  const formatted = data.map((d) => ({ ...d, label: formatDay(d.date) }));

  return (
    <div className="tl-chart-card">
      <div className="tl-chart-header">
        <span className="tl-chart-title">Daily Activity</span>
        <span className="tl-chart-sub">Last 30 days</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={formatted}
          margin={{ top: 10, right: 16, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#64748b" }}
            interval={4}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v: number) => [v, "Commits"]}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#0f8ca3"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#0f8ca3" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── WeeklyBarChart ───────────────────────────────────────────────
export function WeeklyBarChart({ data }: { data: WeekData[] }) {
  const formatted = data.map((d) => ({ ...d, label: formatWeek(d.week) }));

  return (
    <div className="tl-chart-card">
      <div className="tl-chart-header">
        <span className="tl-chart-title">Weekly Activity</span>
        <span className="tl-chart-sub">Last 12 weeks</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={formatted}
          margin={{ top: 10, right: 16, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(v: number) => [v, "Commits"]}
          />
          <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── ContributorPieChart ──────────────────────────────────────────
export function ContributorPieChart({ data }: { data: ContributorData[] }) {
  // Only top 8 + "Others"
  const top = data.slice(0, 8);
  const othersCount = data
    .slice(8)
    .reduce((sum, c) => sum + c.count, 0);
  const pieData = [
    ...top.map((c) => ({ name: c.name, value: c.count })),
    ...(othersCount > 0 ? [{ name: "Others", value: othersCount }] : []),
  ];

  return (
    <div className="tl-chart-card">
      <div className="tl-chart-header">
        <span className="tl-chart-title">Contributor Distribution</span>
        <span className="tl-chart-sub">{data.length} contributor{data.length !== 1 ? "s" : ""}</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="45%"
            outerRadius={90}
            innerRadius={52}
            dataKey="value"
            paddingAngle={3}
          >
            {pieData.map((_, index) => (
              <Cell
                key={index}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => [v, "commits"]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
