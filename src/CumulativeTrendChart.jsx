import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { buildCumulativeTrend, DEFAULT_TREND_MIN_SESSIONS, findTrendPoint } from './utils/cumulativeTrend';
import './cumulativeTrendChart.css';

const COLORS = [
  '#2864BD', '#008476', '#C66718', '#7F4BB5', '#BD3F79',
  '#5F7C21', '#0093B0', '#CE4945', '#3D516E', '#9E7914',
];
const MOBILE_VIEW = '(max-width: 767px), (max-width: 1023px) and (pointer: coarse)';
const timeZone = 'Asia/Shanghai';
const scores = new Intl.NumberFormat('zh-CN');
const shortScores = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const dates = new Intl.DateTimeFormat('zh-CN', { timeZone, month: 'numeric', day: 'numeric' });
const datedYears = new Intl.DateTimeFormat('zh-CN', { timeZone, year: '2-digit', month: 'numeric', day: 'numeric' });
const years = new Intl.DateTimeFormat('zh-CN', { timeZone, year: 'numeric' });
const hours = new Intl.DateTimeFormat('zh-CN', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
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
  const { series, sessions, sessionIndexes } = useMemo(() => buildCumulativeTrend(rows), [rows]);
  const [added, setAdded] = useState(() => new Set());
  const [hidden, setHidden] = useState(() => new Set());
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [width, setWidth] = useState(640);
  const [expanded, setExpanded] = useState(false);
  const sectionRef = useRef(null);
  const sectionHeightRef = useRef(0);
  const dialogRef = useRef(null);
  const plotRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const chartAvailable = sessions.length > 0;
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
      ? [{ ...player, color: COLORS[index % COLORS.length] }]
      : []
  ), [series, added]);
  const ticks = useMemo(() => scoreTicks(enrolled), [enrolled]);
  const min = ticks[0];
  const max = ticks.at(-1);
  const lastIndex = sessions.length - 1;
  const firstSession = sessions[0];
  const lastSession = sessions[lastIndex];
  const formatTick = showLandscape || width < 540 ? formatShortScore : scores.format;
  const axisWidth = Math.max(...ticks.map((tick) => formatTick(tick).length)) * 7 + 6;
  const plotLeft = CHART_MARGIN.left + axisWidth;
  const labelCapacity = Math.max(2, Math.floor((width - plotLeft - CHART_MARGIN.right) / 58) + 1);
  const count = Math.min(sessions.length, labelCapacity);
  const sessionTicks = count > 1
    ? Array.from({ length: count }, (_, i) => Math.round((lastIndex * i) / (count - 1)))
    : [0];
  let timeFormat = dates;
  if (chartAvailable) {
    if (years.format(firstSession.time) !== years.format(lastSession.time)) timeFormat = datedYears;
    else if (dates.format(firstSession.time) === dates.format(lastSession.time) && count > 1) timeFormat = hours;
  }
  const visible = enrolled.filter(({ playerId }) => !hidden.has(playerId));
  const allSelected = visible.length === enrolled.length;
  const togglePlayersLabel = allSelected ? '全不选' : '全选';
  const cursorIndex = sessionIndexes.get(selectedSessionId);
  const cursor = sessions[cursorIndex];
  const activePoints = cursor
    ? new Map(visible.map(({ playerId, points }) => [playerId, findTrendPoint(points, cursorIndex)]))
    : null;
  const ranking = cursor ? visible.flatMap(({ name, playerId, color, points }) => {
    const point = points.findLast(({ sessionIndex }) => sessionIndex <= cursorIndex);
    return point ? [{ name, playerId, color, score: point.score }] : [];
  }).sort((a, b) => b.score - a.score) : [];
  const tooltipWidth = Math.min(208, Math.max(0, width - 8));
  const cursorX = plotLeft + (width - plotLeft - CHART_MARGIN.right)
    * (lastIndex > 0 ? cursorIndex / lastIndex : 0.5);
  const tooltipLeft = cursorX + tooltipWidth + 12 <= width
    ? cursorX + 8
    : Math.max(4, cursorX - tooltipWidth - 8);

  function selectSession(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const rotated = expanded && window.matchMedia('(orientation: portrait)').matches;
    const offset = rotated ? event.clientY - bounds.top : event.clientX - bounds.left;
    const plotWidth = Math.max(1, event.currentTarget.clientWidth - plotLeft - CHART_MARGIN.right);
    const ratio = Math.max(0, Math.min(1, (offset - plotLeft) / plotWidth));
    setSelectedSessionId(sessions[Math.round(ratio * lastIndex)].sessionId);
  }

  function openChart() {
    setSelectedSessionId(null);
    sectionHeightRef.current = sectionRef.current?.offsetHeight ?? 0;
    restoreFocusRef.current = true;
    setExpanded(true);
  }

  function closeChart() {
    setSelectedSessionId(null);
    setExpanded(false);
  }

  function handlePlotClick(event) {
    if (!expanded && window.matchMedia(MOBILE_VIEW).matches) openChart();
    else selectSession(event);
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !expanded) {
      setSelectedSessionId(null);
    } else if ((event.key === 'Enter' || event.key === ' ') && !expanded && window.matchMedia(MOBILE_VIEW).matches) {
      event.preventDefault();
      openChart();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = (cursorIndex ?? lastIndex) + (event.key === 'ArrowLeft' ? -1 : 1);
      setSelectedSessionId(sessions[Math.min(lastIndex, Math.max(0, next))].sessionId);
    }
  }

  const available = series.filter(({ playerId, sessionCount }) => sessionCount < DEFAULT_TREND_MIN_SESSIONS && !added.has(playerId));

  const chartContent = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h3 id="cumulative-trend-title" className="text-base font-semibold text-slate-900">全局累计积分趋势</h3>
        <div className="flex shrink-0 items-center gap-2">
          {/* The dialog focuses the first control. Keep the native player picker out of that position. */}
          {showLandscape && (
            <button
              type="button"
              aria-label="关闭横屏图表"
              className="btn-secondary room-switch-btn order-last h-11 w-11 rounded-full p-0 text-xl"
              onClick={closeChart}
            >×</button>
          )}
          {enrolled.length > 0 && (
            <button
              type="button"
              aria-label={togglePlayersLabel}
              title={togglePlayersLabel}
              className="btn-secondary room-switch-btn inline-flex h-11 w-11 items-center justify-center rounded-full p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
              onClick={() => setHidden(allSelected ? new Set(enrolled.map(({ playerId }) => playerId)) : new Set())}
            >
              <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                {allSelected ? (
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M6.5 6.5A12.1 12.1 0 0 0 2 12s3.6 6 10 6a10.8 10.8 0 0 0 5.5-1.5M10 6.2a10 10 0 0 1 2-.2c6.4 0 10 6 10 6a14 14 0 0 1-2.2 2.7" />
                ) : (
                  <>
                    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="2" />
                  </>
                )}
              </svg>
            </button>
          )}
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
        <div
          className={showLandscape ? 'flex min-h-0 flex-1 flex-col' : undefined}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSelectedSessionId(null);
          }}
          onPointerLeave={(event) => { if (event.pointerType !== 'touch') setSelectedSessionId(null); }}
        >
          <div className={`mt-2 flex flex-col rounded-2xl border border-slate-100 bg-white/70 px-1 pb-1 sm:px-2 ${showLandscape ? 'min-h-0 flex-1' : ''}`}>
            <div
              ref={plotRef}
              role="group"
              className={`relative w-full cursor-crosshair rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${showLandscape ? 'min-h-0 flex-1' : 'h-[208px] touch-pan-y'}`}
              aria-label="累计积分趋势，时间为北京时间。手机端可点按展开横屏。使用左右方向键切换对局"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onPointerMove={(event) => { if (event.pointerType !== 'touch') selectSession(event); }}
              onClick={handlePlotClick}
            >
              {cursor && (
                <span className="pointer-events-none absolute right-3 top-0.5 z-10 text-[11px] font-medium text-slate-600">
                  {formatDateTime(cursor.time)}
                </span>
              )}
              {ranking.length > 0 && (
                <div
                  className="absolute top-6 z-20 max-h-[calc(100%-3.25rem)] cursor-auto overflow-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-md"
                  style={{ left: tooltipLeft, width: tooltipWidth }}
                  onPointerMove={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <ol aria-label="该场次累计积分排名" className="space-y-1">
                    {ranking.map(({ playerId, name, color, score }) => (
                      <li key={playerId} className="flex items-center gap-1.5">
                        <span className="shrink-0 tabular-nums text-slate-500">
                          {ranking.findIndex((player) => player.score === score) + 1}
                        </span>
                        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
                        <span className="shrink-0 tabular-nums">{scores.format(score)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {cursor == null && !showLandscape && (
                <span aria-hidden="true" className="trend-expand-icon pointer-events-none absolute right-3 top-0.5 z-10 text-base leading-none text-slate-500">⤢</span>
              )}
              <ResponsiveContainer width="100%" height="100%" onResize={(nextWidth) => setWidth(nextWidth)}>
                <LineChart margin={CHART_MARGIN} accessibilityLayer={false}>
                  <CartesianGrid stroke="#e2e8f0" syncWithTicks />
                  <XAxis
                    dataKey="sessionIndex"
                    type="number"
                    scale="linear"
                    domain={lastIndex > 0 ? [0, lastIndex] : [-1, 1]}
                    niceTicks="none"
                    ticks={sessionTicks}
                    interval={0}
                    height={24}
                    axisLine={false}
                    tickLine={false}
                    tick={({ x, y, payload, index }) => (
                      <text
                        x={x}
                        y={y + 3}
                        textAnchor={count === 1 ? 'middle' : index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'}
                        {...TICK_STYLE}
                      >
                        {timeFormat.format(sessions[payload.value].time)}
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
                  {visible.map(({ playerId, name, color, points }) => (
                    <Line
                      key={playerId}
                      name={name}
                      data={points}
                      dataKey="score"
                      type="linear"
                      stroke={color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  ))}
                  {cursor && <ReferenceLine x={cursorIndex} stroke="#64748b" strokeDasharray="4 3" />}
                  {visible.map(({ playerId, color, points }) => {
                    const point = activePoints ? activePoints.get(playerId) : points.at(-1);
                    if (!point) return null;
                    return (
                      <ReferenceDot
                        key={playerId}
                        x={point.sessionIndex}
                        y={point.score}
                        r={cursor ? 3.25 : 2.5}
                        fill={color}
                        stroke={cursor ? 'white' : 'none'}
                      />
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
              className={`tab-scroll mt-2 flex shrink-0 flex-wrap content-start gap-1.5 p-0.5 ${showLandscape ? 'trend-landscape-players' : 'trend-inline-players'}`}
            >
              {enrolled.map(({ playerId, name, sessionCount, color, points }) => {
                const shown = !hidden.has(playerId);
                const point = activePoints ? activePoints.get(playerId) : points.at(-1);
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
                      className="w-4 shrink-0 border-t-2 border-solid"
                      style={{ borderColor: shown ? color : '#94a3b8' }}
                    />
                    <span className="truncate">{name}</span>
                    {shown && point && (
                      <span className={`shrink-0 font-semibold tabular-nums ${point?.score > 0 ? 'text-emerald-600' : point?.score < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {scores.format(point.score)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
