"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BRAND, CHART_COLORS } from "@/lib/constants";
import { formatCompactMoney, formatMoney, formatMonthShort } from "@/lib/format";
import type { CashFlowMonthPoint } from "@/lib/analytics/finance";

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card)",
    fontSize: 12,
    color: "var(--card-foreground)",
  },
} as const;

/** Приток и отток денег по счёту 51, помесячно. */
export function CashFlowChart({ data }: { data: CashFlowMonthPoint[] }) {
  const rows = data.map((d) => ({ ...d, label: formatMonthShort(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCompactMoney(Number(v))} width={60} />
        <Tooltip {...tooltipStyle} formatter={(value) => formatMoney(Number(value))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="inflow" name="Приток" fill={BRAND.green} radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar dataKey="outflow" name="Отток" fill={BRAND.red} radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface YearlyBar {
  year: number;
  value: number;
}

/** Показатель (выручка, прибыль) по годам — для отчётности. */
export function YearlyBarChart({ data, name }: { data: YearlyBar[]; name: string }) {
  const rows = data.map((d) => ({ label: String(d.year), value: d.value }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCompactMoney(Number(v) * 1000)} width={60} />
        <Tooltip {...tooltipStyle} formatter={(v) => formatMoney(Number(v) * 1000)} />
        <Bar dataKey="value" name={name} radius={[6, 6, 0, 0]} maxBarSize={44}>
          {rows.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
