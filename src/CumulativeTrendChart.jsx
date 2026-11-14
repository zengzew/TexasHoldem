import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { buildCumulativeTrend, DEFAULT_TREND_MIN_SESSIONS, lastTrendIndex } from './utils/cumulativeTrend';
import './cumulativeTrendChart.css';

const COLORS = [
  '#3B72AF', '#238676', '#BC692C', '#8056AE', '#B25279',
  '#657C34', '#2D859C', '#A9544D', '#57667D', '#92742D',
];
const DASHES = [undefined, '7 3', '2 3', '8 3 2 3'];
const MOBILE_VIEW = '(max-width: 767px), (max-width: 1023px) and (pointer: coarse)';
const timeZone = 'Asia/Shanghai';
const scores = new Intl.NumberFormat('zh-CN');
const shortScores = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const days = new Intl.DateTimeFormat('zh-CN', { timeZone, year: '2-digit', month: 'numeric', day: 'numeric' });
const hours = new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const seconds = new Intl.DateTimeFormat('zh-CN', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const CHART_MARGIN = { top: 24, right: 12, bottom: 0, left: 5 };
const TICK_STYLE = { fill: '#475569', fontSize: 11 };

function formatShortScore(score) {
  return shortScores.format(score).replace('-', '−').replace('K', 'k');
}

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
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef(null);
  const sectionHeightRef = useRef(0);
  const dialogRef = useRef(null);
  const plotRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const chartAvailable = times.length > 0;
  const showLandscape = expanded && chartAvailable;

  useLayoutEffect(() => {
    if (!showLandscape) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        plotRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [showLandscape]);

  const enrolled = useMemo(() => series.flatMap((player, index) =>
    player.sessionCount >= DEFAULT_TREND_MIN_SESSIONS || added.has(player.playerId)
      ? [{ ...player, color: COLORS[index % COLORS.length], dash: DASHES[(index + Math.floor(index / COLORS.length)) % DASHES.length] }]
      : []
  ), [series, added]);
  const ticks = useMemo(() => scoreTicks(enrolled), [enrolled]);
  const min = ticks[0];
  const max = ticks.at(-1);
  const start = times[0];
  const end = times.at(-1);
  const duration = end - start;
  const formatTick = showLandscape || width < 540 ? formatShortScore : scores.format;
  const axisWidth = Math.max(...ticks.map((tick) => formatTick(tick).length)) * 7 + 6;
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
    const rotated = expanded && window.matchMedia('(orientation: portrait)').matches;
    const offset = rotated ? event.clientY - bounds.top : event.clientX - bounds.left;
    const plotWidth = Math.max(1, event.currentTarget.clientWidth - plotLeft - CHART_MARGIN.right);
    const ratio = Math.max(0, Math.min(1, (offset - plotLeft) / plotWidth));
    const time = start + ratio * duration;
    const index = lastTrendIndex(times, time, (value) => value);
    const next = times[index + 1];
    const previous = times[index];
    setSelectedTime(next != null && next - time < time - previous ? next : previous);
  }

  function openChart() {
    setSelectedTime(null);
    sectionHeightRef.current = sectionRef.current?.offsetHeight ?? 0;
    restoreFocusRef.current = true;
    setExpanded(true);
  }

  function closeChart() {
    setSelectedTime(null);
    setExpanded(false);
  }

  function handlePlotClick(event) {
    if (!expanded && window.matchMedia(MOBILE_VIEW).matches) openChart();
    else selectTime(event);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !expanded) {
      setSelectedTime(null);
    } else if ((event.key === 'Enter' || event.key === ' ') && !expanded && window.matchMedia(MOBILE_VIEW).matches) {
      event.preventDefault();
      openChart();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const current = cursorIndex < 0 ? times.length - 1 : cursorIndex;
      const next = current + (event.key === 'ArrowLeft' ? -1 : 1);
      setSelectedTime(times[Math.min(times.length - 1, Math.max(0, next))]);
    }
  }

  const available = series.filter(({ playerId, sessionCount }) => sessionCount < DEFAULT_TREND_MIN_SESSIONS && !added.has(playerId));

  const chartContent = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h3 id="cumulative-trend-title" className="text-base font-semibold text-slate-900">全局累计积分趋势</h3>
        <div className="flex shrink-0 items-center gap-2">
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
          {showLandscape && (
            <button
              type="button"
              aria-label="关闭横屏图表"
              className="btn-secondary room-switch-btn h-11 w-11 rounded-full p-0 text-xl"
              onClick={closeChart}
            >×</button>
          )}
        </div>
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
          <div className={`mt-2 flex flex-col rounded-2xl border border-slate-100 bg-white/70 px-1 pb-1 sm:px-2 ${showLandscape ? 'min-h-0 flex-1' : ''}`}>
            <div
              ref={plotRef}
              role="group"
              className={`relative w-full cursor-crosshair rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${showLandscape ? 'min-h-0 flex-1 touch-none' : 'h-[208px] touch-pan-y'}`}
              aria-label="累计积分趋势，时间为北京时间。手机端可点按展开横屏。使用左右方向键查看不同时间的积分"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onBlur={() => setSelectedTime(null)}
              onPointerMove={(event) => { if (event.pointerType !== 'touch') selectTime(event); }}
              onPointerLeave={(event) => { if (event.pointerType !== 'touch') setSelectedTime(null); }}
              onClick={handlePlotClick}
            >
              {cursor != null && (
                <span className="pointer-events-none absolute right-3 top-0.5 z-10 text-[11px] font-medium text-slate-600">
                  {formatDateTime(cursor)}
                </span>
              )}
              {cursor == null && !showLandscape && (
                <span aria-hidden="true" className="trend-expand-icon pointer-events-none absolute right-3 top-0.5 z-10 text-base leading-none text-slate-500">⤢</span>
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
                    tickFormatter={formatTick}
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
            <div
              role="group"
              aria-label="玩家图例"
              className={`tab-scroll mt-2 flex shrink-0 gap-1.5 p-0.5 ${showLandscape ? 'overflow-x-auto' : 'max-h-36 flex-wrap overflow-y-auto'}`}
            >
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
                    className={`inline-flex min-h-9 max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${shown ? 'border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:border-sky-300' : 'border-slate-100 bg-slate-50/80 text-slate-500 hover:bg-white'}`}
                    onClick={() => setHidden((previous) => {
                      const next = new Set(previous);
                      if (next.has(playerId)) next.delete(playerId);
                      else next.add(playerId);
                      return next;
                    })}
                  >
                    <span
                      className="w-4 shrink-0 border-t-2"
                      style={{ borderColor: shown ? color : '#94a3b8', borderTopStyle: dash === '2 3' ? 'dotted' : dash ? 'dashed' : 'solid' }}
                    />
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
    </>
  );

  return (
    <section
      ref={sectionRef}
      aria-labelledby="cumulative-trend-title"
      className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm backdrop-blur-md sm:p-4"
      style={showLandscape ? { minHeight: sectionHeightRef.current } : undefined}
    >
      {showLandscape ? (
        <dialog
          ref={dialogRef}
          aria-labelledby="cumulative-trend-title"
          className="trend-landscape-dialog"
          onCancel={(event) => {
            event.preventDefault();
            closeChart();
          }}
        >
          <div className="trend-landscape-content">{chartContent}</div>
        </dialog>
      ) : chartContent}
    </section>
  );
}
