// Pure availability rules (AC1–AC4). No React, no side effects:
// the room passed in is only read, never changed (AC5).
import type { Room } from './data/rooms';

// Single source of truth for every time limit used by the rules and the UI.
export const TIME_LIMITS = {
  now: 540, // fixed current time: 09:00
  dayMinutes: 1440,
  startMin: 0,
  startMax: 1439,
  endMin: 1,
  endMax: 1440,
  maxDuration: 120,
} as const;

export interface TimeInput {
  readonly startRaw: string;
  readonly endRaw: string;
}

// Only the parts of a room that the time rules need.
export type RoomAvailabilityData = Pick<Room, 'bookings' | 'blocked'>;

export type Result =
  | { kind: 'available' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'error'; reasons: string[] };

// ---- helpers ----
export const pad2 = (n: number) => n.toString().padStart(2, '0');

export const fmtTime = (m: number): string => {
  const day = TIME_LIMITS.dayMinutes;
  const mm = ((m % day) + day) % day;
  const h = Math.floor(mm / 60);
  const min = mm % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(min)} ${period}`;
};

export const fmtRange = (s: number, e: number) => `${fmtTime(s)} – ${fmtTime(e)}`;

// Touching at an endpoint is NOT overlap.
export const intervalsOverlap = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean => aStart < bEnd && bStart < aEnd;

// Parse a text field into an integer or null (non-integer / empty => null)
export const parseMin = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^-?\d+$/.test(trimmed)) return null; // non-integer (decimals, letters)
  return Number(trimmed);
};

// ---- core availability logic ----
export function checkAvailability(input: TimeInput, room: RoomAvailabilityData): Result {
  const { startRaw, endRaw } = input;
  const L = TIME_LIMITS;
  const errors: string[] = [];

  if (startRaw.trim() === '') errors.push('Start time is required.');
  if (endRaw.trim() === '') errors.push('End time is required.');

  if (errors.length) return { kind: 'error', reasons: errors };

  const start = parseMin(startRaw);
  const end = parseMin(endRaw);

  if (start === null) errors.push('Start time must be a whole number (minutes after midnight).');
  if (end === null) errors.push('End time must be a whole number (minutes after midnight).');

  if (start === null || end === null) return { kind: 'error', reasons: errors };

  // AC1: valid range
  if (start < L.startMin || start > L.startMax)
    errors.push(`Start time must be between ${L.startMin} and ${L.startMax}.`);
  if (end < L.endMin || end > L.endMax)
    errors.push(`End time must be between ${L.endMin} and ${L.endMax}.`);
  if (errors.length) return { kind: 'error', reasons: errors };

  if (start >= end) {
    return { kind: 'error', reasons: ['Start time must be earlier than end time.'] };
  }

  // AC1: start must be strictly later than now
  if (start <= L.now) {
    return {
      kind: 'error',
      reasons: [`Start time must be later than the current time (${fmtTime(L.now)}).`],
    };
  }

  // AC2: duration <= maxDuration
  const duration = end - start;
  if (duration > L.maxDuration) {
    return {
      kind: 'error',
      reasons: [
        `Booking length is ${duration} minutes. Maximum allowed is ${L.maxDuration} minutes.`,
      ],
    };
  }

  // AC3 / F3: blocked room is always unavailable
  if (room.blocked) {
    return {
      kind: 'unavailable',
      reason: 'This room is currently marked as blocked and cannot be booked.',
    };
  }

  // AC4: reject overlap (touching endpoints allowed)
  for (const b of room.bookings) {
    if (intervalsOverlap(start, end, b.start, b.end)) {
      return {
        kind: 'unavailable',
        reason: `Overlaps an existing booking (${fmtRange(b.start, b.end)}).`,
      };
    }
  }

  // AC5: only reads the room; nothing is created or changed
  return { kind: 'available' };
}