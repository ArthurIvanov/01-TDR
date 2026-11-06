export type Theme = 'light' | 'dark'

const THEME_ATTR = 'data-theme'

export function getTheme(): Theme {
  const value = document.documentElement.getAttribute(THEME_ATTR)
  return value === 'dark' ? 'dark' : 'light'
}

/** Matches 01-TDR-variables-export: light = :root defaults, dark = [data-theme="dark"]. */
export function setTheme(theme: Theme): void {
  if (theme === 'light') {
    document.documentElement.removeAttribute(THEME_ATTR)
    return
  }
  document.documentElement.setAttribute(THEME_ATTR, 'dark')
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
