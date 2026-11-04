"use client";

/*
 * Small, dependency-free charts for the Analytics page.
 *
 * Built to the dataviz method: thin marks with 4px data-ends, hairline solid
 * grids, a legend whenever there are two or more series, text in ink tokens
 * (never the series colour), a hover/focus layer on every chart, and a data
 * table twin so no value is reachable only through a tooltip.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import styles from "./charts.module.css";

/** Track an element's content width so SVG can be drawn in real pixels. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round the axis top up to a clean step so ticks read 0 / 2 / 4 … */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= value / 4)!;
  return Math.ceil(value / (step * magnitude)) * step * magnitude;
}

function ticks(max: number): number[] {
  return [0, max / 4, max / 2, (max * 3) / 4, max].map((v) =>
    Number.isInteger(v) ? v : Number(v.toFixed(1)),
  );
}

/** "above" sits over a mark; "left"/"right" sit beside a crosshair, inside the plot. */
type Tip = {
  x: number;
  y: number;
  content: ReactNode;
  placement?: "above" | "left" | "right";
} | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className={styles.tooltip}
      data-placement={tip.placement ?? "above"}
      style={{ left: tip.x, top: tip.y }}
      role="presentation"
    >
      {tip.content}
    </div>
  );
}

export type LegendItem = {
  label: string;
  color: string;
  shape?: "rect" | "line";
};

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label}>
          <span
            className={item.shape === "line" ? styles.keyLine : styles.keyRect}
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* ── Column chart ─────────────────────────────────────────────────────────── */

export type Column = {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Category name in the tooltip when the axis label is abbreviated. */
  tooltip?: string;
  /** Accessible name and tooltip text, e.g. "70–80: 3 candidates". */
  description: string;
};

