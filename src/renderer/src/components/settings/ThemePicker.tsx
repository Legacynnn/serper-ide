import { useEffect, useRef, useState, type JSX } from 'react'
import { RotateCw } from 'lucide-react'
import type { GlobalSettings } from '../../../../shared/types'
import { Button } from '../ui/button'
import { SearchableSetting } from './SearchableSetting'
import { isLinuxUserAgent } from '../terminal-pane/pane-helpers'

const ALL_THEME_OPTIONS = ['system', 'dark', 'light', 'vesper-blur'] as const

const THEME_OPTION_LABELS: Record<(typeof ALL_THEME_OPTIONS)[number], string> = {
  system: 'System',
  dark: 'Dark',
  light: 'Light',
  'vesper-blur': 'Vesper Blur'
}

type ThemePickerProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
  applyTheme: (theme: GlobalSettings['theme']) => void
}

export function ThemePicker({
  settings,
  updateSettings,
  applyTheme
}: ThemePickerProps): JSX.Element {
  // Why: vesper-blur depends on Electron vibrancy/acrylic which Linux has no
  // native equivalent for — hide it on Linux rather than offering a degraded
  // experience.
  const themeOptions = ALL_THEME_OPTIONS.filter(
    (option) => option !== 'vesper-blur' || !isLinuxUserAgent()
  )

  // Why: windowBackgroundBlur is read by createMainWindow() at boot only, so
  // changing it (including via switching into or out of vesper-blur) needs a
  // restart to take effect. Snapshot the value on mount and show a banner when
  // the live value diverges.
  const blurAtMountRef = useRef<boolean>(settings.windowBackgroundBlur ?? false)
  const blurPendingRestart = (settings.windowBackgroundBlur ?? false) !== blurAtMountRef.current
  const [relaunchingBlur, setRelaunchingBlur] = useState(false)

  useEffect(() => {
    blurAtMountRef.current = settings.windowBackgroundBlur ?? false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectTheme = (option: (typeof ALL_THEME_OPTIONS)[number]): void => {
    if (option === 'vesper-blur') {
      // Why: vesper-blur is meaningless without the OS-level vibrancy/acrylic
      // material — auto-enable the blur setting so a single intent ("use
      // Vesper Blur") produces one settings mutation rather than asking the
      // user to flip two switches.
      const needsBlur = !(settings.windowBackgroundBlur ?? false)
      updateSettings(needsBlur ? { theme: option, windowBackgroundBlur: true } : { theme: option })
    } else {
      // Why: leave windowBackgroundBlur alone when switching away — the user's
      // previous standalone preference is none of this picker's business. The
      // standalone toggle reappears so they can adjust it.
      updateSettings({ theme: option })
    }
    applyTheme(option)
  }

  const handleRelaunch = async (): Promise<void> => {
    if (relaunchingBlur) {
      return
    }
    setRelaunchingBlur(true)
    try {
      await window.api.app.relaunch()
    } catch {
      setRelaunchingBlur(false)
    }
  }

  return (
    <SearchableSetting
      title="Theme"
      description="Choose how Orca looks in the app window."
      keywords={['dark', 'light', 'system', 'vesper', 'blur']}
      className="space-y-3"
    >
      <div className="flex w-fit gap-1 rounded-md border border-border/50 p-1">
        {themeOptions.map((option) => (
          <button
            key={option}
            onClick={() => handleSelectTheme(option)}
            className={`rounded-sm px-3 py-1 text-sm transition-colors ${
              settings.theme === option
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {THEME_OPTION_LABELS[option]}
          </button>
        ))}
      </div>

      {blurPendingRestart ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2.5">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              Restart required
            </p>
            <p className="text-xs text-muted-foreground">
              Restart Orca to apply the window blur change.
            </p>
          </div>
          <Button
            size="sm"
            variant="default"
            className="shrink-0 gap-1.5"
            disabled={relaunchingBlur}
            onClick={() => void handleRelaunch()}
          >
            <RotateCw className={`size-3 ${relaunchingBlur ? 'animate-spin' : ''}`} />
            {relaunchingBlur ? 'Restarting…' : 'Restart now'}
          </Button>
        </div>
      ) : null}
    </SearchableSetting>
  )
}
