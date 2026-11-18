import { describe, expect, it } from 'vitest';
import {
  canExplain,
  deriveReasonCode,
  explainAvailability,
  mockFallbackExplanation,
  validateExplanationInput,
  validateExplanationOutput,
  type ExplanationInput,
} from './explain';

const baseInput: ExplanationInput = {
  roomLabel: 'B-204 · Engineering Block',
  start: 660,
  end: 720,
  isAvailable: false,
  reasonCode: 'OVERLAP',
};

describe('deriveReasonCode: reads the authoritative Result only', () => {
  it('maps kind available to AVAILABLE', () => {
    expect(deriveReasonCode({ kind: 'available' })).toEqual({
      isAvailable: true,
      reasonCode: 'AVAILABLE',
    });
  });

  it('maps unavailable with overlap reason to OVERLAP', () => {
    expect(
      deriveReasonCode({
        kind: 'unavailable',
        reason: 'Overlaps an existing booking (10:00 AM – 11:00 AM).',
      })
    ).toEqual({ isAvailable: false, reasonCode: 'OVERLAP' });
  });

  it('maps unavailable with blocked reason to BLOCKED', () => {
    expect(
      deriveReasonCode({
        kind: 'unavailable',
        reason: 'This room is currently marked as blocked and cannot be booked.',
      })
    ).toEqual({ isAvailable: false, reasonCode: 'BLOCKED' });
  });

  it('maps each error group to PAST_TIME, TOO_LONG or INVALID_TIME', () => {
    expect(
      deriveReasonCode({
        kind: 'error',
        reasons: ['Start time must be later than the current time (9:00 AM).'],
      })
    ).toEqual({ isAvailable: false, reasonCode: 'PAST_TIME' });
    expect(
      deriveReasonCode({
        kind: 'error',
        reasons: ['Booking length is 121 minutes. Maximum allowed is 120 minutes.'],
      })
    ).toEqual({ isAvailable: false, reasonCode: 'TOO_LONG' });
    expect(
      deriveReasonCode({ kind: 'error', reasons: ['Start time is required.'] })
    ).toEqual({ isAvailable: false, reasonCode: 'INVALID_TIME' });
  });

  it('returns null for unknown reasons instead of guessing', () => {
    expect(deriveReasonCode({ kind: 'unavailable', reason: 'Something else happened.' })).toBeNull();
    expect(deriveReasonCode({ kind: 'error', reasons: ['Unknown failure.'] })).toBeNull();
  });
});

describe('canExplain: only decided results are explainable', () => {
  it('allows explaining available and unavailable results', () => {
    expect(canExplain({ kind: 'available' })).toBe(true);
    expect(
      canExplain({
        kind: 'unavailable',
        reason: 'This room is currently marked as blocked and cannot be booked.',
      })
    ).toBe(true);
  });

  it('forbids explaining error results (validation problems)', () => {
    expect(canExplain({ kind: 'error', reasons: ['Start time is required.'] })).toBe(false);
    expect(
      canExplain({ kind: 'error', reasons: ['Start time must be earlier than end time.'] })
    ).toBe(false);
    expect(
      canExplain({ kind: 'error', reasons: ['Start time must be between 0 and 1439.'] })
    ).toBe(false);
    expect(
      canExplain({ kind: 'error', reasons: ['Attendees must be a whole number of at least 1.'] })
    ).toBe(false);
  });
});

