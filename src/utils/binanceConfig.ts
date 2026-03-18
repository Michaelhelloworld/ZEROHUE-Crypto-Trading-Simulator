import { safeStorage } from './safeStorage';

interface BinanceConfig {
  restBaseUrl: string;
  wsBaseUrl: string;
  region: 'US' | 'GLOBAL';
}

const CONFIG_US: BinanceConfig = {
  restBaseUrl: 'https://api.binance.us',
  wsBaseUrl: 'wss://stream.binance.us:9443',
  region: 'US',
};

const CONFIG_GLOBAL: BinanceConfig = {
  restBaseUrl: 'https://api.binance.com',
  wsBaseUrl: 'wss://stream.binance.com:9443',
  region: 'GLOBAL',
};

const CACHE_KEY = 'zerohue_binance_region';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT = 3000; // 3 seconds

/** Wraps a fetch call with a timeout to prevent hanging on unreachable services. */
const fetchWithTimeout = async (url: string, timeout: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

/** Reads cached region from localStorage if still valid. */
const getCachedRegion = (): 'US' | 'GLOBAL' | null => {
  try {
    const raw = safeStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.region;
    }
  } catch {
    /* ignore */
  }
  return null;
};

/** Saves detected region to localStorage. */
const setCachedRegion = (region: 'US' | 'GLOBAL') => {
  safeStorage.setItem(CACHE_KEY, JSON.stringify({ region, timestamp: Date.now() }));
};

/** Clears cached region so next lookup re-runs full detection. */
export const clearBinanceRegionCache = () => {
  safeStorage.removeItem(CACHE_KEY);
};

export const getBinanceConfig = async (): Promise<BinanceConfig> => {
  // 1. Check cache first to avoid unnecessary network requests
  const cached = getCachedRegion();
  if (cached) {
    return cached === 'US' ? CONFIG_US : CONFIG_GLOBAL;
  }

  // 2. Try IP Location (primary)
  try {
    const res = await fetchWithTimeout('https://api.country.is/', FETCH_TIMEOUT);
    if (res.ok) {
      const data = await res.json();
      const region = data.country === 'US' ? 'US' : 'GLOBAL';
      setCachedRegion(region);
      return region === 'US' ? CONFIG_US : CONFIG_GLOBAL;
    }
  } catch (error) {
    console.warn('Primary IP detection failed (country.is)', error);
  }

  // 3. Backup: Try alternative IP service (ipwho.is)
  try {
    const res = await fetchWithTimeout('https://ipwho.is/', FETCH_TIMEOUT);
    if (res.ok) {
      const data = await res.json();
      const region = data.country_code === 'US' ? 'US' : 'GLOBAL';
      setCachedRegion(region);
      return region === 'US' ? CONFIG_US : CONFIG_GLOBAL;
    }
  } catch (error) {
    console.warn('Backup IP detection failed (ipwho.is)', error);
  }

  // 4. Fallback: Timezone Check
  // Covers all US time zones including Alaska, Hawaii, Arizona, Indiana, etc.
  const US_TIMEZONES = new Set([
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'America/Adak',
    'America/Juneau',
    'America/Nome',
    'America/Sitka',
    'America/Yakutat',
    'Pacific/Honolulu',
    'America/Indiana/Indianapolis',
    'America/Indiana/Knox',
    'America/Indiana/Marengo',
    'America/Indiana/Petersburg',
    'America/Indiana/Tell_City',
    'America/Indiana/Vevay',
    'America/Indiana/Vincennes',
    'America/Indiana/Winamac',
    'America/Kentucky/Louisville',
    'America/Kentucky/Monticello',
    'America/North_Dakota/Beulah',
    'America/North_Dakota/Center',
    'America/North_Dakota/New_Salem',
    'America/Detroit',
    'America/Boise',
    'America/Menominee',
  ]);
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (US_TIMEZONES.has(timeZone)) {
      setCachedRegion('US');
      return CONFIG_US;
    }
  } catch (error) {
    console.warn('Timezone detection failed', error);
  }

  // Default to Global
  setCachedRegion('GLOBAL');
  return CONFIG_GLOBAL;
};

// EOF
