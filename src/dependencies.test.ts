// Risk R2: AGENTS.md forbids a database, so the project must not depend on
// @supabase/supabase-js. This test reads package.json directly and fails if
// the package reappears in either dependency map.
import { describe, it, expect } from 'vitest';
import pkg from '../package.json';

describe('dependency policy (R2: no database)', () => {
  it('does not depend on @supabase/supabase-js', () => {
    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    const allDeps = [...deps, ...devDeps];

    expect(
      allDeps,
      '@supabase/supabase-js must not be a dependency (AGENTS.md forbids a database)'
    ).not.toContain('@supabase/supabase-js');
  });
});
