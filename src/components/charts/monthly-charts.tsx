"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BRAND, CHART_COLORS } from "@/lib/constants";
import { formatCompactMoney, formatMoney, formatMonthShort, formatNumber } from "@/lib/format";

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

export interface MonthlyPoint {
  month: string;
  amount: number;
  orders: number;
  avgCheck: number;
  clients: number;
}

/** Выручка по месяцам (столбцы) + количество заказов (линия). */
export function RevenueChart({ data }: { data: MonthlyPoint[] }) {
  const rows = data.map((d) => ({ ...d, label: formatMonthShort(d.month) }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis
          yAxisId="left"
          {...axisProps}
          tickFormatter={(v) => formatCompactMoney(Number(v))}
          width={60}
        />
        <YAxis yAxisId="right" orientation="right" {...axisProps} width={36} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value, name) =>
            name === "Выручка" ? formatMoney(Number(value)) : String(value)
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          yAxisId="left"
          dataKey="amount"
          name="Выручка"
          fill={BRAND.orange}
          radius={[6, 6, 0, 0]}
          maxBarSize={44}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          name="Заказы"
          stroke={BRAND.gray}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Средний чек по месяцам. */
export function AvgCheckChart({ data }: { data: MonthlyPoint[] }) {
  const rows = data.map((d) => ({ ...d, label: formatMonthShort(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => formatCompactMoney(Number(v))} width={60} />
        <Tooltip {...tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
        <Line
          type="monotone"
          dataKey="avgCheck"
          name="Средний чек"
          stroke={BRAND.orange}
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Горизонтальный рейтинг (магазины, товары, клиенты). */
export function RankBarChart({
  data,
  height = 260,
}: {
  data: { name: string; amount: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          {...axisProps}
          tickFormatter={(v) => formatCompactMoney(Number(v))}
        />
        <YAxis type="category" dataKey="name" {...axisProps} width={170} />
        <Tooltip {...tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
        <Bar dataKey="amount" name="Сумма" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Распределение заказов по статусам. */
export function StatusDonut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={52}
          outerRadius={84}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export const FUNNEL_COLORS = [BRAND.orange, "#f2ba52", BRAND.gray];

export interface FunnelStage {
  name: string;
  value: number;
  /** Подпись под названием в легенде — например «82 % от оформленных». */
  hint?: string;
}

/** Воронка заказов: оформлено → оплачено → завершено. */
export function OrderFunnelChart({ data }: { data: FunnelStage[] }) {
  const rows = data.map((d, i) => ({ ...d, fill: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <FunnelChart margin={{ top: 4, right: 24, bottom: 4, left: 24 }}>
          <Tooltip {...tooltipStyle} formatter={(value) => formatNumber(Number(value))} />
          <Funnel dataKey="value" data={rows} isAnimationActive nameKey="name">
            <LabelList
              position="center"
              dataKey="value"
              stroke="none"
              fill="#ffffff"
              fontSize={16}
              fontWeight={700}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {rows.map((stage) => (
          <div key={stage.name} className="min-w-0">
            <span
              className="mx-auto mb-1 block size-2 rounded-full"
              style={{ background: stage.fill }}
            />
            <p className="truncate text-xs font-medium whitespace-nowrap">{stage.name}</p>
            {stage.hint && (
              <p className="text-muted-foreground truncate text-xs whitespace-nowrap">
                {stage.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Профиль района по критериям оценки. */
export function DistrictRadar({ data }: { data: { criterion: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
        <Radar
          name="Балл"
          dataKey="score"
          stroke={BRAND.orange}
          fill={BRAND.orange}
          fillOpacity={0.35}
        />
        <Tooltip {...tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
