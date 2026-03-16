import { useEffect, useMemo, useRef, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabase';
import { APP_NAME } from './constants';
import { todayRoomId, validateAndBuildSettlement } from './utils/game';
import { aggregateLeaderboardRows, buildDateRange, filterRowsByDateRange, sortLeaderboardRows } from './utils/analytics';
import { buildBuyInEventPayload, normalizeBuyInEvents } from './utils/buyInHistory';
import { getLeaderboardMetric } from './utils/leaderboardMetric';
import {
  deriveInitialLoadPlan,
  deriveInvalidationPlan,
  shouldLoadRoomPlayerDetails,
  shouldRefreshHistoryViews,
  shouldRefreshLeaderboardViews,
  shouldRefreshSettledViews,
  shouldLoadPlayerDirectory,
  shouldLoadTabData,
} from './utils/firstLoadPolicy';
import { clearPersistedJoinedRoom, loadPersistedJoinedRoom, savePersistedJoinedRoom } from './utils/roomState';
import { buildLeftMatchSuggestions, findBestProfileForAdd } from './utils/playerSearch';
import { getBuyInPopoverClassName } from './utils/buyInPopover';
import ownerCrownIcon from './assets/owner-crown.svg';
import chevronDownIcon from './assets/chevron-down.svg';
import medalGoldIcon from './assets/medal-gold.svg';
import medalSilverIcon from './assets/medal-silver.svg';
import medalBronzeIcon from './assets/medal-bronze.svg';

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M3 3l18 18" />
      <path d="M10.8 6.2A11.6 11.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-4.1 4.6" />
      <path d="M8.7 8.7A5 5 0 0 0 12 17a5 5 0 0 0 2.6-.7" />
      <path d="M2 12s1.3-2.2 3.7-4.1" />
    </svg>
  );
}

function ChevronToggle({ expanded }) {
  return (
    <span className="expand-indicator" aria-hidden>
      <img
        src={chevronDownIcon}
        alt=""
        className={`expand-glyph ${expanded ? 'rotate-180' : ''}`}
      />
    </span>
  );
}

function OwnerCrown({ className = '' }) {
  return <img src={ownerCrownIcon} alt="" aria-hidden className={className} />;
}

