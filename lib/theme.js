/**
 * Light/dark theme. The choice lives on <html data-theme>, set before first
 * paint by THEME_BOOT (inlined in the root layout) so a stored preference never
 * flashes the wrong theme. With nothing stored, the OS preference decides.
 *
 * Storage can throw (privacy modes, blocked site data), so every access is
 * guarded: the worst case is a theme that isn't remembered, never a crash.
 */

export const THEME_KEY = 'devdeck-theme';

// Kept as a string: it runs in <head> before React, so it cannot import anything.
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export function readTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* unremembered, still applied */
  }
}

export function toggleTheme() {
  setTheme(readTheme() === 'light' ? 'dark' : 'light');
}

/** useSyncExternalStore subscriber: any change to data-theme, from anywhere. */
export function subscribeTheme(listener) {
  if (typeof MutationObserver === 'undefined') return () => {};
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
