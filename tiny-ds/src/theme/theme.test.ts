import { afterEach, describe, expect, it } from 'vitest'
import { getTheme, setTheme, toggleTheme } from './theme'

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('theme', () => {
  it('defaults to light without data-theme', () => {
    expect(getTheme()).toBe('light')
  })

  it('sets data-theme="dark" for dark mode', () => {
    setTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(getTheme()).toBe('dark')
  })

  it('removes data-theme for light mode', () => {
    setTheme('dark')
    setTheme('light')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(getTheme()).toBe('light')
  })

  it('toggles between light and dark', () => {
    expect(toggleTheme()).toBe('dark')
    expect(toggleTheme()).toBe('light')
  })
})
