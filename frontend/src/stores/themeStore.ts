import { create } from 'zustand'

type Theme = 'dark' | 'light'

function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem('worksync_theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  return null
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const initial = getStoredTheme() || getSystemTheme()
applyTheme(initial)

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initial,
  setTheme: (theme: Theme) => {
    applyTheme(theme)
    try { localStorage.setItem('worksync_theme', theme) } catch {}
    set({ theme })
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))
