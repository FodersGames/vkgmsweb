import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'https://vakargames.vercel.app';
const CACHE_TTL_MS = 10 * 1000; // 10 seconds cache for rapid maintenance/announcement responsiveness

let settingsCache = null;
let settingsCacheTime = 0;
let settingsPromise = null;

export const getWebsiteSettings = async () => {
  const now = Date.now();
  if (settingsCache && (now - settingsCacheTime < CACHE_TTL_MS)) {
    return settingsCache;
  }
  if (!settingsPromise) {
    settingsPromise = axios.get(`${API_URL}/api/website/settings`)
      .then((r) => {
        settingsCache = r.data || {};
        settingsCacheTime = Date.now();
        settingsPromise = null;
        return settingsCache;
      })
      .catch((err) => {
        settingsPromise = null;
        throw err;
      });
  }
  return settingsPromise;
};

export const clearWebsiteSettingsCache = () => {
  settingsCache = null;
  settingsCacheTime = 0;
  settingsPromise = null;
};

let gamesCache = null;
let gamesCacheTime = 0;
let gamesPromise = null;

export const getPublicGames = async () => {
  const now = Date.now();
  if (gamesCache && (now - gamesCacheTime < CACHE_TTL_MS)) {
    return gamesCache;
  }
  if (!gamesPromise) {
    gamesPromise = axios.get(`${API_URL}/api/website/games/public`)
      .then((r) => {
        gamesCache = r.data?.games || [];
        gamesCacheTime = Date.now();
        gamesPromise = null;
        return gamesCache;
      })
      .catch((err) => {
        gamesPromise = null;
        throw err;
      });
  }
  return gamesPromise;
};

export const clearPublicGamesCache = () => {
  gamesCache = null;
  gamesCacheTime = 0;
  gamesPromise = null;
};

