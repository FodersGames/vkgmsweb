import React, { createContext, useContext, useState } from 'react';

const STORAGE_KEY = 'vg_admin_theme';

const ThemeContext = createContext({ isDark: false, toggleTheme: () => {} });

// Dark mode is scoped to the admin dashboard only — the public site stays
// Apple-light. Toggling adds/removes the literal "dark" class on the
// dashboard's own root element (Tailwind darkMode: "class"), it never
// touches <html>/<body>, so nothing outside /dashboard is affected.
export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'dark'; }
    catch { return false; }
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