describe('validateExplanationInput', () => {
  it('accepts a valid input', () => {
    expect(validateExplanationInput(baseInput)).toBeNull();
  });

  it('rejects empty, malformed or too long room labels', () => {
    expect(validateExplanationInput({ ...baseInput, roomLabel: '' })).toMatch(/room label/i);
    expect(validateExplanationInput({ ...baseInput, roomLabel: '   ' })).toMatch(/room label/i);
    expect(validateExplanationInput({ ...baseInput, roomLabel: 'x'.repeat(201) })).toMatch(
      /room label/i
    );
  });

  it('rejects non-integer or out-of-range times', () => {
    expect(validateExplanationInput({ ...baseInput, start: 660.5 })).toMatch(/start/i);
    expect(validateExplanationInput({ ...baseInput, end: -5 })).toMatch(/end/i);
    expect(validateExplanationInput({ ...baseInput, start: 1441 })).toMatch(/start/i);
    expect(validateExplanationInput({ ...baseInput, end: 0 })).toMatch(/end/i);
  });

  it('rejects start >= end and disagreeing fields', () => {
    expect(validateExplanationInput({ ...baseInput, start: 720, end: 660 })).toMatch(/earlier/i);
    expect(validateExplanationInput({ ...baseInput, start: 700, end: 700 })).toMatch(/earlier/i);
    expect(
      validateExplanationInput({ ...baseInput, isAvailable: true })
    ).toMatch(/disagree/i);
    expect(
      validateExplanationInput({ ...baseInput, reasonCode: 'AVAILABLE' as never })
    ).toMatch(/disagree/i);
  });

  it('rejects unknown reason codes and non-boolean isAvailable', () => {
    expect(
      validateExplanationInput({ ...baseInput, reasonCode: 'NOT_A_CODE' as never })
    ).toMatch(/reason code/i);
    expect(
      validateExplanationInput({ ...baseInput, isAvailable: 'yes' as never })
    ).toMatch(/boolean/i);
  });
});

describe('validateExplanationOutput', () => {
  it('accepts a short valid explanation', () => {
    expect(
      validateExplanationOutput('B-204 is free for your requested window, so the time works.', true)
    ).toBeNull();
  });

  it('rejects empty or overlong explanations', () => {
    expect(validateExplanationOutput('   ', true)).toMatch(/empty/i);
    expect(validateExplanationOutput('x'.repeat(301), true)).toMatch(/too long/i);
  });

  it('rejects more than 2 sentences', () => {
    const three = 'One sentence here. Two sentences here. Three sentences here.';
    expect(validateExplanationOutput(three, true)).toMatch(/too many sentences/i);
  });

  it('rejects explanations contradicting isAvailable', () => {
    expect(validateExplanationOutput('The room is not available today.', true)).toMatch(
      /contradict/i
    );
    expect(validateExplanationOutput('The room is available today.', false)).toMatch(
      /contradict/i
    );
  });
});

describe('explainAvailability (mock adapter)', () => {
  it('generates an explanation from the input fields only', async () => {
    const out = await explainAvailability(baseInput);
    expect(out.explanation).toContain('B-204 · Engineering Block');
    expect(out.explanation.length).toBeLessThanOrEqual(300);
  });

  it('covers every reason code with a 2-sentence, 300-char output', async () => {
    const codes = [
      { reasonCode: 'AVAILABLE' as const, isAvailable: true },
      { reasonCode: 'OVERLAP' as const, isAvailable: false },
      { reasonCode: 'BLOCKED' as const, isAvailable: false },
      { reasonCode: 'PAST_TIME' as const, isAvailable: false },
      { reasonCode: 'TOO_LONG' as const, isAvailable: false },
      { reasonCode: 'INVALID_TIME' as const, isAvailable: false },
    ];
    for (const c of codes) {
      const input: ExplanationInput = { ...baseInput, ...c };
      const out = await explainAvailability(input);
      expect(out.explanation.length).toBeLessThanOrEqual(300);
      const sentences = out.explanation.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
      expect(sentences.length).toBeLessThanOrEqual(2);
      expect(validateExplanationOutput(out.explanation, input.isAvailable)).toBeNull();
    }
  });

  it('returns the fixed fallback for invalid input', async () => {
    const out = await explainAvailability({ ...baseInput, start: 700, end: 600 });
    expect(out.explanation).toBe(mockFallbackExplanation);
  });

  it('returns the fixed fallback on simulated error', async () => {
    const out = await explainAvailability(baseInput, { simulate: 'error' });
    expect(out.explanation).toBe(mockFallbackExplanation);
  });

  it('returns the fixed fallback on missing key', async () => {
    const out = await explainAvailability(baseInput, { simulate: 'missing-key' });
    expect(out.explanation).toBe(mockFallbackExplanation);
  });

  it('times out after 3 seconds and falls back', async () => {
    const start = Date.now();
    const out = await explainAvailability(baseInput, {
      simulate: 'timeout',
      timeoutMs: 3000,
    });
    const elapsed = Date.now() - start;
    expect(out.explanation).toBe(mockFallbackExplanation);
    expect(elapsed).toBeGreaterThanOrEqual(3000);
    expect(elapsed).toBeLessThan(4000);
  });
});
