import { describe, expect, it } from 'vitest';
import { parseMin } from './availability';
import {
  MAX_TIME_INPUT_CHARS,
  rendersWithoutExponent,
  sanitizeTimeInput,
} from './inputFormat';

describe('sanitizeTimeInput: caps time fields at 4 digits', () => {
  it('passes through values within the limit unchanged', () => {
    expect(sanitizeTimeInput('600')).toBe('600');
    expect(sanitizeTimeInput('1439')).toBe('1439');
    expect(sanitizeTimeInput('')).toBe('');
    expect(sanitizeTimeInput('-99')).toBe('-99');
  });

  it('truncates overlong inputs to 4 characters', () => {
    expect(sanitizeTimeInput('0'.repeat(25))).toBe('0000');
    expect(sanitizeTimeInput('9'.repeat(24))).toBe('9999');
    expect(sanitizeTimeInput('1234567890')).toBe('1234');
    expect(sanitizeTimeInput('12345')).toHaveLength(MAX_TIME_INPUT_CHARS);
  });
});

describe('regression: helper text can never show scientific notation', () => {
  // Fails before the fix: the raw 24-nine input parsed to 1e+24 and
  // String(1e+24) === "1e+24", which leaked into the helper text.
  it('renders the parsed 24-nine input without an exponent', () => {
    const n = parseMin(sanitizeTimeInput('9'.repeat(24)));
    expect(n).not.toBeNull();
    expect(String(n)).not.toMatch(/e[+-]/i);
  });

  it('renders the parsed 25-zero input without an exponent', () => {
    const n = parseMin(sanitizeTimeInput('0'.repeat(25)));
    expect(n).not.toBeNull();
    expect(String(n)).not.toMatch(/e[+-]/i);
  });

  it('holds for arbitrary raw input', () => {
    const samples = [
      '9'.repeat(24),
      '0'.repeat(25),
      '12345678901234567890',
      '8'.repeat(30),
      '-'.concat('9'.repeat(20)),
      '600',
      '',
      'abc',
    ];
    for (const raw of samples) {
      expect(rendersWithoutExponent(raw)).toBe(true);
    }
  });
});
