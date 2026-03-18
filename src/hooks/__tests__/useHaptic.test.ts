import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHaptic } from '../useHaptic';

describe('useHaptic', () => {
  let mockVibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockVibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });
  });

  it('should trigger light haptic with correct duration', () => {
    const { result } = renderHook(() => useHaptic());

    act(() => {
      result.current.trigger('light');
    });

    expect(mockVibrate).toHaveBeenCalledWith(10);
  });

  it('should trigger medium haptic with correct duration', () => {
    const { result } = renderHook(() => useHaptic());

    act(() => {
      result.current.trigger('medium');
    });

    expect(mockVibrate).toHaveBeenCalledWith(20);
  });

  it('should trigger heavy haptic with correct duration', () => {
    const { result } = renderHook(() => useHaptic());

    act(() => {
      result.current.trigger('heavy');
    });

    expect(mockVibrate).toHaveBeenCalledWith(40);
  });

  it('should trigger success pattern (Short-Long-Short)', () => {
    const { result } = renderHook(() => useHaptic());

    act(() => {
      result.current.trigger('success');
    });

    expect(mockVibrate).toHaveBeenCalledWith([10, 30, 10]);
  });

  it('should trigger warning pattern', () => {
    const { result } = renderHook(() => useHaptic());

    act(() => {
      result.current.trigger('warning');
    });

    expect(mockVibrate).toHaveBeenCalledWith([30, 50, 10]);
  });

  it('should trigger error pattern (Buzz-Buzz)', () => {
    const { result } = renderHook(() => useHaptic());

    act(() => {
      result.current.trigger('error');
    });

    expect(mockVibrate).toHaveBeenCalledWith([50, 50, 50, 50]);
  });

  it('should default to light when no type is specified', () => {
    const { result } = renderHook(() => useHaptic());

    act(() => {
      result.current.trigger();
    });

    expect(mockVibrate).toHaveBeenCalledWith(10);
  });

  it('should not crash when vibrate is not supported', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useHaptic());

    expect(() => {
      act(() => {
        result.current.trigger('heavy');
      });
    }).not.toThrow();
  });
});
