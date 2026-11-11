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
  Users,
  Inbox,
} from 'lucide-react';

import {
  TIME_LIMITS,
  checkAvailability as checkRoomAvailability,
  fmtRange,
  fmtTime,
  pad2,
  parseMin,
  type Result,
} from './availability';
import { ROOMS, type Booking } from './data/rooms';
import { filterRooms } from './filters';

const { now: NOW, dayMinutes: DAY_MIN } = TIME_LIMITS;

const LEGACY_DEMO_ROOM = ROOMS.find((room) => room.id === 'b-204');

// Keep the original three-argument API used by existing consumers and tests.
// eslint-disable-next-line react-refresh/only-export-components
export function checkAvailability(startRaw: string, endRaw: string, blocked: boolean): Result {
  if (!LEGACY_DEMO_ROOM) throw new Error('Room b-204 is missing from ROOMS');
  return checkRoomAvailability(
    { startRaw, endRaw },
    { bookings: LEGACY_DEMO_ROOM.bookings, blocked }
  );
}

// Every equipment item that appears in the catalog, for the checkboxes.
const EQUIPMENT_OPTIONS: readonly string[] = [
  ...new Set(ROOMS.flatMap((r) => r.equipment)),
].sort();

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Attendees: a whole number, at least 1. Anything else => null.
const parseAttendees = (raw: string): number | null => {
  const n = parseMin(raw); // same whole-number parsing as the time fields
  return n !== null && n >= 1 ? n : null;
};

// All user inputs in one place, so one handler can update any of them.
interface FormState {
  startRaw: string;
  endRaw: string;
  attendeesRaw: string;
  equipment: readonly string[];
  roomId: string | null;
}

const EMPTY_FORM: FormState = {
  startRaw: '',
  endRaw: '',
  attendeesRaw: '1',
  equipment: [],
  roomId: null,
};

