import { describe, expect, it } from 'vitest';
import { checkAvailability } from './App';

describe('checkAvailability (current behavior baseline)', () => {
  it('rejects a start time that is not later than now (09:00)', () => {
    expect(checkAvailability('540', '600', false)).toEqual({
      kind: 'error',
      reasons: ['Start time must be later than the current time (9:00 AM).'],
    });
    expect(checkAvailability('300', '400', false)).toEqual({
      kind: 'error',
      reasons: ['Start time must be later than the current time (9:00 AM).'],
    });
  });

  it('rejects a reversed interval and an empty interval', () => {
    expect(checkAvailability('700', '650', false)).toEqual({
      kind: 'error',
      reasons: ['Start time must be earlier than end time.'],
    });
    expect(checkAvailability('700', '700', false)).toEqual({
      kind: 'error',
      reasons: ['Start time must be earlier than end time.'],
    });
  });

  it('rejects a 121-minute booking', () => {
    expect(checkAvailability('720', '841', false)).toEqual({
      kind: 'error',
      reasons: ['Booking length is 121 minutes. Maximum allowed is 120 minutes.'],
    });
  });

  it('allows a 120-minute booking at the maximum length', () => {
    expect(checkAvailability('720', '840', false)).toEqual({ kind: 'available' });
  });

  it('marks a blocked room unavailable even for a valid free window', () => {
    expect(checkAvailability('720', '780', true)).toEqual({
      kind: 'unavailable',
      reason: 'This room is currently marked as blocked and cannot be booked.',
    });
  });

  it('rejects a window overlapping the existing 10:00-11:00 booking', () => {
    expect(checkAvailability('630', '690', false)).toEqual({
      kind: 'unavailable',
      reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
    });
    expect(checkAvailability('570', '630', false)).toEqual({
      kind: 'unavailable',
      reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
    });
  });

  it('allows windows that only touch the existing booking endpoints', () => {
    expect(checkAvailability('660', '720', false)).toEqual({ kind: 'available' });
    expect(checkAvailability('570', '600', false)).toEqual({ kind: 'available' });
  });

  it('allows a start one minute after now (strict later-than boundary)', () => {
    expect(checkAvailability('541', '600', false)).toEqual({ kind: 'available' });
  });

  it('rejects a window that fully contains the existing booking', () => {
    expect(checkAvailability('600', '660', false)).toEqual({
      kind: 'unavailable',
      reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
    });
    expect(checkAvailability('610', '650', false)).toEqual({
      kind: 'unavailable',
      reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
    });
  });

  it('rejects a one-minute overlap at each existing booking edge', () => {
    expect(checkAvailability('659', '700', false)).toEqual({
      kind: 'unavailable',
      reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
    });
    expect(checkAvailability('590', '601', false)).toEqual({
      kind: 'unavailable',
      reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
    });
  });

  it('does not change results across repeated calls (fixtures not mutated)', () => {
    const overlap = () => checkAvailability('630', '690', false);
    const free = () => checkAvailability('720', '780', false);

    const firstOverlap = overlap();
    const firstFree = free();

    checkAvailability('720', '780', true);
    checkAvailability('700', '650', false);
    checkAvailability('720', '841', false);
    checkAvailability('540', '600', false);

    expect(overlap()).toEqual(firstOverlap);
    expect(free()).toEqual(firstFree);
    expect(free()).toEqual({ kind: 'available' });
  });
});