export function ColumnChart({
  columns,
  height = 180,
  label,
}: {
  columns: Column[];
  height?: number;
  label: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const max = niceMax(Math.max(0, ...columns.map((c) => c.value)));

  function show(event: { currentTarget: HTMLElement }, column: Column) {
    const frame = frameRef.current?.getBoundingClientRect();
    const box = event.currentTarget.getBoundingClientRect();
    if (!frame) return;
    setTip({
      x: box.left - frame.left + box.width / 2,
      y: box.top - frame.top,
      content: (
        <>
          <strong>{column.value}</strong>
          <span>{column.tooltip ?? column.label}</span>
        </>
      ),
    });
  }

  return (
    <div className={styles.frame} ref={frameRef}>
      <div
        className={styles.columnPlot}
        style={{ height }}
        role="group"
        aria-label={label}
      >
        <div className={styles.grid} aria-hidden="true">
          {ticks(max)
            .slice()
            .reverse()
            .map((tick) => (
              <div key={tick} className={styles.gridLine}>
                <span>{tick}</span>
              </div>
            ))}
        </div>
        <div className={styles.columns}>
          {columns.map((column, index) => (
            <div
              key={column.key}
              className={styles.columnSlot}
              tabIndex={0}
              aria-label={column.description}
              onPointerEnter={(event) => show(event, column)}
              onPointerLeave={() => setTip(null)}
              onFocus={(event) => show(event, column)}
              onBlur={() => setTip(null)}
            >
              <span
                className={styles.column}
                style={{
                  height: `${(column.value / max) * 100}%`,
                  background: column.color,
                  animationDelay: `${index * 35}ms`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.columnLabels} aria-hidden="true">
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ── Tall segmented bar (one whole, <= 6 parts) ───────────────────────────── */

export type Segment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

/**
 * Part-to-whole at a glance. Each block prints its share when it fits; the
 * legend names the parts in block order; hover and focus give name, count and share.
 */
export function SegmentedBar({
  segments,
  label,
  formatShare,
  describe,
}: {
  segments: Segment[];
  label: string;
  formatShare: (share: number) => string;
  describe: (segment: Segment, share: string) => string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);

  function show(event: { currentTarget: HTMLElement }, segment: Segment) {
    const frame = frameRef.current?.getBoundingClientRect();
    const box = event.currentTarget.getBoundingClientRect();
    if (!frame) return;
    setTip({
      x: box.left - frame.left + box.width / 2,
      y: box.top - frame.top,
      content: (
        <>
          <strong>{segment.value}</strong>
          <span>
            {segment.label} · {formatShare(segment.value / total)}
          </span>
        </>
      ),
    });
  }

  return (
    <div className={styles.frame} ref={frameRef}>
      <Legend
        items={segments.map((s) => ({ label: s.label, color: s.color }))}
      />
      <div className={styles.segmented} role="group" aria-label={label}>
        {visible.map((segment) => {
          const share = segment.value / total;
          return (
            <div
              key={segment.key}
              className={styles.segment}
              style={{ flexGrow: segment.value, background: segment.color }}
              tabIndex={0}
              aria-label={describe(segment, formatShare(share))}
              onPointerEnter={(event) => show(event, segment)}
              onPointerLeave={() => setTip(null)}
              onFocus={(event) => show(event, segment)}
              onBlur={() => setTip(null)}
            >
              {share >= 0.12 && (
                <span aria-hidden="true">{formatShare(share)}</span>
              )}
            </div>
          );
        })}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ── Ranked horizontal bars ───────────────────────────────────────────────── */

export type BarRow = {
  key: string;
  label: string;
  value: number;
  display?: string;
};

/** One series, so one hue and no legend; every bar carries its value at the tip. */
export function BarList({
  rows,
  color = "var(--chart-1)",
  label,
}: {
  rows: BarRow[];
  color?: string;
  label: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className={styles.barList} aria-label={label}>
      {rows.map((row, index) => (
        <li key={row.key} className={styles.barRow}>
          <span className={styles.barLabel} title={row.label}>
            {row.label}
          </span>
          <span className={styles.barTrack} aria-hidden="true">
            <span
              className={styles.bar}
              style={{
                // A zero draws nothing; any non-zero value stays visible.
                width: row.value ? `max(2px, ${(row.value / max) * 100}%)` : 0,
                background: color,
                animationDelay: `${index * 40}ms`,
              }}
            />
          </span>
          <span className={styles.barValue}>{row.display ?? row.value}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Line chart with crosshair ────────────────────────────────────────────── */

export type Series = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

const PAD = { top: 12, right: 12, bottom: 26, left: 32 };

export function LineChart({
  series,
  xLabels,
  height = 220,
  label,
}: {
  series: Series[];
  xLabels: string[];
  height?: number;
  label: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const clipId = useId();
  const count = xLabels.length;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (count <= 1 ? 0 : (i / (count - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  function nearest(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const relative = event.clientX - box.left - PAD.left;
    const index = Math.round((relative / Math.max(plotW, 1)) * (count - 1));
    setActive(Math.max(0, Math.min(count - 1, index)));
  }

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActive((current) => {
      const start = current ?? count - 1;
      const next = start + (event.key === "ArrowRight" ? 1 : -1);
      return Math.max(0, Math.min(count - 1, next));
    });
  }

  // Label every few days so ticks never collide on narrow cards; the last day
  // is always labelled, so a regular tick too close to it is dropped.
  const labelEvery = Math.max(
    1,
    Math.ceil(count / Math.max(2, Math.floor(plotW / 64))),
  );

  return (
    <div className={styles.frame} ref={wrapRef}>
      {width > 0 && (
        <svg
          className={styles.lineSvg}
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          onPointerMove={nearest}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                className={styles.reveal}
                x={PAD.left - 4}
                y={0}
                width={plotW + 8}
                height={height}
              />
            </clipPath>
          </defs>
          {ticks(max).map((tick) => (
            <g key={tick}>
              <line
                className={styles.gridRule}
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                className={styles.axisText}
                x={PAD.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
              >
                {tick}
              </text>
            </g>
          ))}
          {xLabels.map((text, i) =>
            (i % labelEvery === 0 && count - 1 - i >= labelEvery) ||
            i === count - 1 ? (
              <text
                key={text}
                className={styles.axisText}
                x={x(i)}
                y={height - 6}
                textAnchor={
                  i === 0 ? "start" : i === count - 1 ? "end" : "middle"
                }
              >
                {text}
              </text>
            ) : null,
          )}
          <g clipPath={`url(#${clipId})`}>
            {series.map((s) => (
              <polyline
                key={s.key}
                className={styles.line}
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                stroke={s.color}
              />
            ))}
            {series.map((s) => (
              <circle
                key={s.key}
                className={styles.endDot}
                cx={x(count - 1)}
                cy={y(s.values[count - 1] ?? 0)}
                r={4}
                fill={s.color}
              />
            ))}
          </g>
          {active !== null && (
            <g pointerEvents="none">
              <line
                className={styles.crosshair}
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
              />
              {series.map((s) => (
                <circle
                  key={s.key}
                  className={styles.endDot}
                  cx={x(active)}
                  cy={y(s.values[active] ?? 0)}
                  r={4}
                  fill={s.color}
                />
              ))}
            </g>
          )}
        </svg>
      )}
      {active !== null && width > 0 && (
        <Tooltip
          tip={{
            x: x(active),
            y: PAD.top,
            placement: x(active) > width / 2 ? "left" : "right",
            content: (
              <>
                <span className={styles.tipTitle}>{xLabels[active]}</span>
                {series.map((s) => (
                  <span key={s.key} className={styles.tipRow}>
                    <span
                      className={styles.keyLine}
                      style={{ background: s.color }}
                      aria-hidden="true"
                    />
                    <strong>{s.values[active]}</strong>
                    <span>{s.label}</span>
                  </span>
                ))}
              </>
            ),
          }}
        />
      )}
    </div>
  );
}

/* ── Table twin ───────────────────────────────────────────────────────────── */

export function DataTable({
  summary,
  headers,
  rows,
}: {
  summary: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className={styles.dataTable}>
      <summary>{summary}</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
