import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeStorage } from '../safeStorage';

describe('safeStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(safeStorage.getItem('key')).toBeNull();
  });

  it('returns false when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(safeStorage.setItem('key', 'value')).toBe(false);
  });

  it('returns false when removeItem throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(safeStorage.removeItem('key')).toBe(false);
  });

  it('returns fallback values when localStorage getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked');
    });

    expect(safeStorage.getItem('key')).toBeNull();
    expect(safeStorage.setItem('key', 'value')).toBe(false);
    expect(safeStorage.removeItem('key')).toBe(false);
  });
});
