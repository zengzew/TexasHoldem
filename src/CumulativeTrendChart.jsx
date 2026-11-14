import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { buildCumulativeTrend, DEFAULT_TREND_MIN_SESSIONS, lastTrendIndex } from './utils/cumulativeTrend';

const COLORS = [
  '#7286A8', '#718E83', '#AD7788', '#8C7DA4', '#A08261',
  '#79828D', '#608D9A', '#A7776C', '#858D62', '#717BA1',
];
const timeZone = 'Asia/Shanghai';
const scores = new Intl.NumberFormat('zh-CN');
const days = new Intl.DateTimeFormat('zh-CN', { timeZone, year: '2-digit', month: 'numeric', day: 'numeric' });
const hours = new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const seconds = new Intl.DateTimeFormat('zh-CN', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const CHART_MARGIN = { top: 24, right: 12, bottom: 0, left: 5 };
const TICK_STYLE = { fill: '#475569', fontSize: 11 };

function scoreTicks(series) {
  let min = 0;
  let max = 0;
  for (const { points } of series) {
    for (const { score } of points) {
      min = Math.min(min, score);
      max = Math.max(max, score);
    }
  }
  if (min === max) return [-1, 0, 1];
  const rough = (max - min) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].find((n) => n * power >= rough) * power);
  const first = Math.floor(min / step);
  const last = Math.ceil(max / step);
  return Array.from({ length: last - first + 1 }, (_, i) => (first + i) * step);
}

