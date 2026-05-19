import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import TabBar from '@/components/tab-bar/TabBar'
import TerminalPane from '@/components/terminal-pane/TerminalPane'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { useAppStore } from '@/store'
import { useActiveWorktree } from '@/store/selectors'
import { reconcileTabOrder } from '@/components/tab-bar/reconcile-order'
import {
  INTEGRATED_TERMINAL_PANEL_HEIGHT_DEFAULT,
  INTEGRATED_TERMINAL_PANEL_HEIGHT_MIN,
  integratedTerminalWorktreeKey
} from '../../../../shared/constants'
import type { TerminalTab } from '../../../../shared/types'

const EMPTY_TERMINAL_TABS: TerminalTab[] = []

// Why: the bottom panel cannot grow past 85% of viewport — otherwise the
// editor surface above it collapses to a sliver and the user has no easy
// path back. Mirrors the 0.85 split-ratio cap in TabGroupSplitLayout.
const MAX_HEIGHT_RATIO = 0.85

function clampHeight(value: number): number {
  if (typeof window === 'undefined' || !Number.isFinite(value)) {
    return INTEGRATED_TERMINAL_PANEL_HEIGHT_DEFAULT
  }
  const max = Math.max(INTEGRATED_TERMINAL_PANEL_HEIGHT_MIN, window.innerHeight * MAX_HEIGHT_RATIO)
  if (value < INTEGRATED_TERMINAL_PANEL_HEIGHT_MIN) {
    return INTEGRATED_TERMINAL_PANEL_HEIGHT_MIN
  }
  if (value > max) {
    return max
  }
  return value
}

