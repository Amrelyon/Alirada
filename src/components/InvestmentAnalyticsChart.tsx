import React, { useMemo, useState } from 'react';
import { InvestmentChartPoint } from '../lib/ledgerMath';

interface InvestmentAnalyticsChartProps {
  points: InvestmentChartPoint[];
  title: string;
  subtitle?: string;
  showInvested?: boolean;
}

export const InvestmentAnalyticsChart: React.FC<InvestmentAnalyticsChartProps> = ({
  points,
  title,
  subtitle,
  showInvested = false,
}) => {
  const safePoints = points.length > 0 ? points : [
    { label: 'Start', date: new Date().toISOString().slice(0, 10), invested: 0, cost: 0, income: 0, net: 0 },
  ];

  const [selectedIdx, setSelectedIdx] = useState<number>(safePoints.length - 1);
  const clampedIdx = Math.min(Math.max(0, selectedIdx), safePoints.length - 1);
  const activePoint = safePoints[clampedIdx];

  const width = 760;
  const height = 240;
  const padLeft = 52;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxY = useMemo(() => {
    let maxVal = 10;
    for (const p of safePoints) {
      if (p.cost > maxVal) maxVal = p.cost;
      if (p.income > maxVal) maxVal = p.income;
      if (showInvested && p.invested > maxVal) maxVal = p.invested;
    }
    return Math.ceil(maxVal * 1.15);
  }, [safePoints, showInvested]);

  const toX = (idx: number) => {
    if (safePoints.length === 1) return padLeft + plotW / 2;
    return padLeft + (idx / (safePoints.length - 1)) * plotW;
  };

  const toY = (val: number) => padTop + plotH - (Math.max(0, val) / maxY) * plotH;

  const buildPath = (accessor: (p: InvestmentChartPoint) => number) =>
    safePoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(accessor(p)).toFixed(1)}`)
      .join(' ');

  const incomePath = buildPath((p) => p.income);
  const costPath = buildPath((p) => p.cost);
  const investedPath = showInvested ? buildPath((p) => p.invested) : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxY * r));

  return (
    <div className="bg-white dark:bg-[#12151B] border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
          {subtitle && (
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
            <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
            Accumulated Income
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-medium">
            <span className="w-3 h-0.5 bg-rose-500 inline-block" />
            Accumulated Cost
          </span>
          {showInvested && (
            <span className="inline-flex items-center gap-1.5 text-[#B88B1E] dark:text-[#D4AF37] font-medium">
              <span className="w-3 h-0.5 bg-[#D4AF37] inline-block" />
              Accumulated Investments
            </span>
          )}
        </div>
      </div>

      {/* Interactive SVG Diagram */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[480px] h-56 select-none"
          role="img"
          aria-label={title}
        >
          {/* Gridlines & Y Ticks */}
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  className="stroke-stone-200 dark:stroke-stone-800"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-stone-400 dark:fill-stone-500 text-[10px] font-mono-tabular"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Invested Capital Line */}
          {showInvested && investedPath && (
            <path
              d={investedPath}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          )}

          {/* Accumulated Cost Line */}
          <path d={costPath} fill="none" stroke="#F43F5E" strokeWidth="2.5" strokeLinejoin="round" />

          {/* Accumulated Income Line */}
          <path d={incomePath} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinejoin="round" />

          {/* Data Points & X Axis Labels */}
          {safePoints.map((pt, idx) => {
            const x = toX(idx);
            const isSel = idx === clampedIdx;
            return (
              <g
                key={`${pt.label}-${idx}`}
                className="cursor-pointer"
                onClick={() => setSelectedIdx(idx)}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                {isSel && (
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={height - padBottom}
                    className="stroke-stone-300 dark:stroke-stone-700"
                    strokeWidth="1"
                  />
                )}
                {showInvested && (
                  <circle
                    cx={x}
                    cy={toY(pt.invested)}
                    r={isSel ? 4.5 : 3}
                    fill="#D4AF37"
                  />
                )}
                <circle
                  cx={x}
                  cy={toY(pt.cost)}
                  r={isSel ? 5 : 3.5}
                  fill="#F43F5E"
                />
                <circle
                  cx={x}
                  cy={toY(pt.income)}
                  r={isSel ? 5 : 3.5}
                  fill="#10B981"
                />
                {(safePoints.length <= 8 || idx === 0 || idx === safePoints.length - 1 || isSel) && (
                  <text
                    x={x}
                    y={height - 12}
                    textAnchor="middle"
                    className={`text-[10px] font-mono-tabular ${
                      isSel
                        ? 'fill-stone-900 dark:fill-stone-100 font-semibold'
                        : 'fill-stone-400 dark:fill-stone-500'
                    }`}
                  >
                    {pt.label.length > 12 ? `${pt.label.slice(0, 11)}…` : pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Point Breakdown Strip */}
      <div className="pt-3 border-t border-stone-200 dark:border-stone-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div>
          <p className="text-stone-500 dark:text-stone-400">Checkpoint</p>
          <p className="font-mono-tabular font-semibold text-stone-900 dark:text-stone-100 truncate">
            {activePoint.label} ({activePoint.date})
          </p>
        </div>
        {showInvested && (
          <div>
            <p className="text-stone-500 dark:text-stone-400">Invested Capital</p>
            <p className="font-mono-tabular font-semibold text-[#B88B1E] dark:text-[#D4AF37]">
              {activePoint.invested} pts
            </p>
          </div>
        )}
        <div>
          <p className="text-stone-500 dark:text-stone-400">Total Cost</p>
          <p className="font-mono-tabular font-semibold text-rose-700 dark:text-rose-400">
            {activePoint.cost} pts
          </p>
        </div>
        <div>
          <p className="text-stone-500 dark:text-stone-400">Total Income</p>
          <p className="font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
            {activePoint.income} pts
          </p>
        </div>
        <div>
          <p className="text-stone-500 dark:text-stone-400">Net Income − Cost</p>
          <p
            className={`font-mono-tabular font-semibold ${
              activePoint.net >= 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {activePoint.net >= 0 ? `+${activePoint.net}` : activePoint.net} pts
          </p>
        </div>
      </div>
    </div>
  );
};