// ---- visual timeline ----
function Timeline({
  bookings,
  start,
  end,
  blocked,
  resultKind,
}: {
  bookings: readonly Booking[];
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
        {bookings.map((b, i) => {
          const widthPct = ((b.end - b.start) / DAY_MIN) * 100;
          const label = fmtRange(b.start, b.end);
          const fitsInside = widthPct > 22;
          return (
            <div key={i} className="absolute z-10" style={{ left: pct(b.start) }}>
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
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Becomes true on "Check Availability". While true, the result is recalculated
  // from the current inputs on every change, so it can never be stale (F5).
  const [checked, setChecked] = useState(false);

  // The one handler for every input change.
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const startMin = parseMin(form.startRaw);
  const endMin = parseMin(form.endRaw);
  const attendees = parseAttendees(form.attendeesRaw);

  // F1 + F2: only rooms that fit. Blocked rooms stay listed but can never be available (F3).
  const matchingRooms = useMemo(
    () =>
      attendees === null ? [] : filterRooms(ROOMS, { attendees, equipment: form.equipment }),
    [attendees, form.equipment]
  );

  // A selection that no longer passes the filters is dropped automatically.
  const selectedRoom = matchingRooms.find((r) => r.id === form.roomId) ?? null;

  const result: Result | null = useMemo(() => {
    if (!checked) return null;
    if (attendees === null) {
      return { kind: 'error', reasons: ['Attendees must be a whole number of at least 1.'] };
    }
    if (selectedRoom === null) {
      return { kind: 'error', reasons: ['Select a room from the list first.'] };
    }
    // Old time and overlap rules; a blocked room always returns "unavailable".
    return checkRoomAvailability(
      { startRaw: form.startRaw, endRaw: form.endRaw },
      selectedRoom
    );
  }, [checked, attendees, selectedRoom, form.startRaw, form.endRaw]);

  const resultKind: 'available' | 'unavailable' | 'error' | 'idle' =
    result === null ? 'idle' : result.kind;

  const toggleEquipment = (item: string) =>
    update({
      equipment: form.equipment.includes(item)
        ? form.equipment.filter((e) => e !== item)
        : [...form.equipment, item],
    });

  const handleCheck = () => setChecked(true);

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setChecked(false);
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
                Room{' '}
                <span className="font-semibold text-slate-700">
                  {selectedRoom ? selectedRoom.name : 'none selected'}
                </span>
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Find a room that fits your group, then check whether it is free for a
            requested time window. This tool only checks availability — it never
            creates or confirms a booking.
          </p>
        </header>

        {/* Room finder */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Find a Room
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="attendees-input"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Attendees
              </label>
              <div className="relative">
                <input
                  id="attendees-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.attendeesRaw}
                  onChange={(e) => update({ attendeesRaw: e.target.value })}
                  placeholder="e.g. 8"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  people
                </span>
              </div>
              {attendees === null && (
                <p className="mt-1 text-xs text-amber-600">
                  Enter a whole number of 1 or more.
                </p>
              )}
            </div>

            <fieldset>
              <legend className="block text-sm font-medium text-slate-700 mb-1">
                Required equipment
              </legend>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((item) => {
                  const on = form.equipment.includes(item);
                  return (
                    <label
                      key={item}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition ${
                        on
                          ? 'border-sky-300 bg-sky-50 text-sky-800'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleEquipment(item)}
                        className="h-4 w-4 accent-sky-600"
                      />
                      {capitalize(item)}
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Rooms must have all selected items.
              </p>
            </fieldset>
          </div>

          {/* matching rooms */}
          <div className="mt-5">
            {attendees === null ? null : matchingRooms.length === 0 ? (
              // F4: clear empty state
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                <Inbox className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  No rooms match your filters
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  No room seats {attendees} {attendees === 1 ? 'person' : 'people'}
                  {form.equipment.length > 0 &&
                    ` with ${form.equipment.map(capitalize).join(' + ')}`}
                  . Try fewer attendees or less equipment.
                </p>
                <button
                  type="button"
                  onClick={() => update({ attendeesRaw: '1', equipment: [] })}
                  className="mt-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-slate-400 mb-2">
                  {matchingRooms.length} of {ROOMS.length} rooms match. Select one:
                </p>
                <div
                  role="radiogroup"
                  aria-label="Matching rooms"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                >
                  {matchingRooms.map((room) => {
                    const selected = room.id === selectedRoom?.id;
                    return (
                      <label
                        key={room.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                          selected
                            ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/30'
                            : 'border-slate-200 bg-white hover:border-sky-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="room"
                          value={room.id}
                          checked={selected}
                          onChange={() => update({ roomId: room.id })}
                          className="mt-1 h-4 w-4 accent-sky-600"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">
                              {room.name}
                            </span>
                            {room.blocked && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                                Blocked
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <Users className="h-3.5 w-3.5" /> {room.capacity} seats
                            <span className="text-slate-300">·</span>
                            {room.equipment.length > 0
                              ? room.equipment.map(capitalize).join(', ')
                              : 'No equipment'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Selected room panel */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Selected Room
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
                {selectedRoom === null ? (
                  <span className="font-medium text-slate-400">Select a room</span>
                ) : selectedRoom.bookings.length === 0 ? (
                  <span className="font-medium text-slate-500">None today</span>
                ) : (
                  selectedRoom.bookings.map((b, i) => (
                    <div key={i}>{fmtRange(b.start, b.end)}</div>
                  ))
                )}
              </div>
              {selectedRoom !== null && selectedRoom.bookings.length > 0 && (
                <div className="text-xs text-slate-500">
                  {selectedRoom.bookings.map((b) => `(${b.start}, ${b.end})`).join(', ')}
                </div>
              )}
            </div>

            {selectedRoom === null ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <DoorClosed className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Room Status
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-400">Select a room</div>
              </div>
            ) : (
              <div
                className={`rounded-xl border p-3 transition-colors ${
                  selectedRoom.blocked
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div
                  className={`flex items-center gap-2 mb-1 ${
                    selectedRoom.blocked ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {selectedRoom.blocked ? (
                    <Ban className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Room Status
                  </span>
                </div>
                <div
                  className={`text-sm font-bold ${
                    selectedRoom.blocked ? 'text-rose-900' : 'text-emerald-900'
                  }`}
                >
                  {selectedRoom.blocked ? 'Blocked' : 'Open'}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedRoom.capacity} seats
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Today's Timeline
          </h2>
          <Timeline
            bookings={selectedRoom?.bookings ?? []}
            start={startMin}
            end={endMin}
            blocked={selectedRoom?.blocked ?? false}
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
                  value={form.startRaw}
                  onChange={(e) => update({ startRaw: e.target.value })}
                  placeholder="e.g. 600"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  min
                </span>
              </div>
              {startMin !== null && (
                <p className="mt-1 text-xs text-slate-500">
                  {startMin >= TIME_LIMITS.startMin && startMin <= TIME_LIMITS.startMax ? (
                    <>
                      <span className="font-semibold text-slate-700">{startMin} min</span>{' '}
                      = {fmtTime(startMin)}
                    </>
                  ) : (
                    <span className="text-amber-600">
                      {startMin} min is outside {TIME_LIMITS.startMin}–{TIME_LIMITS.startMax}
                    </span>
                  )}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Minutes after midnight ({TIME_LIMITS.startMin}–{TIME_LIMITS.startMax})
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
                  value={form.endRaw}
                  onChange={(e) => update({ endRaw: e.target.value })}
                  placeholder="e.g. 720"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none transition"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  min
                </span>
              </div>
              {endMin !== null && (
                <p className="mt-1 text-xs text-slate-500">
                  {endMin >= TIME_LIMITS.endMin && endMin <= TIME_LIMITS.endMax ? (
                    <>
                      <span className="font-semibold text-slate-700">{endMin} min</span>{' '}
                      = {fmtTime(endMin)}
                    </>
                  ) : (
                    <span className="text-amber-600">
                      {endMin} min is outside {TIME_LIMITS.endMin}–{TIME_LIMITS.endMax}
                    </span>
                  )}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Minutes after midnight ({TIME_LIMITS.endMin}–{TIME_LIMITS.endMax})
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
                  onClick={() => update({ startRaw: String(o.s), endRaw: String(o.e) })}
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
          <section className="mb-6 animate-[fadeIn_0.2s_ease-out]" aria-live="polite">
            {result.kind === 'available' &&
              selectedRoom !== null &&
              startMin !== null &&
              endMin !== null && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-bold text-emerald-900">
                        Available
                      </h3>
                      <p className="text-sm text-emerald-800 mt-1">
                        <span className="font-semibold">{selectedRoom.name}</span> is free
                        for{' '}
                        <span className="font-semibold">{fmtRange(startMin, endMin)}</span>{' '}
                        ({endMin - startMin} min). No existing bookings overlap this
                        window.
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
            <li>• Only rooms that seat all attendees and have all selected equipment are listed.</li>
            <li>
              • Start must be later than now ({fmtTime(NOW)}) and before end; start{' '}
              {TIME_LIMITS.startMin}–{TIME_LIMITS.startMax}, end {TIME_LIMITS.endMin}–
              {TIME_LIMITS.endMax}.
            </li>
            <li>
              • Length must be {TIME_LIMITS.maxDuration} minutes or fewer (exactly{' '}
              {TIME_LIMITS.maxDuration} is allowed).
            </li>
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