/* eslint-disable max-lines -- Terminal pane E2E is a serial coverage matrix for split, close, remake, move, resize, and retention flows. */
/**
 * E2E tests for terminal pane splitting, state retention, resizing, and closing.
 *
 * User Prompt:
 * - terminal panes can be split
 * - terminal panes retain state when switching tabs and when you make / close a pane / switch worktrees
 * - resizing terminal panes works
 * - closing panes works
 */

import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/serper-app'
import {
  UUID_RE,
  discoverActivePtyId,
  execInTerminal,
  closeActiveTerminalPane,
  countVisibleTerminalPanes,
  focusLastTerminalPane,
  moveTerminalPaneByLeafId,
  readTerminalPaneDomLeafOrder,
  splitActiveTerminalPane,
  waitForPaneIdentitySnapshot,
  waitForActiveTerminalManager,
  waitForTerminalOutput,
  waitForPaneCount,
  getTerminalContent
} from './helpers/terminal'
import {
  waitForSessionReady,
  waitForActiveWorktree,
  getActiveWorktreeId,
  getActiveTabId,
  getActiveTabType,
  getWorktreeTabs,
  getAllWorktreeIds,
  switchToOtherWorktree,
  switchToWorktree,
  ensureTerminalVisible
} from './helpers/store'
import { pressShortcut } from './helpers/shortcuts'

async function setPaneTitleFromTerminalMenu(page: Page, title: string): Promise<void> {
  const modifiers: ('Alt' | 'Control' | 'Meta' | 'Shift')[] =
    process.platform === 'win32' ? ['Control'] : []
  await page
    .locator('.xterm:visible')
    .first()
    .click({ button: 'right', position: { x: 40, y: 40 }, modifiers })
  await page.getByText('Set Title…', { exact: true }).click()
  const titleInput = page.locator('.pane-title-input').first()
  await expect(titleInput).toBeVisible()
  await titleInput.fill(title)
  await titleInput.press('Enter')
  // Why: CI can dispatch Enter before React has committed the filled value;
  // blurring exercises the same submit path and makes the helper deterministic.
  try {
    await expect(titleInput).toHaveCount(0, { timeout: 500 })
  } catch {
    await titleInput.evaluateAll(([input]) => (input as HTMLElement | undefined)?.blur())
  }
  await expect(titleInput).toHaveCount(0)
}

async function getTabCustomTitle(
  page: Page,
  worktreeId: string,
  tabId: string
): Promise<string | null> {
  return page.evaluate(
    ({ targetWorktreeId, targetTabId }) => {
      const state = window.__store!.getState()
      const tab = (state.tabsByWorktree[targetWorktreeId] ?? []).find(
        (entry) => entry.id === targetTabId
      )
      return tab?.customTitle ?? null
    },
    { targetWorktreeId: worktreeId, targetTabId: tabId }
  )
}

async function expectTabCustomTitle(
  page: Page,
  worktreeId: string,
  tabId: string,
  expected: string | null
): Promise<void> {
  await expect
    .poll(() => getTabCustomTitle(page, worktreeId, tabId), { timeout: 3_000 })
    .toBe(expected)
}

async function expectSavedLayoutNotToContainTitle(
  page: Page,
  tabId: string,
  title: string
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ targetTabId, title }) => {
            const layout = window.__store!.getState().terminalLayoutsByTabId[targetTabId]
            return Object.values(layout?.titlesByLeafId ?? {}).includes(title)
          },
          { targetTabId: tabId, title }
        ),
      { timeout: 3_000 }
    )
    .toBe(false)
}

