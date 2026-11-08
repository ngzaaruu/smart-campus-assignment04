import { useMemo, useState } from 'react';
import {
  DoorClosed,
  Clock,
  CalendarClock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Ban,
  Timer,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

// ---- Fixed demo data (do not change their meaning) ----
const NOW = 540; // 09:00
const EXISTING_BOOKINGS: ReadonlyArray<readonly [number, number]> = [
  [600, 660], // 10:00 - 11:00
];

const DAY_MIN = 1440;
const MAX_DURATION = 120;

type Min = number;

type Result =
  | { kind: 'available' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'error'; reasons: string[] };

// ---- helpers ----
const pad2 = (n: number) => n.toString().padStart(2, '0');

const fmtTime = (m: number): string => {
  const mm = ((m % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = Math.floor(mm / 60);
  const min = mm % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(min)} ${period}`;
};

const fmtRange = (s: number, e: number) => `${fmtTime(s)} – ${fmtTime(e)}`;

const intervalsOverlap = (
  a: readonly [number, number],
  b: readonly [number, number]
): boolean => {
  // Touching at an endpoint is NOT overlap.
  return a[0] < b[1] && b[0] < a[1];
};

// Parse a text field into an integer or null (non-integer / empty => null)
const parseMin = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^-?\d+$/.test(trimmed)) return null; // non-integer (decimals, letters)
  return Number(trimmed);
};

// ---- core availability logic ----
export function checkAvailability(
  startRaw: string,
  endRaw: string,
  blocked: boolean
): Result {
  const errors: string[] = [];

  if (startRaw.trim() === '') errors.push('Start time is required.');
  if (endRaw.trim() === '') errors.push('End time is required.');

  if (errors.length) return { kind: 'error', reasons: errors };

  const start = parseMin(startRaw);
  const end = parseMin(endRaw);

  if (start === null) errors.push('Start time must be a whole number (minutes after midnight).');
  if (end === null) errors.push('End time must be a whole number (minutes after midnight).');

  if (errors.length) return { kind: 'error', reasons: errors };

  // AC1
  if (start < 0 || start >= DAY_MIN)
    errors.push('Start time must be between 0 and 1439.');
  if (end < 1 || end > DAY_MIN)
    errors.push('End time must be between 1 and 1440.');
  if (errors.length) return { kind: 'error', reasons: errors };

  if (start >= end) {
    errors.push('Start time must be earlier than end time.');
    return { kind: 'error', reasons: errors };
  }

  // AC1: start must be strictly later than now
  if (start <= NOW) {
    errors.push(`Start time must be later than the current time (${fmtTime(NOW)}).`);
    return { kind: 'error', reasons: errors };
  }

  // AC2: duration <= 120
  const duration = end - start;
  if (duration > MAX_DURATION) {
    errors.push(
      `Booking length is ${duration} minutes. Maximum allowed is ${MAX_DURATION} minutes.`
    );
    return { kind: 'error', reasons: errors };
  }

  // AC3: blocked room is always unavailable
  if (blocked) {
    return {
      kind: 'unavailable',
      reason: 'This room is currently marked as blocked and cannot be booked.',
    };
  }

  // AC4: reject overlap (touching endpoints allowed)
  const request: [number, number] = [start, end];
  for (const b of EXISTING_BOOKINGS) {
    if (intervalsOverlap(request, b)) {
      return {
        kind: 'unavailable',
        reason: `Overlaps an existing booking (${fmtRange(b[0], b[1])}).`,
      };
    }
  }

  // AC5: available
  return { kind: 'available' };
}

// ---- visual timeline ----
function Timeline({
  start,
  end,
  blocked,
  resultKind,
}: {
  start: number | null;
  end: number | null;
  blocked: boolean;
  resultKind: 'available' | 'unavailable' | 'error' | 'idle';
}) {
  // 24h axis
  const hourMarks = Array.from({ length: 25 }, (_, i) => i * 60);

  const pct = (m: number) => `${(m / DAY_MIN) * 100}%`;

  const showRequest =
    start !== null && end !== null && start >= 0 && end <= DAY_MIN && start < end;

  const requestColor =
    resultKind === 'available'
      ? 'bg-emerald-400'
      : resultKind === 'unavailable'
        ? 'bg-rose-400'
        : 'bg-sky-400';

  return (
    <div className="w-full">
      <div className="relative h-28 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
        {/* now marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-500/70 z-20"
          style={{ left: pct(NOW) }}
          title={`Now ${fmtTime(NOW)}`}
        >
          <span className="absolute -top-0 left-1 -translate-x-0 text-[10px] font-semibold text-amber-600 whitespace-nowrap">
            Now
          </span>
        </div>

        {/* existing bookings */}
        {EXISTING_BOOKINGS.map((b, i) => {
          const widthPct = ((b[1] - b[0]) / DAY_MIN) * 100;
          const leftPct = (b[0] / DAY_MIN) * 100;
          const label = fmtRange(b[0], b[1]);
          const fitsInside = widthPct > 22;
          return (
            <div key={i} className="absolute z-10" style={{ left: pct(b[0]) }}>
              <div
                className="absolute top-6 bottom-6 rounded-md bg-slate-300 border border-slate-400"
                style={{ width: `${widthPct}%` }}
                title={`Existing ${label}`}
              >
                {fitsInside && (
                  <span className="block px-1 text-[9px] leading-6 text-slate-700 font-medium truncate">
                    {label}
                  </span>
                )}
              </div>
              {!fitsInside && (
                <span
                  className="absolute -top-1 left-0 text-[9px] text-slate-700 font-semibold whitespace-nowrap"
                  style={{ transform: 'translateY(-100%)' }}
                  title={`Existing ${label}`}
                >
                  {label}
                </span>
              )}
            </div>
          );
        })}

        {/* requested interval */}
        {showRequest && (
          <div
            className={`absolute top-12 bottom-3 rounded-md ${requestColor} border border-slate-500/40 z-10 transition-colors`}
            style={{ left: pct(start!), width: `${((end! - start!) / DAY_MIN) * 100}%` }}
            title={`Request ${fmtRange(start!, end!)}`}
          >
            <span className="block px-1 text-[9px] leading-[40px] text-white font-semibold truncate">
              Request
            </span>
          </div>
        )}

        {blocked && (
          <div className="absolute inset-0 bg-rose-100/60 z-30 flex items-center justify-center">
            <span className="text-xs font-bold text-rose-600 tracking-wide uppercase">
              Room Blocked
            </span>
          </div>
        )}

        {/* hour ticks */}
        <div className="absolute bottom-0 left-0 right-0 h-3 flex">
          {hourMarks.map((m) => (
            <div
              key={m}
              className="border-l border-slate-300 flex-1"
              style={{ flexBasis: `${100 / 24}%` }}
            />
          ))}
        </div>
      </div>

      {/* hour labels */}
      <div className="relative mt-1 h-4 text-[9px] text-slate-400 select-none">
        {[0, 6, 12, 18, 24].map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2"
            style={{ left: pct(h * 60) }}
          >
            {pad2(h)}:00
          </span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [startRaw, setStartRaw] = useState('');
  const [endRaw, setEndRaw] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const startMin = parseMin(startRaw);
  const endMin = parseMin(endRaw);

  const resultKind: 'available' | 'unavailable' | 'error' | 'idle' =
    result === null
      ? 'idle'
      : result.kind === 'error'
        ? 'error'
        : result.kind;

  const handleCheck = () => {
    setResult(checkAvailability(startRaw, endRaw, blocked));
  };

  const handleReset = () => {
    setStartRaw('');
    setEndRaw('');
    setBlocked(false);
    setResult(null);
  };

  const quickFill = (s: number, e: number) => {
    setStartRaw(String(s));
    setEndRaw(String(e));
    setResult(null);
  };

  const quickOptions = useMemo(
    () => [
      { label: '11:00 – 12:00', s: 660, e: 720 },
      { label: '09:30 – 10:30', s: 570, e: 630 },
      { label: '13:00 – 15:00', s: 780, e: 900 },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm">
              <DoorClosed className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Smart Campus Room Availability Checker
              </h1>
              <p className="text-sm text-slate-500">
                Room <span className="font-semibold text-slate-700">B-204 · Engineering Block</span>
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Check whether a room is free for a requested time window. This tool
            only checks availability — it never creates or confirms a booking.
          </p>
        </header>

        {/* Demo data panel */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Demo Data
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-center gap-2 text-amber-700 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Now</span>
              </div>
              <div className="text-lg font-bold text-amber-900">
                {fmtTime(NOW)}
              </div>
              <div className="text-xs text-amber-700/80">{NOW} min</div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <CalendarClock className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Bookings</span>
              </div>
              <div className="text-sm font-bold text-slate-800">
                {EXISTING_BOOKINGS.map((b, i) => (
                  <div key={i}>{fmtRange(b[0], b[1])}</div>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                {EXISTING_BOOKINGS.map((b) => `(${b[0]}, ${b[1]})`).join(', ')}
              </div>
            </div>

            <div
              className={`rounded-xl border p-3 transition-colors ${
                blocked
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div
                  className={`flex items-center gap-2 ${
                    blocked ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {blocked ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Room Status
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={blocked}
                  onClick={() => {
                    setBlocked((v) => !v);
                    setResult(null);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                    blocked ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  aria-label="Toggle room blocked state"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      blocked ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <div
                className={`text-sm font-bold ${
                  blocked ? 'text-rose-900' : 'text-emerald-900'
                }`}
              >
                {blocked ? 'Blocked' : 'Open'}
              </div>
              <div className="text-xs text-slate-500">Tap to simulate</div>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Today's Timeline
          </h2>
          <Timeline
            start={startMin}
            end={endMin}
            blocked={blocked}
            resultKind={resultKind}
          />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-500" /> Now
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-slate-300 border border-slate-400" /> Existing booking
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-3 w-3 rounded ${
                  resultKind === 'available'
                    ? 'bg-emerald-400'
                    : resultKind === 'unavailable'
                      ? 'bg-rose-400'
                      : 'bg-sky-400'
                }`}
              /> Your request
            </span>
          </div>
        </section>

        {/* Input form */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Check a Time Window
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="start-input"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Start time
              </label>
              <div className="relative">
                <input
                  id="start-input"
                  type="number"
                  inputMode="numeric"
                  value={startRaw}
                  onChange={(e) => {
                    setStartRaw(e.target.value);
                    setResult(null);
                  }}
                  placeholder="e.g. 600"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  min
                </span>
              </div>
              {startMin !== null && (
                <p className="mt-1 text-xs text-slate-500">
                  {startMin >= 0 && startMin <= DAY_MIN ? (
                    <>
                      <span className="font-semibold text-slate-700">{startMin} min</span>{' '}
                      = {fmtTime(startMin)}
                    </>
                  ) : (
                    <span className="text-amber-600">
                      {startMin} min is outside 0–1439
                    </span>
                  )}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Minutes after midnight (0–1439)
              </p>
            </div>

            <div>
              <label
                htmlFor="end-input"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                End time
              </label>
              <div className="relative">
                <input
                  id="end-input"
                  type="number"
                  inputMode="numeric"
                  value={endRaw}
                  onChange={(e) => {
                    setEndRaw(e.target.value);
                    setResult(null);
                  }}
                  placeholder="e.g. 720"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  min
                </span>
              </div>
              {endMin !== null && (
                <p className="mt-1 text-xs text-slate-500">
                  {endMin >= 0 && endMin <= DAY_MIN ? (
                    <>
                      <span className="font-semibold text-slate-700">{endMin} min</span>{' '}
                      = {fmtTime(endMin)}
                    </>
                  ) : (
                    <span className="text-amber-600">
                      {endMin} min is outside 1–1440
                    </span>
                  )}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Minutes after midnight (1–1440)
              </p>
            </div>
          </div>

          {/* quick fill */}
          <div className="mt-4">
            <p className="text-[11px] text-slate-400 mb-2">Try an example:</p>
            <div className="flex flex-wrap gap-2">
              {quickOptions.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => quickFill(o.s, o.e)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* actions */}
          <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleCheck}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 active:scale-[0.99] transition"
            >
              Check Availability
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Result */}
        {result && (
          <section className="mb-6 animate-[fadeIn_0.2s_ease-out]">
            {result.kind === 'available' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-emerald-900">
                      Available
                    </h3>
                    <p className="text-sm text-emerald-800 mt-1">
                      The room is free for{' '}
                      <span className="font-semibold">
                        {fmtRange(startMin!, endMin!)}
                      </span>{' '}
                      ({endMin! - startMin!} min). No existing bookings overlap
                      this window.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {result.kind === 'unavailable' && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <div className="flex items-start gap-3">
                  <XCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-rose-900">
                      Unavailable
                    </h3>
                    <p className="text-sm text-rose-800 mt-1">{result.reason}</p>
                  </div>
                </div>
              </div>
            )}

            {result.kind === 'error' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  <div className="w-full">
                    <h3 className="text-base font-bold text-amber-900">
                      Please fix the following
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {result.reasons.map((r, i) => (
                        <li
                          key={i}
                          className="text-sm text-amber-800 flex items-start gap-2"
                        >
                          <span className="mt-0.5 text-amber-500">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Rules reference */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Timer className="h-3.5 w-3.5" /> Rules
          </h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• Start must be later than now ({fmtTime(NOW)}) and before end; within 0–1440.</li>
            <li>• Length must be 120 minutes or fewer (exactly 120 is allowed).</li>
            <li>• A blocked room is always unavailable.</li>
            <li>• Touching endpoints don't count as overlap (e.g. ends 11:00, starts 11:00 = OK).</li>
            <li>• This tool never creates or modifies bookings.</li>
          </ul>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-400">
          Interactive prototype · fictional data only
        </footer>
      </div>
    </div>
  );
}
