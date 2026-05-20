import { useCallback, useEffect } from 'react'
import { useAppStore } from '../../store'
import { activateCyclableTab } from '../../hooks/ipc-tab-switch'
import {
  buildRecentTabSwitcherModel,
  getNextRecentTabSwitcherIndex,
  normalizeCtrlTabOrderMode
} from './recent-tab-switching'

/**
 * Wires Ctrl+Tab / Ctrl+Shift+Tab to immediately activate the next tab in the
 * active panel. Order follows the Ctrl+Tab Order setting (MRU or sequential).
 * Why no modal: users want a direct switch — the held-Ctrl picker UI was
 * intrusive for the common case of "just go to the next tab".
 */
export default function RecentTabSwitcher(): null {
  const switchTab = useCallback((direction: 1 | -1): void => {
    const store = useAppStore.getState()
    if (store.activeView !== 'terminal' || !store.activeWorktreeId) {
      return
    }
    const model = buildRecentTabSwitcherModel(
      store,
      store.activeWorktreeId,
      normalizeCtrlTabOrderMode(store.settings?.ctrlTabOrderMode)
    )
    if (!model || model.items.length === 0) {
      return
    }
    // Why: pass the current selection (model.activeIndex) so the cycle steps
    // off the active tab in the chosen direction, wrapping at the ends.
    const nextIndex = getNextRecentTabSwitcherIndex(
      model.items.length,
      model.activeIndex,
      direction
    )
    const next = model.items[nextIndex]
    if (next) {
      activateCyclableTab(store, next)
    }
  }, [])

  useEffect(() => {
    // Why: Electron's before-input-event delivers Ctrl+Tab here too so it
    // works when a browser guest webContents has focus. The window keydown
    // path below covers normal renderer focus.
    const unsubscribeKeyDown = window.api.ui.onCtrlTabKeyDown(({ shiftKey }) => {
      switchTab(shiftKey ? -1 : 1)
    })
    return () => {
      unsubscribeKeyDown()
    }
  }, [switchTab])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code === 'Tab' && event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        event.stopPropagation()
        switchTab(event.shiftKey ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [switchTab])

  return null
}