export function IntegratedTerminalPanel(): React.JSX.Element | null {
  const open = useAppStore((s) => s.integratedTerminalOpen)
  const setOpen = useAppStore((s) => s.setIntegratedTerminalOpen)
  const activeWorktree = useActiveWorktree()
  const activeWorktreeId = activeWorktree?.id ?? null
  const worktreeKey = activeWorktreeId ? integratedTerminalWorktreeKey(activeWorktreeId) : null

  const tabsByWorktree = useAppStore((s) => s.tabsByWorktree)
  const activeTabIdByWorktree = useAppStore((s) => s.activeTabIdByWorktree)
  const expandedPaneByTabId = useAppStore((s) => s.expandedPaneByTabId)
  const createTab = useAppStore((s) => s.createTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const setActiveTabForWorktree = useAppStore((s) => s.setActiveTabForWorktree)
  const setTabBarOrder = useAppStore((s) => s.setTabBarOrder)
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)
  const setTabColor = useAppStore((s) => s.setTabColor)
  const setTabPaneExpanded = useAppStore((s) => s.setTabPaneExpanded)
  const tabBarOrder = useAppStore((s) =>
    worktreeKey ? s.tabBarOrderByWorktree[worktreeKey] : undefined
  )
  const persistedHeight = useAppStore(
    (s) => s.settings?.integratedTerminalPanelHeight ?? INTEGRATED_TERMINAL_PANEL_HEIGHT_DEFAULT
  )
  const updateSettings = useAppStore((s) => s.updateSettings)

  // Why: drag previews shouldn't write through every pointermove — keep the
  // live height local and commit to settings on pointerup.
  const [liveHeight, setLiveHeight] = useState<number>(() => clampHeight(persistedHeight))
  useEffect(() => {
    setLiveHeight(clampHeight(persistedHeight))
  }, [persistedHeight])

  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const previousOpenRef = useRef(false)

  const tabs = worktreeKey
    ? (tabsByWorktree[worktreeKey] ?? EMPTY_TERMINAL_TABS)
    : EMPTY_TERMINAL_TABS
  const activeTabId = worktreeKey
    ? (activeTabIdByWorktree[worktreeKey] ?? tabs[0]?.id ?? null)
    : null
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null,
    [activeTabId, tabs]
  )
  const activeIntegratedTabId = activeTab?.id ?? null
  const cwd = activeWorktree?.path ?? null

  // Why: auto-bootstrap a tab when the panel newly opens for a workspace
  // with no integrated terminal tabs yet, so Cmd+J always lands the user in
  // a usable shell instead of an empty panel. Mirrors floating terminal's
  // bootstrap (FloatingTerminalPanel.tsx:99-109), but guards on worktreeKey
  // so the early-cold-start null state never strands a tab under a bare key.
  useEffect(() => {
    const opened = open && !previousOpenRef.current
    previousOpenRef.current = open
    if (!opened || !worktreeKey || tabs.length > 0) {
      return
    }
    const tab = createTab(worktreeKey, undefined, undefined, { activate: false })
    setActiveTabForWorktree(worktreeKey, tab.id)
  }, [createTab, open, setActiveTabForWorktree, tabs.length, worktreeKey])

  useEffect(() => {
    if (!open || !activeIntegratedTabId) {
      return
    }
    focusTerminalTabSurface(activeIntegratedTabId)
  }, [activeIntegratedTabId, open])

  const createIntegratedTab = useCallback(() => {
    if (!worktreeKey) {
      return
    }
    const tab = createTab(worktreeKey, undefined, undefined, { activate: false })
    setActiveTabForWorktree(worktreeKey, tab.id)
    const state = useAppStore.getState()
    const currentTabs = state.tabsByWorktree[worktreeKey] ?? []
    const stored = state.tabBarOrderByWorktree[worktreeKey] ?? []
    const validIds = new Set(currentTabs.map((entry) => entry.id))
    const order = stored.filter((id) => validIds.has(id) && id !== tab.id)
    for (const entry of currentTabs) {
      if (entry.id !== tab.id && !order.includes(entry.id)) {
        order.push(entry.id)
      }
    }
    order.push(tab.id)
    setTabBarOrder(worktreeKey, order)
    focusTerminalTabSurface(tab.id)
  }, [createTab, setActiveTabForWorktree, setTabBarOrder, worktreeKey])

  const closeIntegratedTab = useCallback(
    (tabId: string) => {
      if (!worktreeKey) {
        return
      }
      const state = useAppStore.getState()
      const currentTabs = state.tabsByWorktree[worktreeKey] ?? []
      const isClosingLast = currentTabs.length === 1 && currentTabs[0]?.id === tabId
      closeTab(tabId)
      if (isClosingLast) {
        setOpen(false)
      }
    },
    [closeTab, setOpen, worktreeKey]
  )

  const closeOthers = useCallback(
    (tabId: string) => {
      if (!worktreeKey) {
        return
      }
      const state = useAppStore.getState()
      const currentTabs = state.tabsByWorktree[worktreeKey] ?? []
      for (const tab of currentTabs) {
        if (tab.id !== tabId) {
          closeTab(tab.id)
        }
      }
    },
    [closeTab, worktreeKey]
  )

  const closeToRight = useCallback(
    (tabId: string) => {
      if (!worktreeKey) {
        return
      }
      const state = useAppStore.getState()
      const currentTabs = state.tabsByWorktree[worktreeKey] ?? []
      const terminalIds = currentTabs.map((tab) => tab.id)
      const visibleIds = reconcileTabOrder(
        state.tabBarOrderByWorktree[worktreeKey],
        terminalIds,
        []
      )
      const index = visibleIds.findIndex((id) => id === tabId)
      if (index === -1) {
        return
      }
      for (const id of visibleIds.slice(index + 1)) {
        closeTab(id)
      }
    },
    [closeTab, worktreeKey]
  )

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return
      }
      // Why: stop xterm's pointer listeners (rendered below) from claiming
      // the drag mid-stream; without this the resize stalls as soon as the
      // pointer crosses into the terminal surface.
      event.stopPropagation()
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: liveHeight
      }
    },
    [liveHeight]
  )

  const handleResizeMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    // Dragging up = larger panel; subtract delta from start height.
    const next = clampHeight(drag.startHeight - (event.clientY - drag.startY))
    setLiveHeight(next)
  }, [])

  const handleResizeEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) {
        return
      }
      dragRef.current = null
      const committed = clampHeight(liveHeight)
      if (committed !== persistedHeight) {
        void updateSettings({ integratedTerminalPanelHeight: committed })
      }
    },
    [liveHeight, persistedHeight, updateSettings]
  )

  if (!open || !worktreeKey) {
    return null
  }

  return (
    <div
      data-integrated-terminal-panel
      className="flex shrink-0 flex-col border-t border-border bg-[var(--editor-surface,var(--background))]"
      style={{ height: `${liveHeight}px` }}
    >
      <div
        ref={handleRef}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize integrated terminal panel"
        className="h-1 w-full shrink-0 cursor-row-resize bg-transparent hover:bg-accent/50 active:bg-accent/70"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
      />
      <div className="flex h-9 shrink-0 items-center border-b border-border bg-[var(--bg-titlebar,var(--card))]">
        <div className="flex h-full min-w-0 flex-1">
          <TabBar
            tabs={tabs}
            activeTabId={activeTab?.id ?? null}
            worktreeId={worktreeKey}
            expandedPaneByTabId={expandedPaneByTabId}
            onActivate={(tabId) => setActiveTabForWorktree(worktreeKey, tabId)}
            onClose={closeIntegratedTab}
            onCloseOthers={closeOthers}
            onCloseToRight={closeToRight}
            onNewTerminalTab={createIntegratedTab}
            onNewBrowserTab={() => {}}
            terminalOnly
            onSetCustomTitle={setTabCustomTitle}
            onSetTabColor={setTabColor}
            onTogglePaneExpand={(tabId) =>
              setTabPaneExpanded(tabId, expandedPaneByTabId[tabId] !== true)
            }
            activeTabType="terminal"
            tabBarOrder={tabBarOrder}
          />
        </div>
        <div className="flex items-center pr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close integrated terminal panel"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Close panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
        {cwd
          ? tabs.map((tab) => (
              <div
                key={`${tab.id}-${tab.generation ?? 0}`}
                className={
                  tab.id === activeTab?.id ? 'absolute inset-0' : 'absolute inset-0 hidden'
                }
                aria-hidden={tab.id !== activeTab?.id}
              >
                <TerminalPane
                  tabId={tab.id}
                  worktreeId={worktreeKey}
                  cwd={cwd}
                  isActive={tab.id === activeTab?.id}
                  isVisible={tab.id === activeTab?.id}
                  onPtyExit={() => closeTab(tab.id)}
                  onCloseTab={() => closeIntegratedTab(tab.id)}
                />
              </div>
            ))
          : null}
      </div>
    </div>
  )
}

export default IntegratedTerminalPanel