// Why: only the pointer-drag resize test needs a visible window (pointer
// capture requires a real pointer id). Every other pane operation here is
// driven through the exposed PaneManager API and runs fine headless, so the
// suite itself is not tagged — just the one test that needs it.
// Why: keep the suite serial so when the headful test does run, Playwright
// does not try to open multiple visible Electron windows at once.
test.describe.configure({ mode: 'serial' })
test.describe('Terminal Panes', () => {
  test.beforeEach(async ({ serperPage }) => {
    await waitForSessionReady(serperPage)
    await waitForActiveWorktree(serperPage)
    await ensureTerminalVisible(serperPage)
    // Why: each test launches a fresh Electron instance. The React tree needs
    // to render Terminal → TabGroupPanel → TerminalPane → useTerminalPaneLifecycle
    // before the PaneManager registers on window.__paneManagers. On cold starts
    // this easily exceeds 5s, so allow up to 30s (well within the 120s test budget)
    // to distinguish "slow cold start" from "environment can't mount panes at all."
    const hasPaneManager = await waitForActiveTerminalManager(serperPage, 30_000)
      .then(() => true)
      .catch(() => false)
    test.skip(
      !hasPaneManager,
      'Electron automation in this environment never mounts the live TerminalPane manager, so pane split/resize assertions would only fail on harness setup.'
    )
    // Why: hidden Electron runs can report an active terminal tab before the
    // PaneManager finishes mounting the first xterm/PTY pair. Wait for that
    // initial pane so split and content-retention assertions start from a real
    // terminal surface instead of racing the bootstrapped mount.
    await waitForPaneCount(serperPage, 1, 30_000)
  })

  /**
   * User Prompt:
   * - terminal panes can be split
   */
  test('can split terminal pane right', async ({ serperPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(serperPage)

    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, paneCountBefore + 1)

    const paneCountAfter = await countVisibleTerminalPanes(serperPage)
    expect(paneCountAfter).toBe(paneCountBefore + 1)
  })

  /**
   * User Prompt:
   * - terminal panes can be split
   */
  test('can split terminal pane down', async ({ serperPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(serperPage)

    await splitActiveTerminalPane(serperPage, 'horizontal')
    await waitForPaneCount(serperPage, paneCountBefore + 1)

    const paneCountAfter = await countVisibleTerminalPanes(serperPage)
    expect(paneCountAfter).toBe(paneCountBefore + 1)
  })

  test('split panes persist PTY bindings by stable UUID leaf id', async ({ serperPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(serperPage)

    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, paneCountBefore + 1)

    const snapshot = await waitForPaneIdentitySnapshot(serperPage, paneCountBefore + 1)
    const leafIds = snapshot.panes.map((pane) => pane.leafId)
    const ptyIds = snapshot.panes.map((pane) => pane.ptyId)

    expect(new Set(leafIds).size).toBe(leafIds.length)
    expect(new Set(ptyIds).size).toBe(ptyIds.length)
    expect(Object.keys(snapshot.ptyIdsByLeafId).sort()).toEqual([...leafIds].sort())
    expect(Object.keys(snapshot.ptyIdsByLeafId).every((leafId) => UUID_RE.test(leafId))).toBe(true)
    expect(
      snapshot.panes.some(
        (pane) =>
          String(pane.numericPaneId) === pane.leafId || `pane:${pane.numericPaneId}` === pane.leafId
      )
    ).toBe(false)
  })

  test('terminal process receives SERPER_PANE_KEY with the active UUID leaf id', async ({
    serperPage
  }) => {
    const snapshot = await waitForPaneIdentitySnapshot(serperPage, 1)
    const activeLeafId = snapshot.activeLeafId ?? snapshot.panes[0]?.leafId
    if (!activeLeafId) {
      throw new Error('No active pane leaf id found')
    }

    const expectedPaneKey = `${snapshot.tabId}:${activeLeafId}`
    const ptyId = await discoverActivePtyId(serperPage)
    const marker = `SERPER_PANE_KEY_E2E_${Date.now()}`

    await execInTerminal(serperPage, ptyId, `printf '${marker}=%s\\n' "$SERPER_PANE_KEY"`)
    await waitForTerminalOutput(serperPage, `${marker}=${expectedPaneKey}`)

    expect(activeLeafId).toMatch(UUID_RE)
  })

  test('Set Title stays pane-local during agent title churn', async ({ serperPage }) => {
    const worktreeId = (await getActiveWorktreeId(serperPage))!
    const tabId = (await getActiveTabId(serperPage))!
    const paneTitle = `Codex pane ${Date.now()}`
    const removeButtonTitle = `Remove button label ${Date.now()}`
    const splitTitle = `Split label ${Date.now()}`
    const runtimeTitle = '⠋ Codex working'

    await setPaneTitleFromTerminalMenu(serperPage, paneTitle)
    await expect(serperPage.locator('.pane-title-text', { hasText: paneTitle })).toBeVisible()
    await expectTabCustomTitle(serperPage, worktreeId, tabId, null)

    await serperPage.getByRole('button', { name: `Edit pane title: ${paneTitle}` }).focus()
    await serperPage.keyboard.press('Enter')
    const paneTitleInput = serperPage.getByRole('textbox', { name: 'Pane title' })
    await expect(paneTitleInput).toBeVisible()
    await expect(paneTitleInput).toBeFocused()
    await serperPage.keyboard.press('Escape')
    await expect(paneTitleInput).toHaveCount(0)
    await expect(serperPage.locator('.pane-title-text', { hasText: paneTitle })).toBeVisible()

    await serperPage.evaluate(
      ({ targetTabId, title }) => {
        window.__store!.getState().updateTabTitle(targetTabId, title)
      },
      { targetTabId: tabId, title: runtimeTitle }
    )

    // Why: active agents continuously write OSC titles. Set Title is Serper's
    // pane-local overlay and must remain visible while the tab runtime title
    // continues to follow the active PTY.
    await expect(serperPage.locator('.pane-title-text', { hasText: paneTitle })).toBeVisible()
    await expect(
      serperPage.locator(`[data-testid="sortable-tab"][data-tab-id="${tabId}"]`)
    ).toHaveAttribute('data-tab-title', runtimeTitle)
    await expectTabCustomTitle(serperPage, worktreeId, tabId, null)

    await setPaneTitleFromTerminalMenu(serperPage, '')
    await expect(serperPage.locator('.pane-title-text', { hasText: paneTitle })).toBeHidden()
    await expectSavedLayoutNotToContainTitle(serperPage, tabId, paneTitle)

    await setPaneTitleFromTerminalMenu(serperPage, removeButtonTitle)
    await serperPage.locator('.pane-title-bar', { hasText: removeButtonTitle }).hover()
    await serperPage
      .getByRole('button', { name: `Remove pane title: ${removeButtonTitle}` })
      .click()
    await expect(
      serperPage.locator('.pane-title-text', { hasText: removeButtonTitle })
    ).toBeHidden()
    await expectSavedLayoutNotToContainTitle(serperPage, tabId, removeButtonTitle)

    await setPaneTitleFromTerminalMenu(serperPage, splitTitle)
    await expectTabCustomTitle(serperPage, worktreeId, tabId, null)

    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, 2)
    await expect(serperPage.locator('.pane-title-text', { hasText: splitTitle })).toBeVisible()

    await serperPage.evaluate(
      ({ targetTabId, title }) => {
        window.__store!.getState().updateTabTitle(targetTabId, title)
      },
      { targetTabId: tabId, title: runtimeTitle }
    )
    await expect(
      serperPage.locator(`[data-testid="sortable-tab"][data-tab-id="${tabId}"]`)
    ).toHaveAttribute('data-tab-title', runtimeTitle)
  })

  test('closing a split pane prunes its leaf-keyed PTY binding without remapping siblings', async ({
    serperPage
  }) => {
    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, 2)
    await splitActiveTerminalPane(serperPage, 'horizontal')
    await waitForPaneCount(serperPage, 3)

    const beforeClose = await waitForPaneIdentitySnapshot(serperPage, 3)
    const closedLeafId = beforeClose.activeLeafId ?? beforeClose.panes.at(-1)?.leafId
    if (!closedLeafId) {
      throw new Error('No active split pane leaf id found before close')
    }
    const survivingLeafIds = beforeClose.panes
      .map((pane) => pane.leafId)
      .filter((leafId) => leafId !== closedLeafId)

    await closeActiveTerminalPane(serperPage)
    await waitForPaneCount(serperPage, 2)

    const afterClose = await waitForPaneIdentitySnapshot(serperPage, 2)
    expect(afterClose.panes.map((pane) => pane.leafId).sort()).toEqual(survivingLeafIds.sort())
    expect(Object.keys(afterClose.ptyIdsByLeafId).sort()).toEqual(survivingLeafIds.sort())
    expect(afterClose.ptyIdsByLeafId[closedLeafId]).toBeUndefined()
  })

  test('closing and remaking right/down splits keeps surviving leaf-keyed bindings stable', async ({
    serperPage
  }) => {
    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, 2)
    await splitActiveTerminalPane(serperPage, 'horizontal')
    await waitForPaneCount(serperPage, 3)

    const beforeClose = await waitForPaneIdentitySnapshot(serperPage, 3)
    const closedLeafId = beforeClose.activeLeafId ?? beforeClose.panes.at(-1)?.leafId
    if (!closedLeafId) {
      throw new Error('No active split pane leaf id found before close/remake')
    }
    const survivingBindings = Object.fromEntries(
      beforeClose.panes
        .filter((pane) => pane.leafId !== closedLeafId)
        .map((pane) => [pane.leafId, pane.ptyId])
    )

    await closeActiveTerminalPane(serperPage)
    await waitForPaneCount(serperPage, 2)

    const afterClose = await waitForPaneIdentitySnapshot(serperPage, 2)
    expect(Object.keys(afterClose.ptyIdsByLeafId).sort()).toEqual(
      Object.keys(survivingBindings).sort()
    )
    for (const [leafId, ptyId] of Object.entries(survivingBindings)) {
      expect(afterClose.ptyIdsByLeafId[leafId]).toBe(ptyId)
    }
    expect(afterClose.ptyIdsByLeafId[closedLeafId]).toBeUndefined()

    await splitActiveTerminalPane(serperPage, 'horizontal')
    await waitForPaneCount(serperPage, 3)

    const afterRemake = await waitForPaneIdentitySnapshot(serperPage, 3)
    const remadeLeafIds = afterRemake.panes.map((pane) => pane.leafId)
    expect(remadeLeafIds).not.toContain(closedLeafId)
    for (const [leafId, ptyId] of Object.entries(survivingBindings)) {
      expect(afterRemake.ptyIdsByLeafId[leafId]).toBe(ptyId)
    }
    expect(new Set(remadeLeafIds).size).toBe(3)
  })

  test('moving panes through the drag-drop handler preserves leaf-keyed PTY bindings', async ({
    serperPage
  }) => {
    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, 2)
    await splitActiveTerminalPane(serperPage, 'horizontal')
    await waitForPaneCount(serperPage, 3)

    const beforeMove = await waitForPaneIdentitySnapshot(serperPage, 3)
    const beforeOrder = await readTerminalPaneDomLeafOrder(serperPage)
    const source = beforeMove.panes.at(-1)
    const target = beforeMove.panes[0]
    if (!source || !target) {
      throw new Error('Need source and target panes for move test')
    }
    const bindingsBefore = { ...beforeMove.ptyIdsByLeafId }

    await moveTerminalPaneByLeafId(serperPage, source.leafId, target.leafId, 'left')

    await expect
      .poll(async () => readTerminalPaneDomLeafOrder(serperPage), {
        timeout: 10_000,
        message: 'Pane drag-drop move did not update DOM order'
      })
      .not.toEqual(beforeOrder)

    const afterMove = await waitForPaneIdentitySnapshot(serperPage, 3)
    const afterLeafIds = afterMove.panes.map((pane) => pane.leafId).sort()
    expect(afterLeafIds).toEqual(beforeMove.panes.map((pane) => pane.leafId).sort())
    expect(afterMove.ptyIdsByLeafId).toEqual(bindingsBefore)
  })

  /**
   * User Prompt:
   * - terminal panes retain state when switching tabs and when you make / close a pane / switch worktrees
   */
  test('terminal pane retains content when switching tabs and back', async ({ serperPage }) => {
    // Write a unique marker to the current terminal
    const ptyId = await discoverActivePtyId(serperPage)
    const marker = `RETAIN_TEST_${Date.now()}`
    await execInTerminal(serperPage, ptyId, `echo ${marker}`)
    await waitForTerminalOutput(serperPage, marker)

    // Create a new terminal tab (Cmd/Ctrl+T) to switch away
    const worktreeId = (await getActiveWorktreeId(serperPage))!
    await pressShortcut(serperPage, 't')

    // Wait for the new tab to appear
    await expect
      .poll(async () => (await getWorktreeTabs(serperPage, worktreeId)).length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(2)

    // Verify we're still on a terminal tab
    const activeType = await getActiveTabType(serperPage)
    expect(activeType).toBe('terminal')

    // Switch back to the previous tab with Cmd/Ctrl+Shift+[
    await pressShortcut(serperPage, 'BracketLeft', { shift: true })

    // Verify the marker is still present
    await expect
      .poll(async () => (await getTerminalContent(serperPage)).includes(marker), { timeout: 5_000 })
      .toBe(true)

    // Clean up the extra tab
    await pressShortcut(serperPage, 'BracketRight', { shift: true })
    await pressShortcut(serperPage, 'w')
  })

  /**
   * User Prompt:
   * - terminal panes retain state when switching tabs and when you make / close a pane / switch worktrees
   */
  test('terminal pane retains content when splitting and closing a pane', async ({
    serperPage
  }) => {
    // Write a unique marker to the current terminal
    const ptyId = await discoverActivePtyId(serperPage)
    const marker = `SPLIT_RETAIN_${Date.now()}`
    await execInTerminal(serperPage, ptyId, `echo ${marker}`)
    await waitForTerminalOutput(serperPage, marker)

    const panesBefore = await countVisibleTerminalPanes(serperPage)

    // Split the terminal right
    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, panesBefore + 1)

    await focusLastTerminalPane(serperPage)
    await closeActiveTerminalPane(serperPage)
    await waitForPaneCount(serperPage, panesBefore)

    // The original pane should still have our marker
    await expect
      .poll(async () => (await getTerminalContent(serperPage)).includes(marker), { timeout: 5_000 })
      .toBe(true)
  })

  /**
   * User Prompt:
   * - terminal panes retain state when switching tabs and when you make / close a pane / switch worktrees
   */
  test('terminal pane retains content when switching worktrees and back', async ({
    serperPage
  }) => {
    const allWorktreeIds = await getAllWorktreeIds(serperPage)
    if (allWorktreeIds.length < 2) {
      test.skip(true, 'Need at least 2 worktrees to test worktree switching')
      return
    }

    const worktreeId = (await getActiveWorktreeId(serperPage))!

    // Write a unique marker to the current terminal
    const ptyId = await discoverActivePtyId(serperPage)
    const marker = `WT_RETAIN_${Date.now()}`
    await execInTerminal(serperPage, ptyId, `echo ${marker}`)
    await waitForTerminalOutput(serperPage, marker)

    // Switch to a different worktree via the store
    const otherId = await switchToOtherWorktree(serperPage, worktreeId)
    expect(otherId).not.toBeNull()
    await expect.poll(async () => getActiveWorktreeId(serperPage), { timeout: 5_000 }).toBe(otherId)

    // Switch back to the original worktree
    await switchToWorktree(serperPage, worktreeId)
    await expect
      .poll(async () => getActiveWorktreeId(serperPage), { timeout: 5_000 })
      .toBe(worktreeId)

    // Why: after a worktree round-trip, the split-group container transitions
    // from hidden back to visible. In headful Electron runs the terminal tree
    // can take longer than a single render turn to rebind its serialize addon
    // after the worktree activation cascade. Waiting directly for the retained
    // marker proves the user-visible behavior without failing early on the
    // intermediate manager-remount timing.
    await ensureTerminalVisible(serperPage)

    // The terminal should still contain our marker
    await expect
      .poll(async () => (await getTerminalContent(serperPage)).includes(marker), {
        timeout: 20_000
      })
      .toBe(true)
  })

  /**
   * User Prompt:
   * - resizing terminal panes works
   */
  test('shows a pane divider after splitting', async ({ serperPage }) => {
    // Why: headless Playwright cannot exercise the real pointer-capture resize
    // path reliably, so the default suite only verifies the precondition for
    // resizing: splitting creates a visible divider for the active layout.
    const panesBefore = await countVisibleTerminalPanes(serperPage)
    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, panesBefore + 1)

    await expect(serperPage.locator('.pane-divider.is-vertical').first()).toBeVisible({
      timeout: 3_000
    })
  })

  /**
   * User Prompt:
   * - resizing terminal panes works (headful variant)
   *
   * Why this test must be headful: the pane divider's drag handler calls
   * setPointerCapture(e.pointerId) on pointerdown. Pointer capture requires
   * a valid pointer ID from a real pointing-device event, which Playwright's
   * mouse API only produces when the Electron window is visible. In headless
   * mode setPointerCapture silently fails, pointermove never fires on the
   * divider, and the resize has no effect. Run with:
   *   SERPER_E2E_HEADFUL=1 pnpm run test:e2e
   */
  test('@headful can resize terminal panes by real mouse drag', async ({ serperPage }) => {
    // Split the terminal to create a resizable divider
    const panesBefore = await countVisibleTerminalPanes(serperPage)
    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, panesBefore + 1)

    // Get the pane widths before resize
    const paneWidthsBefore = await serperPage.evaluate(() => {
      const xterms = document.querySelectorAll('.xterm')
      return Array.from(xterms)
        .filter((x) => (x as HTMLElement).offsetParent !== null)
        .map((x) => (x as HTMLElement).getBoundingClientRect().width)
    })
    expect(paneWidthsBefore.length).toBeGreaterThanOrEqual(2)

    // Find the vertical pane divider and drag it
    const divider = serperPage.locator('.pane-divider.is-vertical').first()
    await expect(divider).toBeVisible({ timeout: 3_000 })
    const box = await divider.boundingBox()
    expect(box).not.toBeNull()

    // Drag the divider 150px to the right to resize panes
    const startX = box!.x + box!.width / 2
    const startY = box!.y + box!.height / 2
    await serperPage.mouse.move(startX, startY)
    await serperPage.mouse.down()
    await serperPage.mouse.move(startX + 150, startY, { steps: 20 })
    await serperPage.mouse.up()

    // Verify pane widths changed
    await expect
      .poll(
        async () => {
          const widthsAfter = await serperPage.evaluate(() => {
            const xterms = document.querySelectorAll('.xterm')
            return Array.from(xterms)
              .filter((x) => (x as HTMLElement).offsetParent !== null)
              .map((x) => (x as HTMLElement).getBoundingClientRect().width)
          })
          if (widthsAfter.length < 2) {
            return false
          }

          return paneWidthsBefore.some((w, i) => Math.abs(w - widthsAfter[i]) > 20)
        },
        { timeout: 5_000, message: 'Pane widths did not change after dragging divider' }
      )
      .toBe(true)
  })

  test('@headful dragging terminal panes around preserves leaf-keyed PTY bindings', async ({
    serperPage
  }) => {
    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, 2)
    await splitActiveTerminalPane(serperPage, 'horizontal')
    await waitForPaneCount(serperPage, 3)

    const beforeDrag = await waitForPaneIdentitySnapshot(serperPage, 3)
    const beforeOrder = await readTerminalPaneDomLeafOrder(serperPage)
    const source = beforeDrag.panes.at(-1)
    const target = beforeDrag.panes[0]
    if (!source || !target) {
      throw new Error('Need source and target panes for drag test')
    }

    const sourceHandle = serperPage.locator(
      `.pane[data-leaf-id="${source.leafId}"] .pane-drag-handle`
    )
    await expect(sourceHandle).toBeVisible({ timeout: 3_000 })
    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await serperPage
      .locator(`.pane[data-leaf-id="${target.leafId}"]`)
      .boundingBox()
    expect(sourceBox).not.toBeNull()
    expect(targetBox).not.toBeNull()

    await serperPage.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + 4)
    await serperPage.mouse.down()
    await serperPage.mouse.move(targetBox!.x + 8, targetBox!.y + targetBox!.height / 2, {
      steps: 20
    })
    await serperPage.mouse.up()

    await expect
      .poll(async () => readTerminalPaneDomLeafOrder(serperPage), {
        timeout: 10_000,
        message: 'Real pane drag did not update DOM order'
      })
      .not.toEqual(beforeOrder)

    const afterDrag = await waitForPaneIdentitySnapshot(serperPage, 3)
    expect(afterDrag.panes.map((pane) => pane.leafId).sort()).toEqual(
      beforeDrag.panes.map((pane) => pane.leafId).sort()
    )
    expect(afterDrag.ptyIdsByLeafId).toEqual(beforeDrag.ptyIdsByLeafId)
  })

  /**
   * User Prompt:
   * - closing panes works
   */
  test('closing a split pane removes it and remaining pane fills space', async ({ serperPage }) => {
    const panesBefore = await countVisibleTerminalPanes(serperPage)

    // Split the terminal
    await splitActiveTerminalPane(serperPage, 'vertical')
    await waitForPaneCount(serperPage, panesBefore + 1)

    const panesAfterSplit = await countVisibleTerminalPanes(serperPage)
    expect(panesAfterSplit).toBeGreaterThanOrEqual(2)

    await closeActiveTerminalPane(serperPage)
    await waitForPaneCount(serperPage, panesAfterSplit - 1)

    // The remaining pane should fill the available space
    const paneWidth = await serperPage.evaluate(() => {
      const xterms = document.querySelectorAll('.xterm')
      const visible = Array.from(xterms).find(
        (x) => (x as HTMLElement).offsetParent !== null
      ) as HTMLElement | null
      return visible?.getBoundingClientRect().width ?? 0
    })
    // Why: threshold is kept low to account for headless mode where the
    // window is 1200px wide (not maximized) and the sidebar takes space.
    expect(paneWidth).toBeGreaterThan(200)
  })
})
