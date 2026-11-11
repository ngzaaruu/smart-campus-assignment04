import { describe, expect, it } from 'vitest';
import { checkAvailability, TIME_LIMITS } from './availability';
import { ROOMS, type Room } from './data/rooms';
import { filterRooms, hasAllEquipment, meetsCapacity } from './filters';

// Look rooms up by id so a test fails clearly if the catalog changes.
const room = (id: string): Room => {
  const r = ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`Room ${id} is missing from ROOMS`);
  return r;
};

const B204 = room('b-204'); // projector + whiteboard, booked 10:00–11:00 (600–660)
const A301 = room('a-301'); // projector, free 10:00–11:00
const C110 = room('c-110'); // capacity exactly 8, no bookings
const B105 = room('b-105'); // blocked

const check = (start: string, end: string, r: Room) =>
  checkAvailability({ startRaw: start, endRaw: end }, r);

describe('fixed demo time', () => {
  it('NOW is 540 (09:00)', () => {
    expect(TIME_LIMITS.now).toBe(540);
  });
});

describe('checkAvailability: time rules (AC1, AC2)', () => {
  it('rejects an empty start time', () => {
    expect(check('', '600', C110)).toEqual({
      kind: 'error',
      reasons: ['Start time is required.'],
    });
    expect(check('   ', '600', C110)).toEqual({
      kind: 'error',
      reasons: ['Start time is required.'],
    });
  });

  it('rejects a start time at or before now (540)', () => {
    const notLater = {
      kind: 'error',
      reasons: ['Start time must be later than the current time (9:00 AM).'],
    };
    expect(check('540', '600', C110)).toEqual(notLater);
    expect(check('539', '600', C110)).toEqual(notLater);
  });

  it('accepts 700–820 (exactly 120 minutes)', () => {
    expect(check('700', '820', C110)).toEqual({ kind: 'available' });
  });

  it('rejects 700–821 (121 minutes)', () => {
    expect(check('700', '821', C110)).toEqual({
      kind: 'error',
      reasons: ['Booking length is 121 minutes. Maximum allowed is 120 minutes.'],
    });
  });
});

describe('checkAvailability: room rules (AC3, AC4, F3)', () => {
  it('never marks a blocked room as available', () => {
    const blocked = {
      kind: 'unavailable',
      reason: 'This room is currently marked as blocked and cannot be booked.',
    };
    // Windows that would be free in an open room
    expect(check('700', '760', B105)).toEqual(blocked);
    expect(check('541', '600', B105)).toEqual(blocked);
    expect(check('660', '720', B105)).toEqual(blocked);
  });

  it('accepts 660–720 in B-204 (touches the 600–660 booking, no overlap)', () => {
    expect(check('660', '720', B204)).toEqual({ kind: 'available' });
  });

  it('rejects 630–690 in B-204 (overlaps the 600–660 booking)', () => {
    expect(check('630', '690', B204)).toEqual({
      kind: 'unavailable',
      reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
    });
  });
});

describe('booking data is read-only in practice (AC5)', () => {
  it('leaves every room and its bookings unchanged after checks and filtering', () => {
    const before = structuredClone(ROOMS);

    for (const r of ROOMS) {
      check('630', '690', r);
      check('660', '720', r);
      check('700', '821', r);
      check('', '', r);
    }
    filterRooms(ROOMS, { attendees: 8, equipment: ['projector'] });
    filterRooms(ROOMS, { attendees: 999, equipment: [] });

    expect(ROOMS).toEqual(before);
    expect(B204.bookings).toEqual([{ start: 600, end: 660 }]);
  });
});

describe('filters (F1, F2)', () => {
  it('accepts capacity 8 with 8 people', () => {
    expect(C110.capacity).toBe(8);
    expect(meetsCapacity(C110, 8)).toBe(true);
  });

  it('rejects capacity 8 with 9 people', () => {
    expect(meetsCapacity(C110, 9)).toBe(false);
  });

  it('requires ALL selected equipment, not just one item', () => {
    expect(hasAllEquipment(B204, ['projector', 'whiteboard'])).toBe(true);
    expect(hasAllEquipment(A301, ['projector'])).toBe(true);
    expect(hasAllEquipment(A301, ['projector', 'whiteboard'])).toBe(false);
    expect(hasAllEquipment(A301, [])).toBe(true); // nothing required

    const ids = filterRooms(ROOMS, { attendees: 1, equipment: ['projector', 'whiteboard'] }).map(
      (r) => r.id
    );
    expect(ids).toEqual(['b-204']);
  });

  it('returns [] when no room matches', () => {
    expect(filterRooms(ROOMS, { attendees: 41, equipment: [] })).toEqual([]);
    expect(filterRooms(ROOMS, { attendees: 1, equipment: ['speaker'] })).toEqual([]);
    expect(filterRooms(ROOMS, { attendees: 13, equipment: ['projector', 'whiteboard'] })).toEqual(
      []
    );
  });
});

describe('integration: filter, then check', () => {
  it('600–660 is available in the free projector room but not in B-204', () => {
    const projectorRooms = filterRooms(ROOMS, { attendees: 10, equipment: ['projector'] });
    expect(projectorRooms.map((r) => r.id)).toEqual(['b-204', 'a-301']);

    const results = Object.fromEntries(
      projectorRooms.map((r) => [r.id, check('600', '660', r)])
    );

    expect(results['a-301']).toEqual({ kind: 'available' });
    expect(results['b-204']).toEqual({
      kind: 'unavailable',
      reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
    });
  });
});