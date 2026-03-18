import { useCallback } from 'react';

type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export const useHaptic = () => {
  const trigger = useCallback((type: HapticType = 'light') => {
    if (typeof window === 'undefined' || !window.navigator?.vibrate) return;

    try {
      switch (type) {
        case 'light':
          window.navigator.vibrate(10); // Subtle tick
          break;
        case 'medium':
          window.navigator.vibrate(20); // Noticeable tap
          break;
        case 'heavy':
          window.navigator.vibrate(40); // Strong feedback
          break;
        case 'selection':
          window.navigator.vibrate(15); // Similar to iOS implementation selection
          break;
        case 'success':
          window.navigator.vibrate([10, 30, 10]); // Short-Long-Short
          break;
        case 'warning':
          window.navigator.vibrate([30, 50, 10]); // Heavy-Pause-Tick
          break;
        case 'error':
          window.navigator.vibrate([50, 50, 50, 50]); // Buzz-Buzz
          break;
      }
    } catch (_e) {
      // Ignore haptic errors on unsupported devices
    }
  }, []);

  return { trigger };
};
