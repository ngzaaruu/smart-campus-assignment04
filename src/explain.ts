// MOCK LLM explanation adapter — clearly labeled, no real API, no API keys.
// It only reads the authoritative checker Result (never changes it) and turns
// already-decided fields into a fixed sentence. Generated locally, no network.
import type { Result } from './availability';

export type ReasonCode =
  | 'AVAILABLE'
  | 'OVERLAP'
  | 'BLOCKED'
  | 'PAST_TIME'
  | 'INVALID_TIME'
  | 'TOO_LONG';

export interface ExplanationInput {
  readonly roomLabel: string;
  readonly start: number;
  readonly end: number;
  readonly isAvailable: boolean;
  readonly reasonCode: ReasonCode;
}

export interface ExplanationOptions {
  readonly apiKey?: string | null;
  readonly simulate?: 'timeout' | 'error' | 'missing-key';
  readonly timeoutMs?: number;
}

export interface Explanation {
  readonly explanation: string;
}

const MAX_EXPLANATION_LENGTH = 300;
const MAX_SENTENCES = 2;
const DEFAULT_TIMEOUT_MS = 3000;

const FALLBACK_EXPLANATION =
  'The explanation is currently unavailable, but the availability status above is authoritative.';

const MINUTES_IN_DAY = 1440;

export const mockFallbackExplanation = FALLBACK_EXPLANATION;

// Explain is offered only for a decided availability result. Error results
// (empty, reversed or out-of-range times, etc.) have nothing to explain:
// the user must fix the input first.
export function canExplain(result: Result): boolean {
  return result.kind === 'available' || result.kind === 'unavailable';
}

// Derives the reason code from an authoritative checker Result.
// This helper ONLY reads the result; the checker stays untouched.
export function deriveReasonCode(result: Result): {
  isAvailable: boolean;
  reasonCode: ReasonCode;
} | null {
  switch (result.kind) {
    case 'available':
      return { isAvailable: true, reasonCode: 'AVAILABLE' };
    case 'unavailable':
      if (/blocked/i.test(result.reason)) return { isAvailable: false, reasonCode: 'BLOCKED' };
      if (/overlap/i.test(result.reason)) return { isAvailable: false, reasonCode: 'OVERLAP' };
      return null;
    case 'error': {
      const reasons = result.reasons.join(' ');
      if (/later than the current time/i.test(reasons))
        return { isAvailable: false, reasonCode: 'PAST_TIME' };
      if (/booking length|maximum allowed/i.test(reasons))
        return { isAvailable: false, reasonCode: 'TOO_LONG' };
      if (
        /required|whole number|must be between|earlier than end/i.test(reasons)
      )
        return { isAvailable: false, reasonCode: 'INVALID_TIME' };
      return null;
    }
  }
}

const isValidRoomLabel = (label: string): boolean =>
  typeof label === 'string' && label.trim().length > 0 && label.length <= 200;

const isValidMinute = (n: number, allowZero: boolean): boolean =>
  typeof n === 'number' && Number.isInteger(n) && n >= (allowZero ? 0 : 1) && n <= MINUTES_IN_DAY;

// Local validation of the adapter input. Returns an error message or null.
export function validateExplanationInput(input: ExplanationInput): string | null {
  if (!input || typeof input !== 'object') return 'Input is required.';
  if (!isValidRoomLabel(input.roomLabel)) return 'Room label is empty or too long.';
  if (!isValidMinute(input.start, true)) return 'Start must be an integer between 0 and 1440.';
  if (!isValidMinute(input.end, false)) return 'End must be an integer between 1 and 1440.';
  if (input.start >= input.end) return 'Start must be earlier than end.';
  if (typeof input.isAvailable !== 'boolean') return 'isAvailable must be a boolean.';
  if (
    !['AVAILABLE', 'OVERLAP', 'BLOCKED', 'PAST_TIME', 'INVALID_TIME', 'TOO_LONG'].includes(
      input.reasonCode
    )
  )
    return 'Unknown reason code.';
  if (input.isAvailable !== (input.reasonCode === 'AVAILABLE'))
    return 'isAvailable and reasonCode disagree.';
  return null;
}

// Local validation of the mock output.
export function validateExplanationOutput(output: string, isAvailable: boolean): string | null {
  const text = output.trim();
  if (text.length === 0) return 'Explanation is empty.';
  if (text.length > MAX_EXPLANATION_LENGTH) return 'Explanation is too long.';
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  if (sentences.length > MAX_SENTENCES) return 'Explanation has too many sentences.';
  // The output must agree with the authoritative availability decision.
  if (isAvailable && /not available|unavailable/i.test(text))
    return 'Explanation contradicts the availability decision.';
  if (!isAvailable && /\bis available\b/i.test(text))
    return 'Explanation contradicts the availability decision.';
  return null;
}

// Deterministic mock generator: uses only the input fields.
function generateMockExplanation(input: ExplanationInput): string {
  const room = input.roomLabel.trim();
  switch (input.reasonCode) {
    case 'AVAILABLE':
      return `${room} is free for your requested window, so the time works.`;
    case 'OVERLAP':
      return `${room} already has a booking that overlaps your requested window.`;
    case 'BLOCKED':
      return `${room} is marked as blocked, so it cannot be used right now.`;
    case 'PAST_TIME':
      return `Your start time for ${room} is not later than the current time.`;
    case 'TOO_LONG':
      return `Your requested window for ${room} is longer than the maximum allowed length.`;
    case 'INVALID_TIME':
      return `The time window you entered for ${room} is invalid, so it cannot be checked.`;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock adapter resolving to { explanation } or the fixed fallback sentence.
export async function explainAvailability(
  input: ExplanationInput,
  options: ExplanationOptions = {}
): Promise<Explanation> {
  const inputError = validateExplanationInput(input);
  if (inputError) return { explanation: FALLBACK_EXPLANATION };

  const apiKey = options.simulate === 'missing-key' ? null : (options.apiKey ?? 'mock-key');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    if (options.simulate === 'missing-key' || !apiKey) {
      return { explanation: FALLBACK_EXPLANATION };
    }

    const timeoutPromise = new Promise<Explanation>((_, reject) => {
      setTimeout(() => reject(new Error('MOCK_TIMEOUT')), timeoutMs);
    });

    const workPromise = (async (): Promise<Explanation> => {
      if (options.simulate === 'timeout') await delay(timeoutMs + 100);
      if (options.simulate === 'error') throw new Error('MOCK_ERROR');
      const text = generateMockExplanation(input);
      const outputError = validateExplanationOutput(text, input.isAvailable);
      if (outputError) return { explanation: FALLBACK_EXPLANATION };
      return { explanation: text };
    })();

    return await Promise.race([workPromise, timeoutPromise]);
  } catch {
    return { explanation: FALLBACK_EXPLANATION };
  }
}