export default function CumulativeTrendChart({ rows, loaded, loading, error, onRetry, formatDateTime }) {
  const { series, times } = useMemo(() => buildCumulativeTrend(rows), [rows]);
  const [added, setAdded] = useState(() => new Set());
  const [hidden, setHidden] = useState(() => new Set());
  const [selectedTime, setSelectedTime] = useState(null);
  const [width, setWidth] = useState(640);
  const chartAvailable = times.length > 0;

  const enrolled = useMemo(() => series.flatMap((player, index) =>
    player.sessionCount >= DEFAULT_TREND_MIN_SESSIONS || added.has(player.playerId)
      ? [{ ...player, color: COLORS[index % COLORS.length], dash: [undefined, '6 4', '2 4'][Math.floor(index / COLORS.length) % 3] }]
      : []
  ), [series, added]);
  const ticks = useMemo(() => scoreTicks(enrolled), [enrolled]);
  const min = ticks[0];
  const max = ticks.at(-1);
  const start = times[0];
  const end = times.at(-1);
  const duration = end - start;
  const axisWidth = Math.max(scores.format(min).length, scores.format(max).length) * 7 + 7;
  const plotLeft = CHART_MARGIN.left + axisWidth;
  const count = width >= 540 ? 5 : width - plotLeft >= 225 ? 3 : 2;
  const timeTicks = duration
    ? Array.from({ length: count }, (_, i) => start + (duration * i) / (count - 1))
    : [start];
  const timeFormat = duration < 60_000 ? seconds : duration < 172_800_000 ? hours : days;
  const visible = enrolled.filter(({ playerId }) => !hidden.has(playerId));
  const cursorIndex = selectedTime == null ? -1 : lastTrendIndex(times, selectedTime, (time) => time);
  const cursor = times[cursorIndex];
  const readoutTime = cursor ?? end;

  function selectTime(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const plotWidth = Math.max(1, bounds.width - plotLeft - CHART_MARGIN.right);
    const ratio = Math.max(0, Math.min(1, (x - plotLeft) / plotWidth));
    const time = start + ratio * duration;
    const index = lastTrendIndex(times, time, (value) => value);
    const next = times[index + 1];
    const previous = times[index];
    setSelectedTime(next != null && next - time < time - previous ? next : previous);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      setSelectedTime(null);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const current = cursorIndex < 0 ? times.length - 1 : cursorIndex;
      const next = current + (event.key === 'ArrowLeft' ? -1 : 1);
      setSelectedTime(times[Math.min(times.length - 1, Math.max(0, next))]);
    }
  }

  const available = series.filter(({ playerId, sessionCount }) => sessionCount < DEFAULT_TREND_MIN_SESSIONS && !added.has(playerId));

  return (
    <section aria-labelledby="cumulative-trend-title" className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm backdrop-blur-md sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id="cumulative-trend-title" className="text-base font-semibold text-slate-900">全局累计积分趋势</h3>
        {available.length > 0 && (
          <select
            aria-label="添加玩家"
            title="添加玩家"
            value=""
            className="btn-secondary room-switch-btn h-11 w-11 cursor-pointer appearance-none rounded-full p-0 text-center text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
            onChange={(event) => {
              const id = event.target.value;
              if (id) setAdded((previous) => new Set(previous).add(id));
            }}
          >
            <option value="" disabled>+</option>
            {available.map(({ playerId, name, sessionCount }) => <option key={playerId} value={playerId}>{name}（{sessionCount} 局）</option>)}
          </select>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <p role="status">加载失败</p>
          <button type="button" aria-label="重试" title="重试" className="info-trigger text-base font-semibold" onClick={onRetry}>↻</button>
        </div>
      )}
      {!chartAvailable && !error && (
        <p role="status" className="mt-4 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
          {loaded && !loading ? '暂无已结算对局' : <><span aria-hidden="true">…</span><span className="sr-only">加载中</span></>}
        </p>
      )}
      {chartAvailable && (
        <>
          <div className="mt-2 rounded-2xl border border-slate-100 bg-white/70 px-1 pb-1 sm:px-2">
            <div
                role="group"
                className="relative h-[208px] w-full cursor-crosshair touch-pan-y rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                aria-label="累计积分趋势，时间为北京时间。使用左右方向键查看不同时间的积分"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onBlur={() => setSelectedTime(null)}
                onPointerMove={(event) => { if (event.pointerType !== 'touch') selectTime(event); }}
                onPointerLeave={(event) => { if (event.pointerType !== 'touch') setSelectedTime(null); }}
                onClick={selectTime}
              >
                {cursor != null && (
                  <span className="pointer-events-none absolute right-3 top-0.5 text-[11px] font-medium text-slate-600">
                    {formatDateTime(cursor)}
                  </span>
                )}
                <ResponsiveContainer width="100%" height="100%" onResize={(nextWidth) => setWidth(nextWidth)}>
                  <LineChart margin={CHART_MARGIN} accessibilityLayer={false}>
                    <CartesianGrid stroke="#e2e8f0" syncWithTicks />
                    <XAxis
                      dataKey="time"
                      type="number"
                      scale="linear"
                      domain={duration ? [start, end] : [start - 1, end + 1]}
                      niceTicks="none"
                      ticks={timeTicks}
                      interval={0}
                      height={24}
                      axisLine={false}
                      tickLine={false}
                      tick={({ x, y, payload, index }) => (
                        <text
                          x={x}
                          y={y + 3}
                          textAnchor={!duration ? 'middle' : index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
                          {...TICK_STYLE}
                        >
                          {duration ? timeFormat.format(payload.value) : formatDateTime(payload.value)}
                        </text>
                      )}
                    />
                    <YAxis
                      type="number"
                      domain={[min, max]}
                      niceTicks="none"
                      ticks={ticks}
                      interval={0}
                      width={axisWidth}
                      axisLine={false}
                      tickLine={false}
                      tick={TICK_STYLE}
                      tickFormatter={scores.format}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    {visible.map(({ playerId, name, color, dash, points }) => (
                      <Line
                        key={playerId}
                        name={name}
                        data={points}
                        dataKey="score"
                        type="linear"
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray={dash}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                    {cursor != null && <ReferenceLine x={cursor} stroke="#64748b" strokeDasharray="4 3" />}
                    {visible.map(({ playerId, color, points }) => {
                      const lastPoint = points.at(-1);
                      return (
                        <ReferenceDot
                          key={playerId}
                          x={lastPoint.time}
                          y={lastPoint.score}
                          r={2.5}
                          fill={color}
                          stroke="none"
                        />
                      );
                    })}
                    {cursor != null && visible.map(({ playerId, color, points }) => {
                      const point = points[lastTrendIndex(points, cursor, (item) => item.time)];
                      return point?.time === cursor && (
                        <ReferenceDot key={playerId} x={point.time} y={point.score} r={3.25} fill={color} stroke="white" />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
                {!visible.length && (
                  <p className="pointer-events-none absolute inset-x-2 top-1/3 mx-auto w-fit max-w-full rounded-xl bg-white/95 px-3 py-2 text-center text-sm text-slate-600 shadow-sm">
                    暂无曲线
                  </p>
                )}
              </div>
          </div>
          {enrolled.length > 0 && (
            <div role="group" aria-label="玩家图例" className="tab-scroll mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto p-0.5">
              {enrolled.map(({ playerId, name, sessionCount, color, dash, points }) => {
                const shown = !hidden.has(playerId);
                const point = points[lastTrendIndex(points, readoutTime, (item) => item.time)];
                return (
                  <button
                    key={playerId}
                    type="button"
                    aria-label={name}
                    aria-pressed={shown}
                    title={`${name} · ${sessionCount} 局`}
                    className={`inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${shown ? 'border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:border-sky-300' : 'border-slate-100 bg-slate-50/80 text-slate-500 hover:bg-white'}`}
                    onClick={() => setHidden((previous) => {
                      const next = new Set(previous);
                      if (next.has(playerId)) next.delete(playerId);
                      else next.add(playerId);
                      return next;
                    })}
                  >
                    <span className={`w-3 shrink-0 border-t-2 ${dash ? 'border-dashed' : 'border-solid'}`} style={{ borderColor: shown ? color : '#94a3b8' }} />
                    <span className="truncate">{name}</span>
                    {shown && (
                      <span className={`shrink-0 font-semibold tabular-nums ${point?.score > 0 ? 'text-emerald-600' : point?.score < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {point ? scores.format(point.score) : '—'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
