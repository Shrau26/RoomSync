import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

// Apply theme immediately before first render to prevent flash
const savedTheme = localStorage.getItem('rs_theme');
const isDark = savedTheme !== 'light';
document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    localStorage.setItem('rs_theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