function LoadingSpinner({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function AnimatedNumber({ value = 0, format = (n) => String(Math.round(n)), className = '', duration = 320 }) {
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [displayValue, setDisplayValue] = useState(target);
  const previousRef = useRef(target);

  useEffect(() => {
    const start = previousRef.current;
    const end = target;
    if (Math.abs(end - start) < 0.0001) {
      setDisplayValue(end);
      previousRef.current = end;
      return undefined;
    }
    if (typeof window === 'undefined') {
      setDisplayValue(end);
      previousRef.current = end;
      return undefined;
    }

    let rafId = 0;
    const startedAt = performance.now();
    const easeOutCubic = (t) => 1 - (1 - t) ** 3;

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeOutCubic(progress);
      const next = start + (end - start) * eased;
      setDisplayValue(next);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      previousRef.current = end;
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [target, duration]);

  return <span className={className}>{format(displayValue)}</span>;
}

function AccountAvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

function InfoCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-3.5 w-3.5">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10.5v5" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RefreshIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v6h-6" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M7 3.5v4M17 3.5v4M3.5 9.5h17" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" />
    </svg>
  );
}

function WinRateRing({ value = 0 }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safe / 100);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/72 px-2.5 py-1.5">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <circle cx="20" cy="20" r={radius} stroke="rgba(148,163,184,0.25)" strokeWidth="3.5" fill="none" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          stroke="url(#win-rate-gradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="win-rate-ring-progress"
          transform="rotate(-90 20 20)"
        />
        <defs>
          <linearGradient id="win-rate-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="60%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="leading-none">
        <p className="text-[10px] text-slate-500">胜率</p>
        <p className="num mt-1 text-xs font-semibold text-slate-800">
          {safe > 0 ? '+' : ''}
          {safe.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

const BEIJING_TIME_ZONE = 'Asia/Shanghai';

function toBeijingDateInput(dateLike = new Date()) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

function getBeijingYear(dateLike = new Date()) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return new Date().getUTCFullYear();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0);
  return year || new Date().getUTCFullYear();
}

export default function App() {
  const defaultEndDate = toBeijingDateInput(new Date());
  const defaultStartDate = `${String(getBeijingYear(new Date()))}-01-01`;
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('error');

  const [authMode, setAuthMode] = useState('login');
  const [authNickname, setAuthNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsTab, setSettingsTab] = useState('nickname');
  const [settingsError, setSettingsError] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [welcomePulse, setWelcomePulse] = useState(false);

  const [roomId, setRoomId] = useState(todayRoomId());
  const [joinedRoomId, setJoinedRoomId] = useState('');
  const [roomStatus, setRoomStatus] = useState('active');
  const [roomOwnerId, setRoomOwnerId] = useState('');
  const [ownerFeatureEnabled, setOwnerFeatureEnabled] = useState(true);
  const [rmbRateFeatureEnabled, setRmbRateFeatureEnabled] = useState(true);
  const [rmbPer2000, setRmbPer2000] = useState(100);
  const [rmbPer2000Draft, setRmbPer2000Draft] = useState('100');
  const [players, setPlayers] = useState([]);
  const [mockPlayers, setMockPlayers] = useState([]);
  const [openRooms, setOpenRooms] = useState([]);
  const [localMockMode, setLocalMockMode] = useState(false);
  const [showMineOnly, setShowMineOnly] = useState(true);
  const [activeTab, setActiveTab] = useState('room');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [buyInDrafts, setBuyInDrafts] = useState({});
  const [finalChipsDrafts, setFinalChipsDrafts] = useState({});
  const [transfers, setTransfers] = useState([]);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [leaderboardView, setLeaderboardView] = useState('profit');
  const [expandedLeaderboardId, setExpandedLeaderboardId] = useState('');
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [datePreset, setDatePreset] = useState('all');
  const [customStartDate, setCustomStartDate] = useState(defaultStartDate);
  const [customEndDate, setCustomEndDate] = useState(defaultEndDate);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [dissolveConfirmOpen, setDissolveConfirmOpen] = useState(false);
  const [isDissolving, setIsDissolving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [leaderboardCollapsedCount, setLeaderboardCollapsedCount] = useState(5);
  const [isRefreshingOpenRooms, setIsRefreshingOpenRooms] = useState(false);
  const [refreshSpinTick, setRefreshSpinTick] = useState(0);
  const [addPlayerNickname, setAddPlayerNickname] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [kickingPlayerId, setKickingPlayerId] = useState('');
  const [confirmingPlayerIds, setConfirmingPlayerIds] = useState({});
  const [profileDirectory, setProfileDirectory] = useState([]);
  const [profileDirectoryLoaded, setProfileDirectoryLoaded] = useState(false);
  const [profileDirectoryLoading, setProfileDirectoryLoading] = useState(false);
  const [roomPlayerDetailsLoaded, setRoomPlayerDetailsLoaded] = useState(false);
  const [roomPlayerDetailsLoading, setRoomPlayerDetailsLoading] = useState(false);
  const [addPlayerFocus, setAddPlayerFocus] = useState(false);
  const [addPlayerRemoteSuggestions, setAddPlayerRemoteSuggestions] = useState([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [buyInHistoryByKey, setBuyInHistoryByKey] = useState({});
  const [buyInHistoryLoadingKey, setBuyInHistoryLoadingKey] = useState('');
  const [openBuyInHistoryKey, setOpenBuyInHistoryKey] = useState('');
  const startDateNativeRef = useRef(null);
  const endDateNativeRef = useRef(null);

  const roomChannelRef = useRef(null);
  const leaderboardLoadPromiseRef = useRef(null);
  const historyLoadPromiseRef = useRef(null);
  const profileDirectoryLoadPromiseRef = useRef(null);
  const activeTabRef = useRef(activeTab);
  const leaderboardLoadedRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const roomStatusRef = useRef(roomStatus);
  const leaderboardFreshnessRef = useRef({ settledCount: 0 });
  const historyFreshnessRef = useRef({ totalCount: 0, settledCount: 0 });
  const settleInFlightRef = useRef(false);
  const confirmInFlightPlayerIdsRef = useRef(new Set());
  const actionLockRef = useRef(false);
  const ownerSchemaNoticeShownRef = useRef(false);
  const rmbSchemaNoticeShownRef = useRef(false);
  const prevTabRef = useRef('room');
  const buyInHistoryPopoverRef = useRef(null);
  const buyInHistoryTriggerRef = useRef(null);
  const profileNameCacheRef = useRef(new Map());
  const BUY_IN_STEP = 2000;
  const HISTORY_PAGE_SIZE = 5;
  const LEADERBOARD_COLLAPSED_COUNT = leaderboardCollapsedCount;
  const DEFAULT_RMB_PER_2000 = 100;
  const TAB_ORDER = { room: 0, leaderboard: 1, history: 2 };
  const DATE_PRESETS = [
    { key: '3m', label: '近3月' },
    { key: '6m', label: '近半年' },
    { key: '1y', label: '近一年' },
    { key: 'all', label: '全部' },
  ];
  const tabSlideClass =
    TAB_ORDER[activeTab] >= TAB_ORDER[prevTabRef.current] ? 'tab-content-slide-left' : 'tab-content-slide-right';

  function showNotice(message, type = 'error') {
    setNoticeType(type);
    setNotice(message);
  }

  function beginAction() {
    if (actionLockRef.current) return false;
    actionLockRef.current = true;
    setActionLoading(true);
    return true;
  }

  function endAction() {
    actionLockRef.current = false;
    setActionLoading(false);
  }

  function renderNotice() {
    if (!notice) return null;
    return (
      <div className="pointer-events-none fixed left-1/2 top-3 z-[80] w-[92vw] max-w-md -translate-x-1/2 sm:top-4">
        <div
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg ${
            noticeType === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-white'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className={`text-sm ${noticeType === 'success' ? 'text-emerald-700' : 'text-amber-700'}`}>
              {notice}
            </p>
            <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setNotice('')}>
              x
            </button>
          </div>
        </div>
      </div>
    );
  }

  function createAppError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
  }

  function isNicknameUniqueViolation(error) {
    const text = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return error?.code === '23505' || text.includes('idx_profiles_nickname_ci_unique');
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BEIJING_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    const hour = parts.find((part) => part.type === 'hour')?.value;
    const minute = parts.find((part) => part.type === 'minute')?.value;
    if (!year || !month || !day || !hour || !minute) return '-';
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }

  function renderDatePopover() {
    const rangeText = `${customStartDate || defaultStartDate} ~ ${customEndDate || defaultEndDate}`;
    return (
      <div className="relative">
        <button
          type="button"
          className="btn-secondary inline-flex min-h-[44px] w-full items-center justify-center whitespace-nowrap px-3 py-2 text-sm sm:w-auto"
          onClick={() => setDatePopoverOpen((prev) => !prev)}
        >
          {rangeText}
        </button>
        {datePopoverOpen && (
          <>
            <button
              className="fixed inset-0 z-40 bg-slate-900/24"
              onClick={() => setDatePopoverOpen(false)}
              aria-label="关闭日期筛选"
            />
            <div className="date-popover absolute left-1/2 top-[calc(100%+0.5rem)] z-50 w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-white/80 bg-white/96 p-3 shadow-xl backdrop-blur-md">
              <div className="account-popover-arrow" aria-hidden />
              <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-[96px_1fr]">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        datePreset === preset.key ? 'btn-primary' : 'btn-secondary'
                      }`}
                      onClick={() => {
                        const nextPreset = preset.key;
                        setDatePreset(nextPreset);
                        if (nextPreset !== 'all') {
                          const range = buildDateRange({ preset: nextPreset, now: new Date() });
                          const nextStart = range.from ? toBeijingDateInput(range.from) : defaultStartDate;
                          const nextEnd = range.to ? toBeijingDateInput(range.to) : defaultEndDate;
                          setCustomStartDate(nextStart);
                          setCustomEndDate(nextEnd);
                        }
                        setDatePopoverOpen(false);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="field-label text-black">开始</span>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        className="account-input pr-10 cursor-pointer"
                        value={customStartDate}
                        onClick={() => {
                          startDateNativeRef.current?.showPicker?.();
                          startDateNativeRef.current?.click();
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-slate-600"
                        onClick={() => {
                          startDateNativeRef.current?.showPicker?.();
                          startDateNativeRef.current?.click();
                        }}
                        aria-label="选择开始日期"
                      >
                        <CalendarIcon />
                      </button>
                      <input
                        ref={startDateNativeRef}
                        type="date"
                        lang="en-CA"
                        className="pointer-events-none absolute h-0 w-0 opacity-0"
                        value={customStartDate}
                        onChange={(e) => {
                          setCustomStartDate(e.target.value);
                          setDatePreset('all');
                          setDatePopoverOpen(false);
                        }}
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="field-label text-black">结束</span>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        className="account-input pr-10 cursor-pointer"
                        value={customEndDate}
                        onClick={() => {
                          endDateNativeRef.current?.showPicker?.();
                          endDateNativeRef.current?.click();
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-slate-600"
                        onClick={() => {
                          endDateNativeRef.current?.showPicker?.();
                          endDateNativeRef.current?.click();
                        }}
                        aria-label="选择结束日期"
                      >
                        <CalendarIcon />
                      </button>
                      <input
                        ref={endDateNativeRef}
                        type="date"
                        lang="en-CA"
                        className="pointer-events-none absolute h-0 w-0 opacity-0"
                        value={customEndDate}
                        onChange={(e) => {
                          setCustomEndDate(e.target.value);
                          setDatePreset('all');
                          setDatePopoverOpen(false);
                        }}
                      />
                    </div>
                  </label>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  className="btn-secondary px-3 py-2 text-xs"
                  onClick={() => {
                    setDatePreset('all');
                    setCustomStartDate(defaultStartDate);
                    setCustomEndDate(defaultEndDate);
                  }}
                >
                  重置
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const activePlayers = localMockMode ? mockPlayers : players;
  const nameById = useMemo(() => new Map(activePlayers.map((p) => [p.player_id, p.nickname])), [activePlayers]);
  const sortedPlayers = useMemo(
    () =>
      [...activePlayers].sort((a, b) => {
        const rankFor = (playerId) => {
          if (playerId === user?.id) return 0;
          if (playerId === roomOwnerId) return 1;
          return 2;
        };
        const aRank = rankFor(a.player_id);
        const bRank = rankFor(b.player_id);
        if (aRank !== bRank) return aRank - bRank;
        return String(a.nickname || '').localeCompare(String(b.nickname || ''));
      }),
    [activePlayers, user?.id, roomOwnerId]
  );
  const selectedDateRange = useMemo(
    () => buildDateRange({ preset: datePreset, customStart: customStartDate, customEnd: customEndDate }),
    [datePreset, customStartDate, customEndDate]
  );
  const filteredLeaderboardRows = useMemo(
    () => filterRowsByDateRange(leaderboardRows, selectedDateRange),
    [leaderboardRows, selectedDateRange]
  );
  const effectiveLeaderboardRows = useMemo(() => {
    const isDefaultWindow =
      datePreset === 'all' &&
      customStartDate === defaultStartDate &&
      customEndDate === defaultEndDate;
    if (isDefaultWindow && filteredLeaderboardRows.length === 0 && leaderboardRows.length > 0) {
      return leaderboardRows;
    }
    return filteredLeaderboardRows;
  }, [
    datePreset,
    customStartDate,
    customEndDate,
    defaultStartDate,
    defaultEndDate,
    filteredLeaderboardRows,
    leaderboardRows,
  ]);
  const filteredLeaderboardSessionCount = useMemo(
    () => new Set(effectiveLeaderboardRows.map((row) => row.sessionId)).size,
    [effectiveLeaderboardRows]
  );
  const rankedLeaderboard = useMemo(() => {
    const aggregated = aggregateLeaderboardRows(effectiveLeaderboardRows);
    return sortLeaderboardRows(aggregated, leaderboardView);
  }, [effectiveLeaderboardRows, leaderboardView]);
  const visibleLeaderboard = useMemo(
    () => (showAllLeaderboard ? rankedLeaderboard : rankedLeaderboard.slice(0, LEADERBOARD_COLLAPSED_COUNT)),
    [rankedLeaderboard, showAllLeaderboard, LEADERBOARD_COLLAPSED_COUNT]
  );
  const leaderboardRenderKey = useMemo(
    () =>
      [
        leaderboardView,
        showAllLeaderboard ? 'all' : 'top',
        visibleLeaderboard.map((item) => `${item.playerId}:${item.displayRank}`).join('|'),
      ].join('::'),
    [leaderboardView, showAllLeaderboard, visibleLeaderboard]
  );
  const filteredHistorySessions = useMemo(
    () => historySessions,
    [historySessions]
  );
  const historyPageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredHistorySessions.length / HISTORY_PAGE_SIZE)),
    [filteredHistorySessions.length]
  );
  const pagedHistorySessions = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return filteredHistorySessions.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredHistorySessions, historyPage]);
  const localAddPlayerSuggestions = useMemo(() => {
    const existingPlayerIds = new Set(activePlayers.map((player) => player.player_id));
    return buildLeftMatchSuggestions(profileDirectory, addPlayerNickname, existingPlayerIds, 8);
  }, [addPlayerNickname, profileDirectory, activePlayers]);
  const addPlayerSuggestions = useMemo(() => {
    if (addPlayerRemoteSuggestions.length) return addPlayerRemoteSuggestions;
    return localAddPlayerSuggestions;
  }, [addPlayerRemoteSuggestions, localAddPlayerSuggestions]);
  const totalBuyIn = activePlayers.reduce((acc, p) => acc + Number(p.buy_in || 0), 0);
  const totalFinal = activePlayers.reduce((acc, p) => acc + Number(p.final_chips || 0), 0);
  const hasJoinedRoom = Boolean(joinedRoomId);
  const amRoomOwner = hasJoinedRoom && (!ownerFeatureEnabled || roomOwnerId === user.id);
  const roomOwnerName = roomOwnerId ? nameById.get(roomOwnerId) || 'Unknown' : '-';
  const visiblePlayers = showMineOnly ? sortedPlayers.filter((p) => p.player_id === user.id) : sortedPlayers;
  activeTabRef.current = activeTab;
  leaderboardLoadedRef.current = leaderboardLoaded;
  historyLoadedRef.current = historyLoaded;
  roomStatusRef.current = roomStatus;

  function nicknameToEmail(rawNickname) {
    const normalized = normalizeNickname(rawNickname).toLowerCase();
    if (!normalized) return '';
    const bytes = new TextEncoder().encode(normalized);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `u_${hex}@holdem.local`;
  }

  function normalizeNickname(rawNickname) {
    return String(rawNickname || '').normalize('NFKC').trim().replace(/\s+/g, '');
  }

  function persistJoinedRoomForCurrentUser(nextRoomId) {
    if (!user?.id) return;
    savePersistedJoinedRoom(user.id, nextRoomId, null);
  }

  function cacheProfileNames(rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    const next = new Map(profileNameCacheRef.current);
    rows.forEach((row) => {
      if (row?.id && row?.nickname) {
        next.set(row.id, row.nickname);
      }
    });
    profileNameCacheRef.current = next;
  }

  function normalizePasswordLegacy(rawPassword) {
    const base = String(rawPassword || '');
    if (!base) return '';
    if (base.length >= 6) return base;
    return `${base}__holdem__`.slice(0, 6);
  }

  function isMissingOwnerColumnError(error) {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes('owner_id') && (text.includes('does not exist') || text.includes('schema cache'));
  }

  function isMissingRmbRateColumnError(error) {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes('rmb_per_2000') && (text.includes('does not exist') || text.includes('schema cache'));
  }

  function isMissingFunctionError(error, fnName) {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes('could not find') && text.includes(String(fnName || '').toLowerCase());
  }

  function handleOwnerSchemaMissing() {
    setOwnerFeatureEnabled(false);
    setRoomOwnerId('');
    if (!ownerSchemaNoticeShownRef.current) {
      showNotice('数据库未升级房主字段，已降级兼容。请在 Supabase 执行最新 supabase_schema.sql', 'error');
      ownerSchemaNoticeShownRef.current = true;
    }
  }

  function handleRmbSchemaMissing() {
    setRmbRateFeatureEnabled(false);
    setRmbPer2000(DEFAULT_RMB_PER_2000);
    setRmbPer2000Draft(String(DEFAULT_RMB_PER_2000));
    if (!rmbSchemaNoticeShownRef.current) {
      showNotice('数据库未升级 RMB 换算字段，已使用默认换算。请在 Supabase 执行最新 supabase_schema.sql', 'error');
      rmbSchemaNoticeShownRef.current = true;
    }
  }

  function toRmb(value) {
    const amount = Number(value || 0);
    const absText = Math.abs(amount).toFixed(2);
    return `${amount < 0 ? '-' : ''}¥${absText}`;
  }

  function toChips(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return String(Math.round(n));
  }

  function toChipInt(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n);
  }

  function toSignedChipIntOrNull(value) {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (!/^-?\d+$/.test(text)) return null;
    return toChipInt(text);
  }

  function toNonNegativeChipInt(value) {
    return Math.max(0, toChipInt(value));
  }

  function getBuyInHistoryKey(roomIdValue, playerIdValue) {
    if (!roomIdValue || !playerIdValue) return '';
    return `${roomIdValue}:${playerIdValue}`;
  }

  async function loadBuyInHistory(roomIdValue, playerIdValue, options = {}) {
    const cacheKey = getBuyInHistoryKey(roomIdValue, playerIdValue);
    if (!cacheKey) return [];
    if (!options.force && buyInHistoryByKey[cacheKey]) {
      return buyInHistoryByKey[cacheKey];
    }
    setBuyInHistoryLoadingKey(cacheKey);
    try {
      const { data, error } = await supabase
        .from('buy_in_events')
        .select('amount,created_at')
        .eq('room_id', roomIdValue)
        .eq('player_id', playerIdValue)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const nextEvents = normalizeBuyInEvents(data || []);
      setBuyInHistoryByKey((prev) => ({ ...prev, [cacheKey]: nextEvents }));
      return nextEvents;
    } finally {
      setBuyInHistoryLoadingKey((prev) => (prev === cacheKey ? '' : prev));
    }
  }

  function chipsToRmb(chips, rate = rmbPer2000) {
    const chipNumber = Number(chips || 0);
    const rateNumber = Number(rate || 0);
    if (!Number.isFinite(chipNumber) || !Number.isFinite(rateNumber) || rateNumber <= 0) return 0;
    return Number(((chipNumber / 2000) * rateNumber).toFixed(2));
  }

  async function ensureProfile(currentUser) {
    if (!currentUser) return;

    const { data: existing, error } = await supabase
      .from('profiles')
      .select('id,nickname')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) throw error;

    const nextName =
      existing?.nickname ||
      currentUser.user_metadata?.nickname ||
      currentUser.email?.split('@')[0] ||
      'Player';

    let resolvedName = nextName;

    if (!existing) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: currentUser.id,
        nickname: resolvedName,
      });

      if (insertError) {
        if (isNicknameUniqueViolation(insertError)) {
          resolvedName = `${nextName}_${String(currentUser.id).slice(0, 4)}`;
          const { error: retryError } = await supabase.from('profiles').insert({
            id: currentUser.id,
            nickname: resolvedName,
          });
          if (retryError) throw retryError;
          showNotice('昵称已被占用，系统已为你分配临时昵称，请在设置中修改。', 'error');
        } else {
          throw insertError;
        }
      }
    } else {
      resolvedName = existing.nickname;
    }

    cacheProfileNames([{ id: currentUser.id, nickname: resolvedName }]);
    setProfileName(resolvedName);
    setNewNickname(resolvedName);
  }

  function invalidateLazyData(options = {}) {
    if (options.leaderboard) {
      setLeaderboardLoaded(false);
    }
    if (options.history) {
      setHistoryLoaded(false);
    }
    if (options.profileDirectory) {
      setProfileDirectoryLoaded(false);
    }
  }

  async function loadDatasetFreshness(options = {}) {
    const { leaderboard = false, history = false } = options;
    const result = {};
    const tasks = [];

    if (leaderboard) {
      tasks.push(
        supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'settled')
          .then(({ count, error }) => {
            if (error) throw error;
            result.leaderboard = { settledCount: Number(count || 0) };
          })
      );
    }

    if (history && user?.id) {
      tasks.push(
        Promise.all([
          supabase.from('room_players').select('room_id').eq('player_id', user.id).limit(5000),
          supabase.from('session_players').select('session_id').eq('player_id', user.id).limit(5000),
        ]).then(([roomResult, settledResult]) => {
          if (roomResult.error) throw roomResult.error;
          if (settledResult.error) throw settledResult.error;
          const allSessionIds = new Set([
            ...(roomResult.data || []).map((row) => row.room_id),
            ...(settledResult.data || []).map((row) => row.session_id),
          ]);
          result.history = {
            totalCount: allSessionIds.size,
            settledCount: Number((settledResult.data || []).length),
          };
        })
      );
    }

    if (tasks.length) {
      await Promise.all(tasks);
    }
    return result;
  }

  async function loadLeaderboard(options = {}) {
    const { force = false } = options;
    if (!force && leaderboardLoaded) return leaderboardRows;
    if (leaderboardLoadPromiseRef.current) return leaderboardLoadPromiseRef.current;

    setLeaderboardLoading(true);
    const request = (async () => {
      const { data: rows, error: rowsErr } = await supabase
        .from('session_players')
        .select('session_id,player_id,buy_in,net_result')
        .limit(20000);
      if (rowsErr) throw rowsErr;

      const sessionIds = [...new Set((rows || []).map((row) => row.session_id).filter(Boolean))];
      if (!sessionIds.length || !(rows || []).length) {
        setLeaderboardRows([]);
        setLeaderboardLoaded(true);
        return [];
      }

      const { data: sessions, error: sessionsErr } = await supabase
        .from('sessions')
        .select('id,created_at,rmb_per_2000')
        .in('id', sessionIds);
      if (sessionsErr) throw sessionsErr;

      const sessionMeta = new Map(
        (sessions || []).map((row) => [
          row.id,
          {
            createdAt: row.created_at,
            rmbPer2000: Number(row.rmb_per_2000 || DEFAULT_RMB_PER_2000),
          },
        ])
      );

      const playerIds = [...new Set((rows || []).map((row) => row.player_id).filter(Boolean))];
      let names = new Map();
      if (playerIds.length) {
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('id,nickname,total_games,winning_games')
        .in('id', playerIds);
      if (profileErr) throw profileErr;
      cacheProfileNames(profiles || []);
      names = new Map((profiles || []).map((p) => [p.id, p.nickname]));
      }

      const mapped = (rows || []).map((row) => {
        const meta = sessionMeta.get(row.session_id) || {};
        return {
          sessionId: row.session_id,
          playerId: row.player_id,
          playerName: names.get(row.player_id) || 'Unknown',
          buyIn: toNonNegativeChipInt(row.buy_in),
          netResult: toChipInt(row.net_result),
          createdAt: meta.createdAt || null,
          rmbPer2000: Number(meta.rmbPer2000 || DEFAULT_RMB_PER_2000),
        };
      });

      leaderboardFreshnessRef.current = { settledCount: sessionIds.length };
      setLeaderboardRows(mapped);
      setLeaderboardLoaded(true);
      return mapped;
    })();

    leaderboardLoadPromiseRef.current = request;
    try {
      return await request;
    } finally {
      leaderboardLoadPromiseRef.current = null;
      setLeaderboardLoading(false);
    }
  }

  async function loadProfileDirectory(options = {}) {
    const { force = false } = options;
    if (!force && profileDirectoryLoaded) return profileDirectory;
    if (profileDirectoryLoadPromiseRef.current) return profileDirectoryLoadPromiseRef.current;

    setProfileDirectoryLoading(true);
    const request = (async () => {
      const { data, error } = await supabase.from('profiles').select('id,nickname').limit(5000);
      if (error) throw error;
      const nextProfiles = data || [];
      cacheProfileNames(nextProfiles);
      setProfileDirectory(nextProfiles);
      setProfileDirectoryLoaded(true);
      return nextProfiles;
    })();

    profileDirectoryLoadPromiseRef.current = request;
    try {
      return await request;
    } finally {
      profileDirectoryLoadPromiseRef.current = null;
      setProfileDirectoryLoading(false);
    }
  }

  async function searchProfilesByPrefix(rawInput) {
    if (!hasSupabaseConfig || !user) return;
    const q = normalizeNickname(rawInput);
    if (!q) {
      setAddPlayerRemoteSuggestions([]);
      return;
    }
    const existingPlayerIds = new Set(activePlayers.map((player) => player.player_id));
    const localMatches = buildLeftMatchSuggestions(profileDirectory, q, existingPlayerIds, 8);
    setAddPlayerRemoteSuggestions(localMatches);

    if (profileDirectoryLoaded) {
      setIsSearchingPlayers(false);
      return;
    }

    setIsSearchingPlayers(true);
    try {
      const latestProfiles = await loadProfileDirectory();
      const filtered = buildLeftMatchSuggestions(latestProfiles, q, existingPlayerIds, 8);
      setAddPlayerRemoteSuggestions(filtered);
    } catch {
      setAddPlayerRemoteSuggestions(localMatches);
    } finally {
      setIsSearchingPlayers(false);
    }
  }

  async function loadOpenRooms() {
    let roomRows = [];
    if (ownerFeatureEnabled) {
      const { data, error } = await supabase
        .from('sessions')
        .select('id,created_at,status,owner_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (isMissingOwnerColumnError(error)) {
          handleOwnerSchemaMissing();
          const fallback = await supabase
            .from('sessions')
            .select('id,created_at,status')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(100);
          if (fallback.error) throw fallback.error;
          roomRows = fallback.data || [];
        } else {
          throw error;
        }
      } else {
        roomRows = data || [];
      }
    } else {
      const { data, error } = await supabase
        .from('sessions')
        .select('id,created_at,status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      roomRows = data || [];
    }

    if (!roomRows.length) {
      setOpenRooms([]);
      return;
    }

    const roomIds = roomRows.map((row) => row.id);
    const { data: myMemberships, error: myMembershipErr } = await supabase
      .from('room_players')
      .select('room_id')
      .in('room_id', roomIds)
      .eq('player_id', user.id);
    if (myMembershipErr) throw myMembershipErr;
    const joinedRoomSet = new Set((myMemberships || []).map((row) => row.room_id));

    const { data: memberRows, error: memberErr } = await supabase
      .from('room_players')
      .select('room_id')
      .in('room_id', roomIds);
    if (memberErr) throw memberErr;
    const memberCountByRoom = new Map();
    (memberRows || []).forEach((row) => {
      memberCountByRoom.set(row.room_id, (memberCountByRoom.get(row.room_id) || 0) + 1);
    });

    let ownerNames = new Map();
    const ownerIds = [...new Set(roomRows.map((row) => row.owner_id).filter(Boolean))];
    if (ownerIds.length) {
      const { data: ownerProfiles, error: ownerProfilesErr } = await supabase
        .from('profiles')
        .select('id,nickname')
        .in('id', ownerIds);
      if (ownerProfilesErr) throw ownerProfilesErr;
      cacheProfileNames(ownerProfiles || []);
      ownerNames = new Map((ownerProfiles || []).map((row) => [row.id, row.nickname]));
    }

    setOpenRooms(
      roomRows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        ownerId: row.owner_id || '',
        ownerName: row.owner_id ? ownerNames.get(row.owner_id) || 'Unknown' : '-',
        isOwner: Boolean(row.owner_id && row.owner_id === user.id),
        memberCount: memberCountByRoom.get(row.id) || 0,
        joinedByMe: joinedRoomSet.has(row.id),
      }))
    );
  }

  async function loadHistorySessions(options = {}) {
    const { force = false } = options;
    if (!force && historyLoaded) return historySessions;
    if (historyLoadPromiseRef.current) return historyLoadPromiseRef.current;

    setHistoryLoading(true);
    const request = (async () => {
      const [{ data: roomRows, error: roomErr }, { data: settledRows, error: settledErr }] = await Promise.all([
        supabase.from('room_players').select('room_id').eq('player_id', user.id).limit(2000),
        supabase.from('session_players').select('session_id').eq('player_id', user.id).limit(2000),
      ]);
      if (roomErr) throw roomErr;
      if (settledErr) throw settledErr;

      const memberSessionIds = [...new Set([
        ...(roomRows || []).map((row) => row.room_id),
        ...(settledRows || []).map((row) => row.session_id),
      ])];
      if (!memberSessionIds.length) {
        setHistorySessions([]);
        setExpandedHistoryId('');
        setHistoryPage(1);
        setHistoryLoaded(true);
        return [];
      }

      let sessions = [];
      if (ownerFeatureEnabled) {
        const { data, error } = await supabase
          .from('sessions')
          .select('id,created_at,status,owner_id')
          .in('id', memberSessionIds)
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) {
          if (isMissingOwnerColumnError(error)) {
            handleOwnerSchemaMissing();
            const fallback = await supabase
              .from('sessions')
              .select('id,created_at,status')
              .in('id', memberSessionIds)
              .order('created_at', { ascending: false })
              .limit(200);
            if (fallback.error) throw fallback.error;
            sessions = fallback.data || [];
          } else {
            throw error;
          }
        } else {
          sessions = data || [];
        }
      } else {
        const { data, error } = await supabase
          .from('sessions')
          .select('id,created_at,status')
          .in('id', memberSessionIds)
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        sessions = data || [];
      }

      const sessionIds = sessions.map((s) => s.id);
      if (!sessionIds.length) {
        setHistorySessions([]);
        setExpandedHistoryId('');
        setHistoryPage(1);
        setHistoryLoaded(true);
        return [];
      }

      let rateBySession = new Map();
      if (rmbRateFeatureEnabled) {
        const { data: rateRows, error: rateErr } = await supabase
          .from('sessions')
          .select('id,rmb_per_2000')
          .in('id', sessionIds);
        if (rateErr) {
          if (isMissingRmbRateColumnError(rateErr)) {
            handleRmbSchemaMissing();
          } else {
            throw rateErr;
          }
        } else {
          rateBySession = new Map(
            (rateRows || []).map((row) => [row.id, Number(row.rmb_per_2000 || DEFAULT_RMB_PER_2000)])
          );
        }
      }

      const { data: sessionPlayers, error: spErr } = await supabase
        .from('session_players')
        .select('session_id,player_id,buy_in,final_chips,net_result')
        .in('session_id', sessionIds);
      if (spErr) throw spErr;

      const { data: transferRows, error: trErr } = await supabase
        .from('transfers')
        .select('session_id,from_player_id,to_player_id,amount')
        .in('session_id', sessionIds)
        .order('id', { ascending: true });
      if (trErr) throw trErr;

      const playerIds = new Set();
      sessions.forEach((s) => {
        if (s.owner_id) playerIds.add(s.owner_id);
      });
      (sessionPlayers || []).forEach((p) => playerIds.add(p.player_id));
      (transferRows || []).forEach((t) => {
        playerIds.add(t.from_player_id);
        playerIds.add(t.to_player_id);
      });

      let names = new Map();
      const ids = Array.from(playerIds);
      if (ids.length) {
      const { data: profiles, error: profileErr } = await supabase
          .from('profiles')
          .select('id,nickname')
          .in('id', ids);
        if (profileErr) throw profileErr;
        cacheProfileNames(profiles || []);
        names = new Map((profiles || []).map((p) => [p.id, p.nickname]));
      }

      const playersBySession = new Map();
      (sessionPlayers || []).forEach((row) => {
        if (!playersBySession.has(row.session_id)) playersBySession.set(row.session_id, []);
        playersBySession.get(row.session_id).push({
          playerId: row.player_id,
          nickname: names.get(row.player_id) || 'Unknown',
          buyIn: toNonNegativeChipInt(row.buy_in),
          finalChips: toNonNegativeChipInt(row.final_chips),
          netResult: Math.round(Number(row.net_result || 0)),
        });
      });

      const transfersBySession = new Map();
      (transferRows || []).forEach((row) => {
        if (!transfersBySession.has(row.session_id)) transfersBySession.set(row.session_id, []);
        transfersBySession.get(row.session_id).push({
          fromPlayerId: row.from_player_id,
          toPlayerId: row.to_player_id,
          fromName: names.get(row.from_player_id) || row.from_player_id,
          toName: names.get(row.to_player_id) || row.to_player_id,
          amount: toNonNegativeChipInt(row.amount),
        });
      });

      const history = sessions.map((s) => ({
        id: s.id,
        createdAt: s.created_at,
        status: s.status,
        ownerId: ownerFeatureEnabled ? s.owner_id || '' : '',
        ownerName: ownerFeatureEnabled && s.owner_id ? names.get(s.owner_id) || 'Unknown' : '-',
        rmbPer2000: Number(rateBySession.get(s.id) ?? DEFAULT_RMB_PER_2000),
        players: (playersBySession.get(s.id) || []).sort((a, b) => b.netResult - a.netResult),
        transfers: transfersBySession.get(s.id) || [],
      }));

      historyFreshnessRef.current = {
        totalCount: history.length,
        settledCount: history.filter((session) => session.status === 'settled').length,
      };
      setHistorySessions(history);
      setExpandedHistoryId((prev) => (history.some((item) => item.id === prev) ? prev : ''));
      setHistoryLoaded(true);
      return history;
    })();

    historyLoadPromiseRef.current = request;
    try {
      return await request;
    } finally {
      historyLoadPromiseRef.current = null;
      setHistoryLoading(false);
    }
  }

  async function refreshLazyDatasets(options = {}) {
    const { leaderboard = false, history = false, guardByFreshness = false } = options;
    const tasks = [];
    const currentTab = activeTabRef.current;
    let freshness = null;

    const shouldConsiderLeaderboard = leaderboard && (currentTab === 'leaderboard' || leaderboardLoadedRef.current);
    const shouldConsiderHistory = history && (currentTab === 'history' || historyLoadedRef.current);

    if (guardByFreshness && (shouldConsiderLeaderboard || shouldConsiderHistory)) {
      freshness = await loadDatasetFreshness({
        leaderboard: shouldConsiderLeaderboard,
        history: shouldConsiderHistory,
      });
    }

    if (leaderboard) {
      const canRefresh =
        !guardByFreshness ||
        !shouldConsiderLeaderboard ||
        shouldRefreshLeaderboardViews({
          previousSignature: leaderboardFreshnessRef.current,
          nextSignature: freshness?.leaderboard,
        });
      if (canRefresh) {
        invalidateLazyData({ leaderboard: true });
      }
      if (canRefresh && shouldConsiderLeaderboard) {
        tasks.push(loadLeaderboard({ force: true }));
      }
    }

    if (history) {
      const canRefresh =
        !guardByFreshness ||
        !shouldConsiderHistory ||
        shouldRefreshHistoryViews({
          previousSignature: historyFreshnessRef.current,
          nextSignature: freshness?.history,
        });
      if (canRefresh) {
        invalidateLazyData({ history: true });
      }
      if (canRefresh && shouldConsiderHistory) {
        tasks.push(loadHistorySessions({ force: true }));
      }
    }

    if (tasks.length) {
      await Promise.all(tasks);
    }
  }

  async function applyMutationInvalidation(action, options = {}) {
    const { hideOpenRooms = false } = options;
    const nextPlan = deriveInvalidationPlan(action);
    if (nextPlan.openRooms) {
      if (hideOpenRooms) {
        setOpenRooms([]);
      } else {
        await loadOpenRooms();
      }
    }
    await refreshLazyDatasets({
      leaderboard: nextPlan.leaderboard,
      history: nextPlan.history,
    });
  }

  async function loadRoom(targetRoomId, options = {}) {
    if (!targetRoomId) return;
    const { includeAllProfiles } = options;
    setOpenBuyInHistoryKey('');
    setBuyInHistoryLoadingKey('');

    let session = null;
    if (ownerFeatureEnabled) {
      const withOwner = await supabase
        .from('sessions')
        .select('status,owner_id')
        .eq('id', targetRoomId)
        .maybeSingle();
      if (withOwner.error) {
        if (isMissingOwnerColumnError(withOwner.error)) {
          handleOwnerSchemaMissing();
          const fallback = await supabase
            .from('sessions')
            .select('status')
            .eq('id', targetRoomId)
            .maybeSingle();
          if (fallback.error) throw fallback.error;
          session = fallback.data;
        } else {
          throw withOwner.error;
        }
      } else {
        session = withOwner.data;
      }
    } else {
      const fallback = await supabase
        .from('sessions')
        .select('status')
        .eq('id', targetRoomId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      session = fallback.data;
    }

    setRoomStatus(session?.status || 'active');
    setRoomOwnerId(ownerFeatureEnabled ? session?.owner_id || '' : '');

    let nextRate = DEFAULT_RMB_PER_2000;
    if (rmbRateFeatureEnabled) {
      const { data: rateRow, error: rateErr } = await supabase
        .from('sessions')
        .select('rmb_per_2000')
        .eq('id', targetRoomId)
        .maybeSingle();
      if (rateErr) {
        if (isMissingRmbRateColumnError(rateErr)) {
          handleRmbSchemaMissing();
        } else {
          throw rateErr;
        }
      } else if (rateRow?.rmb_per_2000 != null) {
        const parsedRate = Number(rateRow.rmb_per_2000);
        if (Number.isFinite(parsedRate) && parsedRate > 0) {
          nextRate = parsedRate;
        }
      }
    }
    setRmbPer2000(nextRate);
    setRmbPer2000Draft(String(nextRate));

    const { data: roomTransfers, error: transferError } = await supabase
      .from('transfers')
      .select('from_player_id,to_player_id,amount')
      .eq('session_id', targetRoomId)
      .order('id', { ascending: true });

    if (transferError) throw transferError;

    const { data: roomRows, error } = await supabase
      .from('room_players')
      .select('room_id,player_id,buy_in,final_chips,updated_at')
      .eq('room_id', targetRoomId)
      .order('updated_at', { ascending: true });

    if (error) throw error;

    const ids = [...new Set((roomRows || []).map((row) => row.player_id).filter(Boolean))];
    const shouldIncludeAllProfiles =
      includeAllProfiles ??
      Boolean(!showMineOnly || roomPlayerDetailsLoaded || session?.status === 'settled' || (roomTransfers || []).length);
    const minimalIds = [...new Set([user?.id, ownerFeatureEnabled ? session?.owner_id : '', roomOwnerId].filter(Boolean))];
    const profileIdsToLoad = shouldIncludeAllProfiles ? ids : ids.filter((id) => minimalIds.includes(id));
    const names = new Map(profileNameCacheRef.current);

    if (profileIdsToLoad.length) {
      const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('id,nickname')
        .in('id', profileIdsToLoad);
      if (profileErr) throw profileErr;
      cacheProfileNames(profiles || []);
      (profiles || []).forEach((profile) => {
        if (profile?.id && profile?.nickname) {
          names.set(profile.id, profile.nickname);
        }
      });
    }

    const mapped = (roomRows || []).map((row) => ({
      ...row,
      buy_in: toNonNegativeChipInt(row.buy_in),
      final_chips: row.final_chips == null ? null : toNonNegativeChipInt(row.final_chips),
      nickname: names.get(row.player_id) || `玩家 ${String(row.player_id || '').slice(0, 6)}`,
      net:
        row.final_chips == null
          ? null
          : Math.round(Number(row.final_chips || 0) - Number(row.buy_in || 0)),
    }));

    setPlayers(mapped);
    setRoomPlayerDetailsLoaded(shouldIncludeAllProfiles);
    setRoomPlayerDetailsLoading(false);

    setTransfers(
      (roomTransfers || []).map((t) => ({
        fromPlayerId: t.from_player_id,
        toPlayerId: t.to_player_id,
        amount: toNonNegativeChipInt(t.amount),
      }))
    );
  }

  async function loadRoomPlayerDetails(targetRoomId = joinedRoomId) {
    if (!targetRoomId || roomPlayerDetailsLoading) return;
    setRoomPlayerDetailsLoading(true);
    try {
      await loadRoom(targetRoomId, { includeAllProfiles: true });
    } finally {
      setRoomPlayerDetailsLoading(false);
    }
  }

  async function subscribeRoom(targetRoomId) {
    if (roomChannelRef.current) {
      await supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }

    const channel = supabase
      .channel(`room-${targetRoomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${targetRoomId}`,
        },
        async () => {
          await loadRoom(targetRoomId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${targetRoomId}`,
        },
        async (payload) => {
          const previousStatus = roomStatusRef.current;
          const nextStatus = payload.new?.status || '';
          await loadRoom(targetRoomId);
          if (
            shouldRefreshSettledViews({
              previousSettledCount: previousStatus === 'settled' ? 1 : 0,
              nextSettledCount: nextStatus === 'settled' ? 1 : 0,
            })
          ) {
            await refreshLazyDatasets({ leaderboard: true, history: true });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transfers',
          filter: `session_id=eq.${targetRoomId}`,
        },
        async () => {
          await loadRoom(targetRoomId);
          await refreshLazyDatasets({ history: true });
        }
      )
      .subscribe();

    roomChannelRef.current = channel;
  }

  async function enterRoom(targetRoomId) {
    const nextRoomId = String(targetRoomId || '').trim();
    if (!nextRoomId) return;
    setLocalMockMode(false);
    setMockPlayers([]);
    setBuyInDrafts({});
    setFinalChipsDrafts({});
    confirmInFlightPlayerIdsRef.current.clear();
    setConfirmingPlayerIds({});
    setJoinedRoomId(nextRoomId);
    setRoomId(nextRoomId);
    setRoomPlayerDetailsLoaded(false);
    setRoomPlayerDetailsLoading(false);
    persistJoinedRoomForCurrentUser(nextRoomId);
    await subscribeRoom(nextRoomId);
    await loadRoom(nextRoomId);
    setHistoryPage(1);
  }

  async function createRoom() {
    if (!beginAction()) return;
    try {
    const targetRoomId = String(roomId || '').trim();
    if (!targetRoomId) {
      showNotice('请输入房间号', 'error');
      return;
    }

    await ensureProfile(user);

    const { data: existingSession, error: sessionCheckErr } = await supabase
      .from('sessions')
      .select('id,status')
      .eq('id', targetRoomId)
      .maybeSingle();
    if (sessionCheckErr) throw sessionCheckErr;

    if (existingSession?.status === 'active') {
      throw createAppError('ROOM_EXISTS', '该房间已存在，请从下方“未结算房间”加入');
    }
    if (existingSession?.status === 'settled') {
      throw createAppError('ROOM_SETTLED', '该房间已结算，无法复用。请使用新的房间号');
    }

    const { error: insertPlayerErr } = await supabase.from('room_players').insert({
      room_id: targetRoomId,
      player_id: user.id,
      buy_in: 2000,
      final_chips: null,
    });
    if (insertPlayerErr) throw insertPlayerErr;

    const insertPayload = {
      id: targetRoomId,
      created_at: new Date().toISOString(),
      status: 'active',
      ...(ownerFeatureEnabled ? { owner_id: user.id } : {}),
      ...(rmbRateFeatureEnabled ? { rmb_per_2000: DEFAULT_RMB_PER_2000 } : {}),
    };

    let createSessionErr = null;
    while (true) {
      const attempt = await supabase.from('sessions').insert(insertPayload);
      createSessionErr = attempt.error;
      if (!createSessionErr) break;
      if (isMissingOwnerColumnError(createSessionErr) && 'owner_id' in insertPayload) {
        handleOwnerSchemaMissing();
        delete insertPayload.owner_id;
        continue;
      }
      if (isMissingRmbRateColumnError(createSessionErr) && 'rmb_per_2000' in insertPayload) {
        handleRmbSchemaMissing();
        delete insertPayload.rmb_per_2000;
        continue;
      }
      break;
    }
    if (createSessionErr) {
      await supabase.from('room_players').delete().eq('room_id', targetRoomId).eq('player_id', user.id);
      throw createSessionErr;
    }

    await enterRoom(targetRoomId);
    await applyMutationInvalidation('create-room', { hideOpenRooms: true });
    showNotice('房间创建成功', 'success');
    } finally {
      endAction();
    }
  }

  async function joinExistingRoom(target = roomId, options = {}) {
    const { refreshOpenRooms = false, useActionLock = true, skipEnsureProfile = false } = options;
    if (useActionLock && !beginAction()) return;
    try {
    const targetRoomId = String(target || '').trim();
    if (!targetRoomId) {
      showNotice('请输入房间号', 'error');
      return;
    }

    if (!skipEnsureProfile) {
      await ensureProfile(user);
    }

    const { data: existingSession, error: sessionCheckErr } = await supabase
      .from('sessions')
      .select('id,status')
      .eq('id', targetRoomId)
      .maybeSingle();
    if (sessionCheckErr) throw sessionCheckErr;

    if (!existingSession) {
      throw createAppError('ROOM_NOT_FOUND', '房间不存在，请先创建房间');
    }
    if (existingSession.status === 'settled') {
      throw createAppError('ROOM_SETTLED', '该房间已结算，无法加入。请选择其他未结算房间');
    }

    const { data: me, error: meErr } = await supabase
      .from('room_players')
      .select('room_id,player_id,buy_in,final_chips')
      .eq('room_id', targetRoomId)
      .eq('player_id', user.id)
      .maybeSingle();
    if (meErr) throw meErr;

    if (!me) {
      const { error: insertErr } = await supabase.from('room_players').insert({
        room_id: targetRoomId,
        player_id: user.id,
        buy_in: 2000,
        final_chips: null,
      });
      if (insertErr) throw insertErr;
    } else if (me.final_chips == null && Number(me.buy_in || 0) <= 0) {
      const { error: ensureDefaultErr } = await supabase
        .from('room_players')
        .update({ buy_in: 2000 })
        .eq('room_id', targetRoomId)
        .eq('player_id', user.id);
      if (ensureDefaultErr) throw ensureDefaultErr;
    }

    await enterRoom(targetRoomId);
    if (refreshOpenRooms) {
      await loadOpenRooms();
    } else {
      await applyMutationInvalidation('join-room', { hideOpenRooms: true });
    }
    } finally {
      if (useActionLock) {
        endAction();
      }
    }
  }

  async function addPlayerToRoom(targetProfile = null) {
    if (!joinedRoomId) return;
    if (!amRoomOwner) {
      showNotice('仅房主可添加玩家', 'error');
      return;
    }
    if (roomStatus === 'settled') {
      showNotice('已结算房间不能再添加玩家', 'error');
      return;
    }

    const typedNickname = normalizeNickname(targetProfile?.nickname || addPlayerNickname);
    if (!typedNickname) {
      showNotice('请输入要添加的玩家昵称', 'error');
      return;
    }

    setIsAddingPlayer(true);
    try {
      const existingPlayerIds = new Set(activePlayers.map((player) => player.player_id));
      let targetPlayer = targetProfile || findBestProfileForAdd(profileDirectory, typedNickname, existingPlayerIds);
      if (!targetPlayer) {
        const latestProfiles = await loadProfileDirectory();
        targetPlayer = findBestProfileForAdd(latestProfiles || [], typedNickname, existingPlayerIds);
      }
      if (!targetPlayer) {
        throw createAppError('PLAYER_NOT_FOUND', '该昵称未注册，无法添加');
      }

      const { error: insertErr } = await supabase.from('room_players').insert({
        room_id: joinedRoomId,
        player_id: targetPlayer.id,
        buy_in: 2000,
        final_chips: null,
      });
      if (insertErr) {
        const message = `${insertErr.message || ''} ${insertErr.details || ''}`.toLowerCase();
        if (insertErr.code === '23505' || message.includes('duplicate')) {
          throw createAppError('PLAYER_EXISTS', '该玩家已经在当前房间');
        }
        throw insertErr;
      }

      setAddPlayerNickname('');
      setAddPlayerFocus(false);
      setAddPlayerRemoteSuggestions([]);
      showNotice(`已添加玩家 ${targetPlayer.nickname}`, 'success');
      await loadRoom(joinedRoomId);
      await applyMutationInvalidation('add-player', { hideOpenRooms: true });
    } finally {
      setIsAddingPlayer(false);
    }
  }

  async function removePlayerFromRoom(targetPlayer) {
    if (!joinedRoomId) return;
    if (!amRoomOwner) {
      showNotice('仅房主可移除玩家', 'error');
      return;
    }
    if (!targetPlayer?.player_id) return;
    if (targetPlayer.player_id === roomOwnerId) {
      showNotice('房主不能被移除', 'error');
      return;
    }
    if (roomStatus === 'settled') {
      showNotice('已结算房间不能移除玩家', 'error');
      return;
    }

    setKickingPlayerId(targetPlayer.player_id);
    try {
      const { error } = await supabase
        .from('room_players')
        .delete()
        .eq('room_id', joinedRoomId)
        .eq('player_id', targetPlayer.player_id);
      if (error) throw error;

      clearPlayerDrafts(targetPlayer.player_id);
      showNotice(`已移除玩家 ${targetPlayer.nickname || ''}`, 'success');
      await loadRoom(joinedRoomId);
      await applyMutationInvalidation('remove-player', { hideOpenRooms: true });
    } finally {
      setKickingPlayerId('');
    }
  }

  function requestDissolveRoom() {
    if (!joinedRoomId) return;
    if (!localMockMode && !amRoomOwner) {
      showNotice('仅房主可解散房间', 'error');
      return;
    }
    if (roomStatus === 'settled') {
      showNotice('已结算房间无需解散', 'error');
      return;
    }
    setDissolveConfirmOpen(true);
  }

  async function dissolveRoom() {
    if (!joinedRoomId || isDissolving) return;
    setIsDissolving(true);
    if (localMockMode) {
      setJoinedRoomId('');
      persistJoinedRoomForCurrentUser('');
      setMockPlayers([]);
      setLocalMockMode(false);
      setPlayers([]);
      setTransfers([]);
      setRoomStatus('active');
      setRoomOwnerId('');
      setRoomPlayerDetailsLoaded(false);
      setRoomPlayerDetailsLoading(false);
      setBuyInDrafts({});
      setFinalChipsDrafts({});
      confirmInFlightPlayerIdsRef.current.clear();
      setConfirmingPlayerIds({});
      setOpenRooms([]);
      setDissolveConfirmOpen(false);
      setIsDissolving(false);
      showNotice('房间已解散（Mock）', 'success');
      return;
    }

    try {
      const targetRoomId = joinedRoomId;
      const { error: clearRoomPlayersErr } = await supabase
        .from('room_players')
        .delete()
        .eq('room_id', targetRoomId);
      if (clearRoomPlayersErr) throw clearRoomPlayersErr;

      const { error: deleteSessionErr } = await supabase
        .from('sessions')
        .delete()
        .eq('id', targetRoomId);
      if (deleteSessionErr) throw deleteSessionErr;

      if (roomChannelRef.current) {
        await supabase.removeChannel(roomChannelRef.current);
        roomChannelRef.current = null;
      }
      setJoinedRoomId('');
      persistJoinedRoomForCurrentUser('');
      setPlayers([]);
      setTransfers([]);
      setRoomStatus('active');
      setRoomOwnerId('');
      setBuyInDrafts({});
      setFinalChipsDrafts({});
      confirmInFlightPlayerIdsRef.current.clear();
      setConfirmingPlayerIds({});
      setDissolveConfirmOpen(false);
      showNotice('房间已解散', 'success');
      await loadOpenRooms();
      await refreshLazyDatasets({ leaderboard: true, history: true, guardByFreshness: true });
    } finally {
      setIsDissolving(false);
    }
  }

  async function saveRoomRmbRate() {
    if (!beginAction()) return;
    try {
    if (!joinedRoomId) return;
    const nextRate = Number(rmbPer2000Draft);
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      showNotice('请输入合法的 RMB 换算值', 'error');
      return;
    }

    if (localMockMode) {
      setRmbPer2000(Number(nextRate.toFixed(2)));
      setRmbPer2000Draft(String(Number(nextRate.toFixed(2))));
      showNotice('换算设置已更新（Mock）', 'success');
      return;
    }

    if (!amRoomOwner) {
      showNotice('仅房主可修改换算设置', 'error');
      return;
    }

    if (!rmbRateFeatureEnabled) {
      showNotice('数据库未开启 RMB 换算字段，请先执行最新 supabase_schema.sql', 'error');
      return;
    }

    const { error } = await supabase
      .from('sessions')
      .update({ rmb_per_2000: Number(nextRate.toFixed(2)) })
      .eq('id', joinedRoomId);
    if (error) {
      if (isMissingRmbRateColumnError(error)) {
        handleRmbSchemaMissing();
        return;
      }
      throw error;
    }

    setRmbPer2000(Number(nextRate.toFixed(2)));
    setRmbPer2000Draft(String(Number(nextRate.toFixed(2))));
    showNotice('换算设置已更新', 'success');
    } finally {
      endAction();
    }
  }

  function adjustBuyIn(player, delta) {
    const playerId = player.player_id;
    const editable = localMockMode || playerId === user?.id || (ownerFeatureEnabled && roomOwnerId === user?.id);
    if (!editable) return;

    const current = toSignedChipIntOrNull(buyInDrafts[playerId] ?? 0) ?? 0;
    if (!Number.isFinite(current)) return;
    const nextValue = Math.round(current + delta * BUY_IN_STEP);
    setBuyInDrafts((prev) => ({ ...prev, [playerId]: String(nextValue) }));
  }

  function clearPlayerDrafts(playerId) {
    setBuyInDrafts((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
    setFinalChipsDrafts((prev) => {
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
  }

  function mergePlayersWithDrafts(basePlayers) {
    return [...basePlayers].map((p) => {
      const finalDraft = finalChipsDrafts[p.player_id];
      return {
        ...p,
        buy_in: toNonNegativeChipInt(p.buy_in),
        final_chips:
          finalDraft == null
            ? p.final_chips == null
              ? null
              : toNonNegativeChipInt(p.final_chips)
            : finalDraft === ''
              ? null
              : toNonNegativeChipInt(finalDraft),
      };
    });
  }

  async function confirmPlayerInput(player) {
    const playerId = player.player_id;
    if (!playerId) return;
    if (confirmInFlightPlayerIdsRef.current.has(playerId)) return;
    const canEditBuyIn =
      localMockMode || playerId === user?.id || (ownerFeatureEnabled && roomOwnerId === user?.id);
    const canEditFinal =
      localMockMode || playerId === user?.id || (ownerFeatureEnabled && roomOwnerId === user?.id);
    if (!canEditBuyIn && !canEditFinal) return;

    const merged = mergePlayersWithDrafts([player])[0];
    const topUpDraft = buyInDrafts[playerId];
    const topUpAmount =
      canEditBuyIn ? toSignedChipIntOrNull(topUpDraft) : null;
    const currentBuyIn = toNonNegativeChipInt(player.buy_in);
    const nextBuyIn =
      topUpAmount == null ? currentBuyIn : Math.max(0, currentBuyIn + topUpAmount);
    const nextFinal = canEditFinal
      ? merged.final_chips == null
        ? null
        : toNonNegativeChipInt(merged.final_chips)
      : player.final_chips == null
        ? null
        : toNonNegativeChipInt(player.final_chips);

    if (topUpDraft != null && String(topUpDraft).trim() !== '' && topUpAmount == null) {
      showNotice('本次买入仅支持整数，可输入负数用于冲正', 'error');
      return;
    }
    if (!Number.isFinite(nextBuyIn) || nextBuyIn < 0) {
      showNotice('买入金额不合法', 'error');
      return;
    }
    if (canEditFinal && nextFinal != null && (!Number.isFinite(nextFinal) || nextFinal < 0)) {
      showNotice('最终积分不合法', 'error');
      return;
    }

    confirmInFlightPlayerIdsRef.current.add(playerId);
    setConfirmingPlayerIds((prev) => ({ ...prev, [playerId]: true }));
    try {
      if (localMockMode) {
        setMockPlayers((prev) =>
          prev.map((item) =>
            item.player_id === playerId
              ? {
                  ...item,
                  buy_in: topUpAmount == null ? item.buy_in : nextBuyIn,
                  final_chips: canEditFinal ? nextFinal : item.final_chips,
                }
              : item
          )
        );
        if (topUpAmount != null && topUpAmount !== 0) {
          const cacheKey = getBuyInHistoryKey(joinedRoomId, playerId);
          setBuyInHistoryByKey((prev) => ({
            ...prev,
            [cacheKey]: normalizeBuyInEvents([
              ...(prev[cacheKey] || []),
              {
                amount: topUpAmount,
                created_at: new Date().toISOString(),
              },
            ]),
          }));
        }
        clearPlayerDrafts(playerId);
        return;
      }

      const updatePayload = {};
      if (topUpAmount != null) {
        updatePayload.buy_in = nextBuyIn;
      }
      if (canEditFinal) {
        updatePayload.final_chips = nextFinal == null ? null : toNonNegativeChipInt(nextFinal);
      }
      if (!Object.keys(updatePayload).length) return;

      const { error } = await supabase
        .from('room_players')
        .update(updatePayload)
        .eq('room_id', joinedRoomId)
        .eq('player_id', playerId);
      if (error) throw error;

      // Optimistic local sync so total buy-in/final chips update immediately
      setPlayers((prev) =>
        prev.map((item) => {
          if (item.player_id !== playerId) return item;
          return {
            ...item,
            ...(Object.prototype.hasOwnProperty.call(updatePayload, 'buy_in')
              ? { buy_in: toNonNegativeChipInt(updatePayload.buy_in) }
              : null),
            ...(Object.prototype.hasOwnProperty.call(updatePayload, 'final_chips')
              ? { final_chips: updatePayload.final_chips == null ? null : toNonNegativeChipInt(updatePayload.final_chips) }
              : null),
          };
        })
      );

      clearPlayerDrafts(playerId);

      if (topUpAmount != null && topUpAmount !== 0) {
        const eventPayload = buildBuyInEventPayload({
          roomId: joinedRoomId,
          playerId,
          createdBy: user.id,
          amount: topUpAmount,
        });
        const cacheKey = getBuyInHistoryKey(joinedRoomId, playerId);
        setBuyInHistoryByKey((prev) => ({
          ...prev,
          [cacheKey]: normalizeBuyInEvents([
            ...(prev[cacheKey] || []),
            {
              amount: topUpAmount,
              created_at: new Date().toISOString(),
            },
          ]),
        }));
        const { error: buyInEventError } = await supabase.from('buy_in_events').insert(eventPayload);
        if (buyInEventError) {
          showNotice('买入已更新，但买入记录功能需要先执行最新 supabase_schema.sql', 'error');
        }
      }
    } finally {
      confirmInFlightPlayerIdsRef.current.delete(playerId);
      setConfirmingPlayerIds((prev) => {
        if (!prev[playerId]) return prev;
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
    }
  }

  async function settleSession() {
    if (!joinedRoomId) return;
    if (settleInFlightRef.current) return;

    settleInFlightRef.current = true;
    setIsSettling(true);

    try {
      if (!localMockMode && ownerFeatureEnabled) {
        const { data: sessionRow, error: ownerCheckErr } = await supabase
          .from('sessions')
          .select('owner_id')
          .eq('id', joinedRoomId)
          .maybeSingle();
        if (ownerCheckErr) {
          if (isMissingOwnerColumnError(ownerCheckErr)) {
            handleOwnerSchemaMissing();
          } else {
            throw ownerCheckErr;
          }
        } else {
          if (!sessionRow) {
            throw createAppError('ROOM_NOT_FOUND', '房间不存在或已失效');
          }
          if (sessionRow.owner_id !== user.id) {
            throw createAppError('NOT_ROOM_OWNER', '仅房主可以结算本局');
          }
        }
      }

      const localPlayers = mergePlayersWithDrafts(activePlayers);
      const settlement = validateAndBuildSettlement(localPlayers);
      if (!settlement.ok) {
        showNotice(settlement.error, 'error');
        return;
      }
      const nextTransfers = settlement.transfers;

      if (localMockMode) {
        setTransfers(nextTransfers);
        setRoomStatus('settled');
        showNotice('Mock 结算完成（未写入数据库）', 'success');
        return;
      }

      const sessionPayload = {
        id: joinedRoomId,
        created_at: new Date().toISOString(),
        status: 'settled',
        ...(ownerFeatureEnabled ? { owner_id: user.id } : {}),
        ...(rmbRateFeatureEnabled ? { rmb_per_2000: Number(rmbPer2000 || DEFAULT_RMB_PER_2000) } : {}),
      };

      let sessionErr = null;
      while (true) {
        const attempt = await supabase.from('sessions').upsert(sessionPayload, { onConflict: 'id' });
        sessionErr = attempt.error;
        if (!sessionErr) break;
        if (isMissingOwnerColumnError(sessionErr) && 'owner_id' in sessionPayload) {
          handleOwnerSchemaMissing();
          delete sessionPayload.owner_id;
          continue;
        }
        if (isMissingRmbRateColumnError(sessionErr) && 'rmb_per_2000' in sessionPayload) {
          handleRmbSchemaMissing();
          delete sessionPayload.rmb_per_2000;
          continue;
        }
        break;
      }
      if (sessionErr) throw sessionErr;

      const { error: clearPlayersErr } = await supabase
        .from('session_players')
        .delete()
        .eq('session_id', joinedRoomId);
      if (clearPlayersErr) throw clearPlayersErr;

      const { error: clearTransfersErr } = await supabase
        .from('transfers')
        .delete()
        .eq('session_id', joinedRoomId);
      if (clearTransfersErr) throw clearTransfersErr;

      const sessionPlayersPayload = localPlayers.map((p) => ({
        session_id: joinedRoomId,
        player_id: p.player_id,
        buy_in: toNonNegativeChipInt(p.buy_in),
        final_chips: toNonNegativeChipInt(p.final_chips),
        net_result: Math.round(Number(p.final_chips) - Number(p.buy_in)),
      }));

      const { error: insertSessionPlayersErr } = await supabase
        .from('session_players')
        .insert(sessionPlayersPayload);
      if (insertSessionPlayersErr) throw insertSessionPlayersErr;

      if (nextTransfers.length) {
        const transferPayload = nextTransfers.map((t) => ({
          session_id: joinedRoomId,
          from_player_id: t.fromPlayerId,
          to_player_id: t.toPlayerId,
          amount: toNonNegativeChipInt(t.amount),
        }));

        const { error: insertTransfersErr } = await supabase.from('transfers').insert(transferPayload);
        if (insertTransfersErr) throw insertTransfersErr;
      }

      showNotice('结算完成', 'success');
      await loadRoom(joinedRoomId);
      await applyMutationInvalidation('settle-room', { hideOpenRooms: true });
    } finally {
      settleInFlightRef.current = false;
      setIsSettling(false);
    }
  }

  async function signInCompat(email, rawPassword) {
    const plain = String(rawPassword || '');
    const firstTry = await supabase.auth.signInWithPassword({
      email,
      password: plain,
    });
    if (!firstTry.error) return { error: null };

    const firstMessage = String(firstTry.error.message || '').toLowerCase();
    if (!firstMessage.includes('invalid login credentials')) {
      return firstTry;
    }

    const legacy = normalizePasswordLegacy(plain);
    if (!legacy || legacy === plain) {
      return firstTry;
    }

    const legacyTry = await supabase.auth.signInWithPassword({
      email,
      password: legacy,
    });
    if (!legacyTry.error) return { error: null };
    return firstTry;
  }

  async function resolveLoginEmailsByNickname(trimmedNickname, fallbackEmails = []) {
    const { data: resolvedEmails, error: resolvedErr } = await supabase.rpc('resolve_login_emails', {
      target_nickname: trimmedNickname,
    });

    if (resolvedErr && !isMissingFunctionError(resolvedErr, 'resolve_login_emails')) {
      throw resolvedErr;
    }

    return [...new Set([...(Array.isArray(resolvedEmails) ? resolvedEmails : []), ...fallbackEmails])];
  }

  async function signUp() {
    if (!beginAction()) return;
    try {
    const trimmedNickname = normalizeNickname(authNickname);
    if (!trimmedNickname) {
      showNotice('注册时请填写昵称', 'error');
      return;
    }
    if (!password.trim()) {
      showNotice('请填写密码', 'error');
      return;
    }

    const { data: exists, error: existsErr } = await supabase.rpc('nickname_exists', {
      target_nickname: trimmedNickname,
    });
    if (!existsErr && exists) {
      showNotice('昵称已存在，请更换一个昵称', 'error');
      return;
    }

    const syntheticEmail = nicknameToEmail(trimmedNickname);

    const passwordForAuth = normalizePasswordLegacy(password);

    const { data, error } = await supabase.auth.signUp({
      email: syntheticEmail,
      password: passwordForAuth,
      options: {
        data: {
          nickname: trimmedNickname,
        },
      },
    });

    if (error) {
      const text = String(error.message || '').toLowerCase();
      if (text.includes('already registered') || text.includes('already exists')) {
        throw createAppError('NICKNAME_EXISTS', '昵称已存在，请更换一个昵称');
      }
      throw error;
    }

    if (!data.session) {
      showNotice('注册成功。请在 Supabase 关闭邮箱确认（Confirm email）后再登录。', 'success');
    } else {
      showNotice('注册并登录成功', 'success');
    }
    } finally {
      endAction();
    }
  }

  async function signIn() {
    if (!beginAction()) return;
    try {
    const trimmedNickname = normalizeNickname(authNickname);
    if (!trimmedNickname) {
      showNotice('请填写昵称', 'error');
      return;
    }
    if (!password.trim()) {
      showNotice('请填写密码', 'error');
      return;
    }

    const candidates = [nicknameToEmail(trimmedNickname)];

    const emails = await resolveLoginEmailsByNickname(trimmedNickname, candidates);

    let loginError = null;
    let loggedIn = false;
    for (const email of emails) {
      const attempt = await signInCompat(email, password);
      if (!attempt.error) {
        loggedIn = true;
        break;
      }
      loginError = attempt.error;
    }

    if (loggedIn) return;

    const error = loginError || createAppError('UNKNOWN_LOGIN_ERROR', '登录失败，请稍后重试');
    if (error) {
      const normalizedMessage = String(error.message || '').toLowerCase();
      if (normalizedMessage.includes('invalid login credentials')) {
        const { data: exists, error: existsErr } = await supabase.rpc('nickname_exists', {
          target_nickname: trimmedNickname,
        });
        if (existsErr) {
          if (isMissingFunctionError(existsErr, 'nickname_exists')) {
            throw createAppError('SCHEMA_OUTDATED', '数据库登录函数未更新，请在 Supabase 执行最新 supabase_schema.sql');
          }
          throw existsErr;
        }
        if (!exists) {
          throw createAppError('USER_NOT_FOUND', '该用户尚未注册');
        }
        throw createAppError('INVALID_PASSWORD', '密码输入错误，请重试');
      }
      throw error;
    }
    } finally {
      endAction();
    }
  }

  async function updateMyNickname() {
    setSettingsError('');
    const next = normalizeNickname(newNickname);
    if (!next) {
      setSettingsError('昵称不能为空');
      return false;
    }

    const sameAsCurrent = String(profileName || '').trim().toLowerCase() === next.toLowerCase();
    if (!sameAsCurrent) {
      const { data: exists, error: existsErr } = await supabase.rpc('nickname_exists', {
        target_nickname: next,
      });
      if (!existsErr && exists) {
        setSettingsError('昵称已存在，请更换一个昵称');
        return false;
      }
      if (existsErr && !isMissingFunctionError(existsErr, 'nickname_exists')) {
        throw existsErr;
      }
    }

    const { error } = await supabase.from('profiles').update({ nickname: next }).eq('id', user.id);
    if (error) {
      if (isNicknameUniqueViolation(error)) {
        setSettingsError('昵称已存在，请更换一个昵称');
        return false;
      }
      throw error;
    }
    setProfileName(next);
    setNewNickname(next);
    showNotice('昵称已更新', 'success');
    if (joinedRoomId) {
      await loadRoom(joinedRoomId);
    }
    await refreshLazyDatasets({ leaderboard: true, history: true });
    return true;
  }

  async function updateMyPassword() {
    setSettingsError('');
    const nextPassword = String(newPassword || '');
    if (!nextPassword.trim()) {
      setSettingsError('请输入新密码');
      return false;
    }

    const nextPasswordForAuth = normalizePasswordLegacy(nextPassword);
    const { error } = await supabase.auth.updateUser({ password: nextPasswordForAuth });
    if (error) {
      const text = String(error.message || '').toLowerCase();
      if (text.includes('different from the old') || text.includes('same as')) {
        setSettingsError('新密码不能与当前密码相同');
        return false;
      }
      setSettingsError(error.message || '密码更新失败，请重试');
      return false;
    }
    setNewPassword('');
    showNotice('密码已更新', 'success');
    return true;
  }

  async function signOut() {
    await supabase.auth.signOut();
    if (user?.id) {
      clearPersistedJoinedRoom(user.id);
    }
    if (roomChannelRef.current) {
      await supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }
    setJoinedRoomId('');
    setLocalMockMode(false);
    setMockPlayers([]);
    setPlayers([]);
    setBuyInDrafts({});
    setFinalChipsDrafts({});
    confirmInFlightPlayerIdsRef.current.clear();
    setConfirmingPlayerIds({});
    setTransfers([]);
    setRoomOwnerId('');
    setRmbPer2000(DEFAULT_RMB_PER_2000);
    setRmbPer2000Draft(String(DEFAULT_RMB_PER_2000));
    setLeaderboardRows([]);
    setLeaderboardLoaded(false);
    setLeaderboardLoading(false);
    setHistorySessions([]);
    setHistoryLoaded(false);
    setHistoryLoading(false);
    setExpandedHistoryId('');
    setHistoryPage(1);
    setDatePreset('all');
    setCustomStartDate(defaultStartDate);
    setCustomEndDate(defaultEndDate);
    setOpenRooms([]);
    setProfileDirectory([]);
    setProfileDirectoryLoaded(false);
    setProfileDirectoryLoading(false);
    setRoomPlayerDetailsLoaded(false);
    setRoomPlayerDetailsLoading(false);
    setDissolveConfirmOpen(false);
    setIsDissolving(false);
    setAccountMenuOpen(false);
  }

  async function saveAccountSettings() {
    if (accountSaving) return;
    setAccountSaving(true);
    try {
      const ok = settingsTab === 'nickname' ? await updateMyNickname() : await updateMyPassword();
      if (!ok) return;
      setAccountMenuOpen(false);
      setSettingsError('');
      setWelcomePulse(true);
    } finally {
      setAccountSaving(false);
    }
  }

  function handleTabChange(nextTab) {
    if (nextTab === activeTab) return;
    prevTabRef.current = activeTab;
    setActiveTab(nextTab);
  }

  async function leaveCurrentRoom() {
    if (roomChannelRef.current) {
      await supabase.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }
    setJoinedRoomId('');
    persistJoinedRoomForCurrentUser('');
    setLocalMockMode(false);
    setMockPlayers([]);
    setPlayers([]);
    setBuyInDrafts({});
    setFinalChipsDrafts({});
    confirmInFlightPlayerIdsRef.current.clear();
    setConfirmingPlayerIds({});
    setTransfers([]);
    setRoomStatus('active');
    setRoomOwnerId('');
    setRoomPlayerDetailsLoaded(false);
    setRoomPlayerDetailsLoading(false);
    setRmbPer2000(DEFAULT_RMB_PER_2000);
    setRmbPer2000Draft(String(DEFAULT_RMB_PER_2000));
    setBuyInHistoryByKey({});
    setBuyInHistoryLoadingKey('');
    setOpenBuyInHistoryKey('');
    setHistoryPage(1);
    setDissolveConfirmOpen(false);
    setIsDissolving(false);
    setNotice('');
    await loadOpenRooms();
    prevTabRef.current = activeTab;
    setActiveTab('room');
    setAccountMenuOpen(false);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!hasSupabaseConfig) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        showNotice(error.message, 'error');
      }

      if (mounted) {
        setUser(session?.user || null);
        setLoading(false);
      }
    }

    bootstrap();

    const { data: listener } = hasSupabaseConfig
      ? supabase.auth.onAuthStateChange((_evt, session) => {
          setUser(session?.user || null);
        })
      : { data: null };

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
      if (roomChannelRef.current) {
        supabase.removeChannel(roomChannelRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function onUserReady() {
      if (!hasSupabaseConfig || !user) return;
      try {
        await ensureProfile(user);
        invalidateLazyData({ leaderboard: true, history: true, profileDirectory: true });
        setLeaderboardRows([]);
        setHistorySessions([]);
        setExpandedHistoryId('');
        setHistoryPage(1);
        setProfileDirectory([]);
        setAddPlayerRemoteSuggestions([]);
        const initialLoadPlan = deriveInitialLoadPlan({
          persistedRoomId: loadPersistedJoinedRoom(user.id, null),
        });
        if (initialLoadPlan.restoreRoomId) {
          if (initialLoadPlan.preserveRoomShell) {
            setJoinedRoomId(initialLoadPlan.restoreRoomId);
            setRoomId(initialLoadPlan.restoreRoomId);
          }
          try {
            await joinExistingRoom(initialLoadPlan.restoreRoomId, {
              refreshOpenRooms: false,
              useActionLock: false,
              skipEnsureProfile: true,
            });
          } catch (err) {
            clearPersistedJoinedRoom(user.id, null);
            setJoinedRoomId('');
            showNotice(err.message || '已清理失效房间状态，请重新进入房间', 'error');
            await loadOpenRooms();
          }
        } else if (initialLoadPlan.loadOpenRooms) {
          await loadOpenRooms();
        }
      } catch (err) {
        showNotice(err.message, 'error');
      }
    }

    onUserReady();
  }, [user, defaultEndDate, defaultStartDate]);

  useEffect(() => {
    if (!openBuyInHistoryKey) return undefined;
    function handlePointerDown(event) {
      const target = event.target;
      if (buyInHistoryPopoverRef.current?.contains(target)) return;
      if (buyInHistoryTriggerRef.current?.contains(target)) return;
      setOpenBuyInHistoryKey('');
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [openBuyInHistoryKey]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user) return;
    if (!shouldLoadTabData({ activeTab, targetTab: 'leaderboard', loaded: leaderboardLoaded, loading: leaderboardLoading })) {
      return;
    }
    loadLeaderboard().catch((err) => showNotice(err.message, 'error'));
  }, [activeTab, user, leaderboardLoaded, leaderboardLoading]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user) return;
    if (!shouldLoadTabData({ activeTab, targetTab: 'history', loaded: historyLoaded, loading: historyLoading })) {
      return;
    }
    loadHistorySessions().catch((err) => showNotice(err.message, 'error'));
  }, [activeTab, user, historyLoaded, historyLoading]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user) return;
    if (
      !shouldLoadPlayerDirectory({
        hasJoinedRoom: Boolean(joinedRoomId),
        amRoomOwner,
        showMineOnly,
        focused: Boolean(addPlayerFocus || normalizeNickname(addPlayerNickname)),
        loaded: profileDirectoryLoaded,
        loading: profileDirectoryLoading,
      })
    ) {
      return;
    }
    loadProfileDirectory().catch((err) => showNotice(err.message, 'error'));
  }, [
    user,
    joinedRoomId,
    amRoomOwner,
    showMineOnly,
    addPlayerFocus,
    addPlayerNickname,
    profileDirectoryLoaded,
    profileDirectoryLoading,
  ]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user) return;
    if (
      !shouldLoadRoomPlayerDetails({
        hasJoinedRoom: Boolean(joinedRoomId),
        showMineOnly,
        loaded: roomPlayerDetailsLoaded,
        loading: roomPlayerDetailsLoading,
      })
    ) {
      return;
    }
    loadRoomPlayerDetails().catch((err) => showNotice(err.message, 'error'));
  }, [user, joinedRoomId, showMineOnly, roomPlayerDetailsLoaded, roomPlayerDetailsLoading]);

  useEffect(() => {
    setExpandedLeaderboardId((prev) => (visibleLeaderboard.some((item) => item.playerId === prev) ? prev : ''));
  }, [visibleLeaderboard]);

  useEffect(() => {
    setShowAllLeaderboard(false);
  }, [leaderboardView]);

  useEffect(() => {
    function updateCollapsedCount() {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (width >= 640) {
        setLeaderboardCollapsedCount(5);
        return;
      }
      setLeaderboardCollapsedCount(height >= 900 ? 6 : 5);
    }
    updateCollapsedCount();
    window.addEventListener('resize', updateCollapsedCount);
    return () => window.removeEventListener('resize', updateCollapsedCount);
  }, []);

  useEffect(() => {
    setShowAllLeaderboard(false);
    setExpandedLeaderboardId('');
  }, [datePreset, customStartDate, customEndDate]);

  useEffect(() => {
    if (historyPage > historyPageCount) {
      setHistoryPage(historyPageCount);
    }
  }, [historyPage, historyPageCount]);

  useEffect(() => {
    if (activeTab !== 'leaderboard') {
      setDatePopoverOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setExpandedHistoryId((prev) => (pagedHistorySessions.some((item) => item.id === prev) ? prev : ''));
  }, [pagedHistorySessions]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!welcomePulse) return undefined;
    const timer = setTimeout(() => setWelcomePulse(false), 1200);
    return () => clearTimeout(timer);
  }, [welcomePulse]);

  if (!hasSupabaseConfig) {
    return (
      <main className="safe-area-bottom w-full px-3 py-4 sm:px-4 md:mx-auto md:max-w-6xl md:py-8">
        <section className="glass-card rounded-3xl p-4 sm:p-6">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{APP_NAME}</h1>
          <p className="mt-3 text-sm text-slate-600">请先配置 Supabase 环境变量：</p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
            VITE_SUPABASE_URL=你的项目URL{`\n`}VITE_SUPABASE_ANON_KEY=你的匿名KEY
          </pre>
          <p className="mt-3 text-sm text-slate-600">并执行 `npm run dev`。</p>
        </section>
        {renderNotice()}
      </main>
    );
  }

  if (loading) {
    return (
      <main className="safe-area-bottom w-full px-3 py-4 sm:px-4 md:mx-auto md:max-w-6xl md:py-8">
        <section className="glass-card rounded-3xl p-4 text-sm text-slate-600">加载中...</section>
        {renderNotice()}
      </main>
    );
  }

  if (!user) {
    return (
      <main className="safe-area-bottom w-full px-3 py-4 sm:px-4 md:mx-auto md:max-w-6xl md:py-8">
        <section className="glass-card rounded-3xl p-4 sm:mx-auto sm:max-w-md sm:p-6">
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{APP_NAME}</h1>

          <label className="mt-5 block">
            <span className="field-label">昵称</span>
            <input
              className="field-input"
              value={authNickname}
              onChange={(e) => setAuthNickname(e.target.value)}
              maxLength={20}
            />
          </label>

          <label className="mt-2 block">
            <span className="field-label">密码</span>
            <div className="relative">
              <input
                className="field-input pr-20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showAuthPassword ? 'text' : 'password'}
              />
              <button
                type="button"
                aria-label={showAuthPassword ? '隐藏密码' : '显示密码'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white/95 p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
                onClick={() => setShowAuthPassword((prev) => !prev)}
              >
                {showAuthPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>

          <div className="mt-4">
            {authMode === 'login' ? (
              <button
                onClick={async () => {
                  try {
                    await signIn();
                  } catch (err) {
                    showNotice(err.message, 'error');
                  }
                }}
                className="btn-primary w-full"
              >
                登录
              </button>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await signUp();
                  } catch (err) {
                    showNotice(err.message, 'error');
                  }
                }}
                className="btn-primary w-full"
              >
                注册
              </button>
            )}
          </div>

          <button
            className="btn-secondary mt-3 w-full"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
          </button>

        </section>
        {renderNotice()}
      </main>
    );
  }

  return (
    <main className="safe-area-bottom w-full px-3 py-3 sm:px-4 md:mx-auto md:max-w-6xl md:py-8">
      <section className="glass-card relative rounded-3xl px-4 py-2.5 sm:px-5 sm:py-3.5">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 w-full">
            <h1 className="app-title mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{APP_NAME}</h1>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className={`text-sm text-slate-600 transition ${welcomePulse ? 'welcome-pulse' : ''}`}>
                欢迎，{profileName || user.email}
              </p>
              <button
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/80 bg-white/80 px-3 py-2 text-slate-700 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                onClick={() => {
                  setAccountMenuOpen((prev) => !prev);
                  setSettingsError('');
                }}
                aria-label="账户设置"
                title="账户"
              >
                <AccountAvatarIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="tab-scroll segmented-shell relative mt-3 overflow-x-auto p-1">
          <div className="relative z-[1] grid min-w-full grid-cols-3 gap-2">
            <button
              className={`relative rounded-2xl px-2 py-2.5 text-sm font-semibold transition focus:outline-none ${
                activeTab === 'room'
                  ? 'text-white shadow-[0_10px_24px_rgba(59,130,246,0.35)]'
                  : 'border border-white/80 bg-white/75 text-slate-700 shadow-sm'
              }`}
              style={
                activeTab === 'room'
                  ? { background: 'linear-gradient(138deg, #4f46e5, #3b82f6 56%, #22d3ee)' }
                  : undefined
              }
              onClick={() => handleTabChange('room')}
            >
              当前房间
            </button>
            <button
              className={`relative rounded-2xl px-2 py-2.5 text-sm font-semibold transition focus:outline-none ${
                activeTab === 'leaderboard'
                  ? 'text-white shadow-[0_10px_24px_rgba(59,130,246,0.35)]'
                  : 'border border-white/80 bg-white/75 text-slate-700 shadow-sm'
              }`}
              style={
                activeTab === 'leaderboard'
                  ? { background: 'linear-gradient(138deg, #4f46e5, #3b82f6 56%, #22d3ee)' }
                  : undefined
              }
              onClick={() => handleTabChange('leaderboard')}
            >
              积分榜
            </button>
            <button
              className={`relative rounded-2xl px-2 py-2.5 text-sm font-semibold transition focus:outline-none ${
                activeTab === 'history'
                  ? 'text-white shadow-[0_10px_24px_rgba(59,130,246,0.35)]'
                  : 'border border-white/80 bg-white/75 text-slate-700 shadow-sm'
              }`}
              style={
                activeTab === 'history'
                  ? { background: 'linear-gradient(138deg, #4f46e5, #3b82f6 56%, #22d3ee)' }
                  : undefined
              }
              onClick={() => handleTabChange('history')}
            >
              历史记录
            </button>
          </div>
        </div>

        {activeTab === 'room' && (
          <div className={tabSlideClass}>
            {!hasJoinedRoom && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className="field-label">房间号</span>
                <input
                  className="field-input"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder={todayRoomId()}
                />
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      await createRoom();
                    } catch (err) {
                      showNotice(err.message, 'error');
                    }
                  }}
                >
                  创建房间
                </button>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    try {
                      await joinExistingRoom();
                    } catch (err) {
                      showNotice(err.message, 'error');
                    }
                  }}
                >
                  加入房间
                </button>
              </div>
              </div>
            )}

            {!hasJoinedRoom && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-800">未结算房间</p>
                  <button
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 text-amber-700 transition hover:bg-white"
                    disabled={isRefreshingOpenRooms}
                    onClick={async () => {
                      setRefreshSpinTick((prev) => prev + 1);
                      try {
                        setIsRefreshingOpenRooms(true);
                        await loadOpenRooms();
                    } catch (err) {
                      showNotice(err.message, 'error');
                    } finally {
                      setIsRefreshingOpenRooms(false);
                    }
                  }}
                  aria-label="刷新未结算房间"
                  title="刷新"
                >
                  <RefreshIcon
                    key={`refresh-${refreshSpinTick}`}
                    className={`h-4 w-4 ${refreshSpinTick > 0 ? 'refresh-spin-once' : ''}`}
                  />
                </button>
              </div>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                {!openRooms.length && (
                  <div className="rounded-xl border border-amber-100 bg-white/80 px-3 py-2 text-xs text-amber-700">
                    当前没有未结算房间
                  </div>
                )}
                {openRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">房间 {room.id}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {ownerFeatureEnabled ? `房主 ${room.ownerName}` : '房主未知'} · {room.memberCount} 人
                        {room.isOwner ? ' · 你是房主' : ''} · {formatDateTime(room.createdAt)}
                      </p>
                    </div>
                    <button
                      className={room.joinedByMe ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-secondary px-3 py-1.5 text-xs'}
                      onClick={async () => {
                        try {
                          await joinExistingRoom(room.id);
                        } catch (err) {
                          showNotice(err.message, 'error');
                        }
                      }}
                    >
                      {room.joinedByMe ? '继续游戏' : '进入房间'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            )}
            <p className="mt-2 text-xs text-slate-500">
              房主可添加/移除玩家，修改所有玩家的买入/最终积分和积分换算，并有权限结算本局。
            </p>

          </div>
        )}

      </section>

      {activeTab === 'room' && hasJoinedRoom && (
      <section className={`${tabSlideClass} glass-card panel-fill mt-3 flex flex-col rounded-3xl p-4 sm:mt-4 sm:p-6`}>
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-ink sm:text-2xl">
                当前房间
                <span className="ml-2 font-bold tracking-tight">{joinedRoomId || '-'}</span>
              </h2>
              {hasJoinedRoom && ownerFeatureEnabled && (
                <span className="room-owner-highlight inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold">
                  <OwnerCrown className="h-4 w-4" />
                  房主 {roomOwnerName}
                </span>
              )}
            </div>
            <div className="tab-scroll flex flex-nowrap items-center gap-2 overflow-x-auto">
              <button className="btn-secondary room-switch-btn min-w-[92px] whitespace-nowrap px-3 py-1.5 text-xs" onClick={leaveCurrentRoom}>
                切换房间
              </button>
              {roomStatus === 'settled' && (
                <span className="inline-flex min-w-[80px] justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  已结算
                </span>
              )}
              {hasJoinedRoom && roomStatus !== 'settled' && amRoomOwner && (
                <button
                  className="min-w-[92px] whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  onClick={requestDissolveRoom}
                >
                  解散房间
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3">
          {hasJoinedRoom && (
            <div className="mb-3 rounded-2xl border border-slate-200 bg-white/85 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-600">积分换算：</span>
                  2000 积分 = <span className="font-semibold text-slate-900">{toRmb(rmbPer2000)}</span>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    className={`field-input w-36 ${
                      !amRoomOwner && !localMockMode ? 'bg-slate-100/90 text-slate-400 border-slate-200' : ''
                    }`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={rmbPer2000Draft}
                    onChange={(e) => setRmbPer2000Draft(e.target.value)}
                    disabled={!amRoomOwner && !localMockMode}
                  />
                  <button
                    className="btn-secondary whitespace-nowrap"
                    onClick={async () => {
                      try {
                        await saveRoomRmbRate();
                      } catch (err) {
                        showNotice(err.message, 'error');
                      }
                    }}
                    disabled={!amRoomOwner && !localMockMode}
                  >
                    保存换算
                  </button>
                </div>
              </div>
              {!amRoomOwner && !localMockMode && (
                <p className="mt-1 text-xs text-slate-500">仅房主可修改换算</p>
              )}
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              className={showMineOnly ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setShowMineOnly(true)}
            >
              仅看我
            </button>
            <button
              className={!showMineOnly ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setShowMineOnly(false)}
            >
              全部玩家
            </button>
          </div>

          {hasJoinedRoom && amRoomOwner && roomStatus !== 'settled' && !showMineOnly && (
            <div className="mb-3 rounded-2xl border border-slate-200 bg-white/85 p-3">
              <div className="relative mt-0 flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="relative w-full sm:max-w-xs">
                  <input
                    className="field-input w-full"
                    placeholder="输入玩家昵称并添加"
                    value={addPlayerNickname}
                    onFocus={() => setAddPlayerFocus(true)}
                    onBlur={() => {
                      window.setTimeout(() => setAddPlayerFocus(false), 120);
                    }}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setAddPlayerNickname(raw);
                      setAddPlayerFocus(true);
                      searchProfilesByPrefix(raw).catch(() => {});
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const first = addPlayerSuggestions[0];
                        addPlayerToRoom(first || null).catch((err) => showNotice(err.message, 'error'));
                      }
                    }}
                  />
                  {addPlayerFocus && String(addPlayerNickname || '').trim() !== '' && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur-md">
                      {addPlayerSuggestions.length > 0 ? (
                        addPlayerSuggestions.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setAddPlayerNickname(item.nickname);
                              addPlayerToRoom(item).catch((err) => showNotice(err.message, 'error'));
                            }}
                          >
                            {item.nickname}
                          </button>
                        ))
                      ) : (
                        <div className="px-2.5 py-2 text-sm text-slate-500">
                          {isSearchingPlayers ? '搜索中...' : '未找到可添加玩家'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn-secondary whitespace-nowrap"
                  disabled={isAddingPlayer}
                  onClick={async () => {
                    try {
                      await addPlayerToRoom();
                    } catch (err) {
                      showNotice(err.message, 'error');
                    }
                  }}
                >
                  {isAddingPlayer ? (
                    <span className="inline-flex items-center gap-2">
                      <LoadingSpinner className="h-4 w-4" />
                      添加中
                    </span>
                  ) : (
                    '添加玩家'
                  )}
                </button>
              </div>
            </div>
          )}

          <div
            className={
              showMineOnly
                ? 'grid grid-cols-1 gap-2.5'
                : 'tab-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto px-0.5 pb-1 [scrollbar-width:thin]'
            }
          >
            {visiblePlayers.map((p) => {
            const mine = p.player_id === user.id;
            const isOwner = ownerFeatureEnabled && roomOwnerId === user.id;
            const canEditBuyIn = localMockMode || mine || isOwner;
            const canEditFinal = localMockMode || mine || isOwner;
            const canConfirm = canEditBuyIn || canEditFinal;
            const canKick = hasJoinedRoom && amRoomOwner && !mine && p.player_id !== roomOwnerId && roomStatus !== 'settled';
            const isKicking = kickingPlayerId === p.player_id;
            const isConfirming = Boolean(confirmingPlayerIds[p.player_id]);
            const buyInHistoryKey = getBuyInHistoryKey(joinedRoomId, p.player_id);
            const buyInHistoryEvents = buyInHistoryByKey[buyInHistoryKey] || [];
            const buyInHistoryOpen = openBuyInHistoryKey === buyInHistoryKey;
            const buyInHistoryLoading = buyInHistoryLoadingKey === buyInHistoryKey;
            const buyDraft = buyInDrafts[p.player_id];
            const finalDraft = finalChipsDrafts[p.player_id];
            const displayBuyIn = buyDraft ?? '';
            const displayFinal = finalDraft ?? (p.final_chips == null ? '' : String(toNonNegativeChipInt(p.final_chips)));
            const hasPendingFinalDraft = finalDraft != null;
            const netValue =
              hasPendingFinalDraft || p.final_chips == null
                ? null
                : Math.round(Number(p.final_chips || 0) - Number(p.buy_in || 0));
            const netClass = netValue > 0 ? 'text-emerald-600' : netValue < 0 ? 'text-rose-600' : 'text-slate-500';
            return (
              <article
                key={p.player_id}
                className={`rounded-2xl border bg-white/85 p-3.5 shadow-sm sm:p-4 ${
                  mine ? 'border-sky-300 ring-2 ring-sky-100' : 'border-white/70'
                } ${showMineOnly ? '' : 'w-[95%] max-w-[38rem] shrink-0 snap-center sm:w-[90%]'}`}
              >
                <div className="mb-2.5 flex items-center gap-1.5 break-all text-base font-semibold text-slate-900">
                  <div className="min-w-0 flex-1">
                    {p.nickname}
                    {ownerFeatureEnabled && p.player_id === roomOwnerId && (
                      <span className="ml-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5">
                        <OwnerCrown className="h-5 w-5" />
                      </span>
                    )}
                    {mine ? '（我）' : ''}
                  </div>
                  {canKick && (
                    <button
                      type="button"
                      className="ml-auto shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                      disabled={isKicking}
                      onClick={async () => {
                        try {
                          await removePlayerFromRoom(p);
                        } catch (err) {
                          showNotice(err.message, 'error');
                        }
                      }}
                    >
                      {isKicking ? '移除中...' : '移除玩家'}
                    </button>
                  )}
                </div>
                <div className="relative mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
                  <p className="min-w-0">
                    累计总买入：
                    <AnimatedNumber
                      className="ml-1 font-semibold text-slate-700"
                      value={toNonNegativeChipInt(p.buy_in)}
                      format={(n) => toChips(n)}
                    />{' '}
                    积分
                  </p>
                  <div className="shrink-0">
                    <button
                      type="button"
                      aria-label="查看买入记录"
                      className="info-trigger"
                      ref={buyInHistoryOpen ? buyInHistoryTriggerRef : null}
                      onClick={async () => {
                        if (!buyInHistoryKey) return;
                        if (buyInHistoryOpen) {
                          setOpenBuyInHistoryKey('');
                          return;
                        }
                        setOpenBuyInHistoryKey(buyInHistoryKey);
                        try {
                          await loadBuyInHistory(joinedRoomId, p.player_id);
                        } catch (err) {
                          setOpenBuyInHistoryKey('');
                          showNotice(err.message, 'error');
                        }
                      }}
                    >
                      <InfoCircleIcon />
                    </button>
                  </div>
                  {buyInHistoryOpen && (
                    <div
                      ref={buyInHistoryPopoverRef}
                      className={getBuyInPopoverClassName()}
                    >
                      <div className="account-popover-arrow hidden right-auto left-[-0.45rem] top-1/2 -translate-y-1/2 sm:block" aria-hidden />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-900">买入记录</p>
                          {buyInHistoryLoading && <LoadingSpinner className="h-3.5 w-3.5 text-slate-400" />}
                        </div>
                        {buyInHistoryEvents.length ? (
                          <ul className="space-y-1.5">
                            {buyInHistoryEvents.map((event, idx) => (
                              <li
                                key={`${event.created_at || idx}-${event.amount}-${idx}`}
                                className="flex items-center justify-between rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-slate-700"
                              >
                                <span className="font-medium text-slate-500">{event.displayTime}</span>
                                <span className={event.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                  {event.displayAmount} 积分
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-slate-500">
                            {buyInHistoryLoading ? '加载中...' : '暂无买入记录'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="field-label">本次买入</span>
                  <div className="mt-1 grid grid-cols-[1fr_auto] items-center gap-2">
                    <input
                      className="field-input no-spin min-w-0 flex-1"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={displayBuyIn}
                      placeholder="输入本次买入"
                      disabled={!canEditBuyIn}
                      onChange={(e) => {
                        if (!canEditBuyIn) return;
                        const raw = e.target.value;
                        if (!/^-?\d*$/.test(raw)) return;
                        setBuyInDrafts((prev) => ({ ...prev, [p.player_id]: raw }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canConfirm) {
                          e.preventDefault();
                          confirmPlayerInput(p).catch((err) => {
                            showNotice(err.message, 'error');
                          });
                        }
                      }}
                    />
                    <div className="flex shrink-0 items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={!canEditBuyIn}
                        className="step-btn min-h-[44px] min-w-[58px] px-2.5"
                        onClick={() => adjustBuyIn(p, -1)}
                      >
                        -2k
                      </button>
                      <button
                        type="button"
                        disabled={!canEditBuyIn}
                        className="step-btn step-btn-positive min-h-[44px] min-w-[58px] px-2.5"
                        onClick={() => adjustBuyIn(p, 1)}
                      >
                        +2k
                      </button>
                    </div>
                  </div>
                </label>

                <label className="mt-2 block">
                  <span className="field-label">最终积分</span>
                  <input
                    className="field-input no-spin"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={displayFinal}
                    disabled={!canEditFinal}
                    onChange={(e) => {
                      if (!canEditFinal) return;
                      const raw = e.target.value;
                      if (!/^\d*$/.test(raw)) return;
                      setFinalChipsDrafts((prev) => ({ ...prev, [p.player_id]: raw }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canConfirm) {
                        e.preventDefault();
                        confirmPlayerInput(p).catch((err) => {
                          showNotice(err.message, 'error');
                        });
                      }
                    }}
                  />
                </label>

                {canConfirm && (
                  <button
                    className="btn-secondary mt-2 w-full border-slate-300 bg-white text-slate-800"
                    disabled={isConfirming}
                    onClick={async () => {
                      try {
                        await confirmPlayerInput(p);
                      } catch (err) {
                        showNotice(err.message, 'error');
                      }
                    }}
                  >
                    {isConfirming ? (
                      <span className="inline-flex items-center gap-2">
                        <LoadingSpinner className="h-4 w-4" />
                        确认中
                      </span>
                    ) : (
                      '确定'
                    )}
                  </button>
                )}

                <div className={`mt-3 text-sm font-semibold ${netClass}`}>
                  净输赢：
                  {netValue == null ? (
                    hasPendingFinalDraft ? (
                      '待确认'
                    ) : (
                      '-'
                    )
                  ) : (
                    <>
                      {' '}
                      {toChips(netValue)} 积分 <span className="text-slate-400">/</span> {toRmb(chipsToRmb(netValue))}
                    </>
                  )}
                </div>
              </article>
            );
            })}
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/90 p-3.5 text-sm text-slate-700 sm:p-4">
          总买入：
          <b className="num">
            <AnimatedNumber value={toNonNegativeChipInt(totalBuyIn)} format={(n) => toChips(n)} />
          </b>{' '}
          | 总最终积分：
          <b className="num">
            <AnimatedNumber value={toNonNegativeChipInt(totalFinal)} format={(n) => toChips(n)} />
          </b>
        </div>

        {hasJoinedRoom && amRoomOwner && (
          <button
            className="btn-primary mt-3 w-full"
            onClick={async () => {
              try {
                await settleSession();
              } catch (err) {
                showNotice(err.message, 'error');
              }
            }}
            disabled={!joinedRoomId || isSettling}
          >
            {isSettling ? '结算中...' : '结算本局'}
          </button>
        )}

        <h3 className="mt-5 text-lg font-semibold text-ink">转账建议</h3>
        <ul className="mt-2 space-y-2.5 text-sm text-slate-700">
          {!transfers.length && (
            <li className="rounded-2xl border border-white/70 bg-white/70 px-3.5 py-3 text-slate-500 backdrop-blur-md">
              暂无
            </li>
          )}
          {transfers.map((t, idx) => (
            <li
              key={`${t.fromPlayerId}-${t.toPlayerId}-${idx}`}
              className="rounded-2xl border border-white/80 bg-white/80 px-3.5 py-3 shadow-sm backdrop-blur-md"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-slate-700">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 break-all">
                    {nameById.get(t.fromPlayerId) || t.fromPlayerId}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 break-all">
                    {nameById.get(t.toPlayerId) || t.toPlayerId}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    {toChips(t.amount)} 积分
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {toRmb(chipsToRmb(t.amount))}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      )}

      {activeTab === 'leaderboard' && (
      <section className={`${tabSlideClass} glass-card panel-fill mt-3 flex flex-col rounded-3xl p-4 sm:mt-4 sm:p-6`}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-xl font-semibold leading-none text-ink sm:text-2xl">历史积分榜</h2>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur-md whitespace-nowrap">
              <span className="text-slate-500">累计总局数</span>
              <span className="font-semibold text-slate-900">{filteredLeaderboardSessionCount}</span>
          </div>
        </div>
        <div className="mt-2 w-full">{renderDatePopover()}</div>
        <div className="tab-scroll segmented-shell relative mt-3 min-h-[3.3rem] overflow-x-auto p-1">
          <div className="relative z-[1] inline-flex min-w-full gap-2 pr-1">
          <button
            className={`${leaderboardView === 'profit' ? 'btn-primary' : 'btn-secondary'} min-h-[44px] min-w-[94px] whitespace-nowrap`}
            onClick={() => setLeaderboardView('profit')}
          >
            净盈利
          </button>
          <button
            className={`${leaderboardView === 'roi' ? 'btn-primary' : 'btn-secondary'} min-h-[44px] min-w-[94px] whitespace-nowrap`}
            onClick={() => setLeaderboardView('roi')}
          >
            ROI
          </button>
          <button
            className={`${leaderboardView === 'efficiency' ? 'btn-primary' : 'btn-secondary'} min-h-[44px] min-w-[106px] whitespace-nowrap`}
            onClick={() => setLeaderboardView('efficiency')}
          >
            场均金额
          </button>
          <button
            className={`${leaderboardView === 'amount' ? 'btn-primary' : 'btn-secondary'} min-h-[44px] min-w-[94px] whitespace-nowrap`}
            onClick={() => setLeaderboardView('amount')}
          >
            金额
          </button>
          <button
            className={`${leaderboardView === 'winRate' ? 'btn-primary' : 'btn-secondary'} min-h-[44px] min-w-[94px] whitespace-nowrap`}
            onClick={() => setLeaderboardView('winRate')}
          >
            胜率
          </button>
          </div>
        </div>
          <div key={leaderboardRenderKey} className="tab-scroll mt-3 space-y-2 pr-1 pb-2">
          {!visibleLeaderboard.length && (
            <div className="rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-500">
              {leaderboardLoading && !leaderboardLoaded ? '积分榜加载中...' : '暂无数据'}
            </div>
          )}
          {visibleLeaderboard.map((p) => {
            const mine = p.playerId === user.id;
            const expanded = expandedLeaderboardId === p.playerId;
            const metric = getLeaderboardMetric(p, leaderboardView);
            return (
              <article
                key={`${leaderboardView}-${p.playerId}-${p.displayRank}`}
                className={`rounded-2xl border bg-white/90 p-3.5 ${
                  mine ? 'border-sky-300 ring-2 ring-sky-100' : 'border-slate-200'
                }`}
              >
                <button
                  type="button"
                  className="group w-full text-left"
                  onClick={() =>
                    setExpandedLeaderboardId((prev) => (prev === p.playerId ? '' : p.playerId))
                  }
                >
                  <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
                    <span className="rank-pill">#{p.displayRank}</span>
                    <div className="min-w-0">
                      <h3 className="flex min-w-0 items-center gap-1.5 text-lg font-semibold leading-tight text-slate-900">
                        <span className="min-w-0 truncate">{p.name}</span>
                        {mine && (
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                            我
                          </span>
                        )}
                        {p.displayRank <= 3 && (
                          <img
                            src={p.displayRank === 1 ? medalGoldIcon : p.displayRank === 2 ? medalSilverIcon : medalBronzeIcon}
                            alt={p.displayRank === 1 ? '金牌' : p.displayRank === 2 ? '银牌' : '铜牌'}
                            className="h-5 w-5 shrink-0"
                          />
                        )}
                      </h3>
                      <p className="mt-1 truncate text-xs text-slate-500">总局数 {p.totalSessions}</p>
                    </div>
                    <div className="w-[6.5rem] text-right sm:w-28">
                      <p
                        className={`whitespace-nowrap text-lg font-semibold tabular-nums ${metric.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}
                      >
                        {metric.text}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <ChevronToggle expanded={expanded} />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <p>总局数</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{p.totalSessions}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <p>盈利场次</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{p.winningGames}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <p>总买入</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{toChips(p.totalBuyIn)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <p>净盈利</p>
                      <p className={`mt-0.5 font-semibold ${p.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {toChips(p.totalProfit)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <p>场均盈利金额</p>
                      <p className={`mt-0.5 font-semibold ${p.avgAmountPerSession >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {toRmb(p.avgAmountPerSession)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <p>金额</p>
                      <p className={`mt-0.5 font-semibold ${p.amountRmb >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {toRmb(p.amountRmb)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <p>ROI</p>
                      <p className={`mt-0.5 font-semibold ${p.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {p.roi > 0 ? '+' : ''}
                        {p.roi.toFixed(1)}%
                      </p>
                    </div>
                    <div className="sm:col-span-3">
                      <WinRateRing value={p.winRate} />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {rankedLeaderboard.length > LEADERBOARD_COLLAPSED_COUNT && (
            <button
              type="button"
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              onClick={() => setShowAllLeaderboard((prev) => !prev)}
            >
              {showAllLeaderboard ? '收起排名' : '查看更多'}
            </button>
          )}
        </div>
      </section>
      )}

      {activeTab === 'history' && (
      <section className={`${tabSlideClass} glass-card panel-fill mt-3 flex flex-col rounded-3xl p-4 sm:mt-4 sm:p-6`}>
        <h2 className="shrink-0 text-xl font-semibold text-ink sm:text-2xl">历史记录</h2>
        <div className="mt-3 flex flex-1 flex-col">
          <div className="space-y-2.5">
          {!filteredHistorySessions.length && (
            <div className="rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-500">
              {historyLoading && !historyLoaded ? '历史记录加载中...' : '暂无历史对局'}
            </div>
          )}
          {pagedHistorySessions.map((session, idx) => {
            const expanded = expandedHistoryId === session.id;
            return (
              <article
                key={session.id}
                className="history-fade-up rounded-2xl border border-slate-200 bg-gradient-to-br from-white/95 to-slate-50/80 p-2.5 shadow-sm"
                style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedHistoryId((prev) => (prev === session.id ? '' : session.id))}
                >
                  <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-base font-semibold leading-tight text-slate-900">
                          房间 {session.id}
                        </span>
                        {session.status === 'settled' && (
                          <span className="status-settled rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            已结算
                          </span>
                        )}
                        {session.status !== 'settled' && (
                          <span className="status-active rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            进行中
                          </span>
                        )}
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                          {session.players.length} 位玩家
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                          {session.transfers.length} 笔转账
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                          2000 积分 = {toRmb(session.rmbPer2000)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-slate-500 sm:text-xs">
                        {formatDateTime(session.createdAt)} · 房主 {session.ownerName}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                      <ChevronToggle expanded={expanded} />
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.7fr_1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                      <p className="text-sm font-semibold text-slate-900">玩家结果</p>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {!session.players.length && (
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm text-slate-500">
                            暂无玩家数据
                          </div>
                        )}
                        {session.players.map((player) => {
                          const roi = player.buyIn ? (player.netResult / player.buyIn) * 100 : 0;
                          const isProfit = player.netResult >= 0;
                          return (
                            <div
                              key={`${session.id}-${player.playerId}`}
                              className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                            >
                              <p className="text-sm font-semibold text-slate-900 break-all">{player.nickname}</p>
                              <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                                <p>买入 {toChips(player.buyIn)}</p>
                                <p>最终积分 {toChips(player.finalChips)}</p>
                                <p>
                                  净输赢{' '}
                                  <span className={`font-semibold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {toChips(player.netResult)} 积分
                                  </span>
                                  <span className={`ml-1 font-semibold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ({toRmb(chipsToRmb(player.netResult, session.rmbPer2000))})
                                  </span>
                                </p>
                                <p>
                                  ROI{' '}
                                  <span className={`font-semibold ${roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {roi > 0 ? '+' : ''}
                                    {roi.toFixed(1)}%
                                  </span>
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                      <p className="text-sm font-semibold text-slate-900">转账明细</p>
                      <div className="mt-2 space-y-2 text-sm text-slate-700">
                        {!session.transfers.length && (
                          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-slate-500">
                            暂无转账
                          </div>
                        )}
                        {session.transfers.map((item, idx) => (
                          <div
                            key={`${session.id}-${item.fromPlayerId}-${item.toPlayerId}-${idx}`}
                            className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 break-all">
                                  {item.fromName}
                                </span>
                                <span className="text-slate-400">→</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 break-all">
                                  {item.toName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                                  {toChips(item.amount)} 积分
                                </span>
                                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                  {toRmb(chipsToRmb(item.amount, session.rmbPer2000))}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          </div>
          <div className="segmented-shell mt-auto shrink-0 p-1">
            <div className="grid min-h-[44px] grid-cols-[auto_1fr_auto] items-center gap-2">
              <button
                className="btn-secondary inline-flex min-h-[44px] min-w-[88px] items-center justify-center gap-1.5 px-3 py-2 text-xs"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                aria-label="上一页"
                title="上一页"
              >
                <ArrowLeftIcon />
              </button>
              <span className="text-center text-slate-600">
                <b>{historyPage}</b>/<b>{historyPageCount}</b>
              </span>
              <button
                className="btn-secondary inline-flex min-h-[44px] min-w-[88px] items-center justify-center gap-1.5 px-3 py-2 text-xs"
                disabled={historyPage >= historyPageCount}
                onClick={() => setHistoryPage((prev) => Math.min(historyPageCount, prev + 1))}
                aria-label="下一页"
                title="下一页"
              >
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      {accountMenuOpen && (
        <div className="fixed inset-0 z-[58]">
          <button
            className="absolute inset-0 bg-slate-900/22"
            onClick={() => {
              setAccountMenuOpen(false);
              setSettingsError('');
            }}
            aria-label="关闭账户菜单"
          />
          <div className="account-popover absolute right-4 top-[7rem] w-[min(68vw,22rem)] min-w-[15.5rem] rounded-2xl border border-white/80 bg-white/96 p-3 shadow-xl backdrop-blur-2xl md:right-[max(1rem,calc((100vw-72rem)/2+1rem))]">
            <div className="account-popover-arrow" aria-hidden />
            <div className="segmented-shell p-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`${settingsTab === 'nickname' ? 'btn-primary' : 'btn-secondary'} min-h-[44px] px-3 py-2 text-xs`}
                  onClick={() => {
                    setSettingsTab('nickname');
                    setSettingsError('');
                  }}
                >
                  昵称
                </button>
                <button
                  className={`${settingsTab === 'password' ? 'btn-primary' : 'btn-secondary'} min-h-[44px] px-3 py-2 text-xs`}
                  onClick={() => {
                    setSettingsTab('password');
                    setSettingsError('');
                  }}
                >
                  密码
                </button>
              </div>
            </div>

            {settingsError && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-700">
                {settingsError}
              </div>
            )}

            <div key={settingsTab} className="account-pane-slide mt-2">
              {settingsTab === 'nickname' ? (
                <label className="block">
                  <input
                    className="account-input"
                    value={newNickname}
                    onChange={(e) => {
                      setNewNickname(e.target.value);
                      setSettingsError('');
                    }}
                    maxLength={20}
                  />
                </label>
              ) : (
                <label className="block">
                  <input
                    className="account-input"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setSettingsError('');
                    }}
                    type="text"
                  />
                </label>
              )}
            </div>

            <button
              className="btn-primary mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2"
              onClick={async () => {
                try {
                  await saveAccountSettings();
                } catch (err) {
                  setSettingsError(err.message || '保存失败，请重试');
                }
              }}
              disabled={accountSaving}
            >
              {accountSaving ? (
                <>
                  <LoadingSpinner className="h-4 w-4 text-white" />
                  保存中...
                </>
              ) : (
                '保存设置'
              )}
            </button>

            <button
              className="btn-secondary mt-2 min-h-[44px] w-full border-rose-200 bg-rose-50/85 text-rose-700"
              onClick={signOut}
            >
              退出登录
            </button>
          </div>
        </div>
      )}

      {(actionLoading || isSettling || isDissolving) && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/15 backdrop-blur-[1px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg">
            <LoadingSpinner className="h-4 w-4 text-slate-700" />
            处理中...
          </div>
        </div>
      )}

      {renderNotice()}

      {dissolveConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <button
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => {
              if (isDissolving) return;
              setDissolveConfirmOpen(false);
            }}
            aria-label="关闭解散确认"
          />
          <section className="relative z-10 w-full rounded-t-3xl border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur-xl sm:max-w-md sm:rounded-3xl sm:p-6">
            <h2 className="text-xl font-semibold text-ink">解散房间</h2>
            <p className="mt-2 text-sm text-slate-600">
              确认解散房间 <span className="font-semibold text-slate-900">{joinedRoomId}</span>？
              解散后该房间的成员数据将被清空。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="btn-secondary"
                disabled={isDissolving}
                onClick={() => setDissolveConfirmOpen(false)}
              >
                取消
              </button>
              <button
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isDissolving}
                onClick={async () => {
                  try {
                    await dissolveRoom();
                  } catch (err) {
                    showNotice(err.message, 'error');
                  }
                }}
              >
                {isDissolving ? '解散中...' : '确认解散'}
              </button>
            </div>
          </section>
        </div>
      )}

    </main>
  );
}
