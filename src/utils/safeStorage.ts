function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    const storage = getStorage();
    if (!storage) return false;

    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  removeItem(key: string): boolean {
    const storage = getStorage();
    if (!storage) return false;

    try {
      storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
