import { useAppStore } from '../store'
import { useSystemPrefersDark } from '../components/terminal-pane/use-system-prefers-dark'

export type DocumentThemeVariant = 'light' | 'dark' | 'vesper-blur'

/**
 * Resolves the user's theme preference into the concrete variant currently
 * painted on the document — light, dark, or vesper-blur. Components that need
 * to pick a syntax theme (Monaco, markdown preview) consume this so they swap
 * reactively when the user changes the global theme.
 */
export function useDocumentTheme(): DocumentThemeVariant {
  const theme = useAppStore((state) => state.settings?.theme ?? 'system')
  const systemPrefersDark = useSystemPrefersDark()
  if (theme === 'vesper-blur') {
    return 'vesper-blur'
  }
  if (theme === 'light') {
    return 'light'
  }
  if (theme === 'dark') {
    return 'dark'
  }
  return systemPrefersDark ? 'dark' : 'light'
}
