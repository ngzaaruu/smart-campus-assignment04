// UI-layer input rules for the time fields. Pure helpers, no React.
// The checker (availability.ts) is untouched: it keeps accepting any
// integer string, but the form never sends one longer than the cap.
import { parseMin } from './availability';

// At most 4 digits keeps parsed minutes within -9999..9999, so plain
// string interpolation in the helper text can never render scientific
// notation (e.g. "1e+24 min").
export const MAX_TIME_INPUT_CHARS = 4;

export const sanitizeTimeInput = (raw: string): string => raw.slice(0, MAX_TIME_INPUT_CHARS);

// True if the value is safe to show via plain string interpolation.
export const rendersWithoutExponent = (raw: string): boolean => {
  const n = parseMin(sanitizeTimeInput(raw));
  return n === null || !String(n).includes('e');
};
