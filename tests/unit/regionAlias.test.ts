import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveRegionAlias, __resetRegionAliasWarnings } from '../../src/core/regionAlias';

describe('resolveRegionAlias', () => {
  beforeEach(() => {
    __resetRegionAliasWarnings();
    vi.restoreAllMocks();
  });

  it('passes canonical regions through unchanged', () => {
    expect(resolveRegionAlias('all')).toBe('all');
    expect(resolveRegionAlias('tamil-nadu')).toBe('tamil-nadu');
    expect(resolveRegionAlias('west-bengal')).toBe('west-bengal');
    expect(resolveRegionAlias('maharashtra')).toBe('maharashtra');
    expect(resolveRegionAlias('odisha')).toBe('odisha');
  });

  it('maps undefined → "all"', () => {
    expect(resolveRegionAlias(undefined)).toBe('all');
  });

  it('maps legacy "tamil" → "tamil-nadu" with a one-shot warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveRegionAlias('tamil')).toBe('tamil-nadu');
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0][0] as string;
    expect(msg).toContain("'tamil'");
    expect(msg).toContain("'tamil-nadu'");
    expect(msg).toMatch(/deprecated|v3/i);
  });

  it('maps legacy "bengal" → "west-bengal"', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveRegionAlias('bengal')).toBe('west-bengal');
  });

  it('maps legacy "north-india" → "all"', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveRegionAlias('north-india')).toBe('all');
  });

  it('warns only once per distinct legacy value across repeated calls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveRegionAlias('tamil');
    resolveRegionAlias('tamil');
    resolveRegionAlias('tamil');
    expect(warn).toHaveBeenCalledTimes(1);

    resolveRegionAlias('bengal');
    resolveRegionAlias('bengal');
    expect(warn).toHaveBeenCalledTimes(2); // one for tamil, one for bengal
  });

  it('__resetRegionAliasWarnings re-arms the one-shot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    resolveRegionAlias('tamil');
    expect(warn).toHaveBeenCalledTimes(1);
    __resetRegionAliasWarnings();
    resolveRegionAlias('tamil');
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
