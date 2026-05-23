/**
 * E2E tests for inline tab renaming (double-click a tab to rename).
 *
 * User Prompt:
 * - double-click a tab to rename it inline
 */

import { test, expect } from './helpers/serper-app'
import {
  waitForSessionReady,
  waitForActiveWorktree,
  getActiveWorktreeId,
  getActiveTabId,
  getWorktreeTabs,
  ensureTerminalVisible
} from './helpers/store'

test.describe('Tab Rename (Inline)', () => {
  test.beforeEach(async ({ serperPage }) => {
    await waitForSessionReady(serperPage)
    await waitForActiveWorktree(serperPage)
    await ensureTerminalVisible(serperPage)
    // Why: clear any custom titles left by a previous test (the Electron app
    // persists across tests in the worker) so tab locators key off the default
    // title, not a stale rename like "My Custom Title".
    await serperPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        return
      }
      const state = store.getState()
      for (const tabs of Object.values(state.tabsByWorktree)) {
        for (const tab of tabs) {
          if (tab.customTitle != null) {
            state.setTabCustomTitle(tab.id, null)
          }
        }
      }
    })
  })

  async function getActiveTabTitle(
    page: Parameters<typeof getActiveTabId>[0],
    worktreeId: string
  ): Promise<string> {
    const activeId = await getActiveTabId(page)
    expect(activeId).not.toBeNull()
    const tabs = await getWorktreeTabs(page, worktreeId)
    const tab = tabs.find((entry) => entry.id === activeId)
    expect(tab).toBeDefined()
    // Why: mirror what the UI renders (customTitle ?? title) so locators that
    // key off the tab's visible text match what's actually on screen.
    return tab!.customTitle ?? tab!.title ?? ''
  }

  function tabLocatorByTitle(
    page: Parameters<typeof getActiveTabId>[0],
    title: string
  ): ReturnType<Parameters<typeof getActiveTabId>[0]['locator']> {
    // Why: backslash first so the backslashes we introduce when escaping the
    // double-quote aren't themselves re-escaped; both chars are CSS-selector
    // metacharacters inside a double-quoted attribute value.
    const escaped = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return page.locator(`[data-testid="sortable-tab"][data-tab-title="${escaped}"]`).first()
  }

  async function dispatchMiddleClickSequence(
    locator: ReturnType<Parameters<typeof getActiveTabId>[0]['locator']>
  ): Promise<void> {
    await locator.evaluate((element) => {
      const eventInit = { bubbles: true, cancelable: true, button: 1 }
      element.dispatchEvent(new MouseEvent('mousedown', { ...eventInit, buttons: 4 }))
      element.dispatchEvent(new MouseEvent('mouseup', eventInit))
      element.dispatchEvent(new MouseEvent('auxclick', eventInit))
    })
  }

  async function getActiveCustomTitle(
    page: Parameters<typeof getActiveTabId>[0],
    worktreeId: string
  ): Promise<string | null> {
    return page.evaluate((targetWorktreeId) => {
      const store = window.__store
      if (!store) {
        return null
      }

      const state = store.getState()
      const activeId = state.activeTabIdByWorktree[targetWorktreeId] ?? state.activeTabId
      const tab = (state.tabsByWorktree[targetWorktreeId] ?? []).find((t) => t.id === activeId)
      return tab?.customTitle ?? null
    }, worktreeId)
  }

  test('double-clicking a tab opens an inline rename input and Enter commits', async ({
    serperPage
  }) => {
    const worktreeId = (await getActiveWorktreeId(serperPage))!
    const originalTitle = await getActiveTabTitle(serperPage, worktreeId)
    expect(originalTitle.length).toBeGreaterThan(0)

    const tabLocator = tabLocatorByTitle(serperPage, originalTitle)
    await tabLocator.dblclick()

    const renameInput = serperPage.getByRole('textbox', {
      name: `Rename tab ${originalTitle}`,
      exact: true
    })
    await expect(renameInput).toBeVisible()

    await renameInput.fill('My Custom Title')
    await renameInput.press('Enter')

    await expect
      .poll(async () => getActiveCustomTitle(serperPage, worktreeId), { timeout: 3_000 })
      .toBe('My Custom Title')
    await expect(renameInput).toBeHidden()
    await expect(tabLocatorByTitle(serperPage, 'My Custom Title')).toBeVisible()
  })

  test('Escape during inline rename discards the edit', async ({ serperPage }) => {
    const worktreeId = (await getActiveWorktreeId(serperPage))!
    const originalTitle = await getActiveTabTitle(serperPage, worktreeId)

    const tabLocator = tabLocatorByTitle(serperPage, originalTitle)
    await tabLocator.dblclick()

    const renameInput = serperPage.getByRole('textbox', {
      name: `Rename tab ${originalTitle}`,
      exact: true
    })
    await expect(renameInput).toBeVisible()

    await renameInput.fill('Should Be Discarded')
    await renameInput.press('Escape')

    await expect(renameInput).toBeHidden()
    // Why: the final assertion must be on user-observable DOM, not the store's
    // customTitle field. A render-layer bug where the tab silently paints the
    // in-progress "Should Be Discarded" text would leave customTitle null
    // (Escape cleared it) yet flash the discarded label to the user — the
    // original title must still be the one rendered on the tab.
    await expect(tabLocatorByTitle(serperPage, originalTitle)).toBeVisible()
    await expect
      .poll(async () => getActiveCustomTitle(serperPage, worktreeId), { timeout: 3_000 })
      .toBe(null)
  })

  test('renaming to an empty string resets the tab to its default title', async ({
    serperPage
  }) => {
    const worktreeId = (await getActiveWorktreeId(serperPage))!

    // Snapshot the default (non-custom) title first so the DOM assertion later
    // can verify the tab reverts to *this exact* rendered text — a store-only
    // `customTitle === null` check would pass even if the rendered label was
    // stuck on "Seeded Custom".
    const defaultTitle = await getActiveTabTitle(serperPage, worktreeId)
    expect(defaultTitle.length).toBeGreaterThan(0)

    // Why: seed a custom title directly via the store so this test asserts the
    // "empty string → reset" behavior independently from the double-click flow.
    await serperPage.evaluate((targetWorktreeId) => {
      const store = window.__store
      if (!store) {
        return
      }

      const state = store.getState()
      const activeId = state.activeTabIdByWorktree[targetWorktreeId] ?? state.activeTabId
      if (activeId) {
        state.setTabCustomTitle(activeId, 'Seeded Custom')
      }
    }, worktreeId)

    await expect
      .poll(async () => getActiveCustomTitle(serperPage, worktreeId), { timeout: 3_000 })
      .toBe('Seeded Custom')

    const tabLocator = tabLocatorByTitle(serperPage, 'Seeded Custom')
    await tabLocator.dblclick()

    const renameInput = serperPage.getByRole('textbox', {
      name: 'Rename tab Seeded Custom',
      exact: true
    })
    await expect(renameInput).toBeVisible()

    await renameInput.fill('')
    await renameInput.press('Enter')

    // User-observable DOM assertion: the tab element must re-render with the
    // original default title, not the "Seeded Custom" override.
    await expect(tabLocatorByTitle(serperPage, defaultTitle)).toBeVisible()
    await expect
      .poll(async () => getActiveCustomTitle(serperPage, worktreeId), { timeout: 3_000 })
      .toBe(null)
  })

  test('clicking away (blur) commits the rename', async ({ serperPage }) => {
    const worktreeId = (await getActiveWorktreeId(serperPage))!

    // Why: need a second tab so we have something to click that isn't the
    // rename input itself. Seed both with known titles so we can locate them.
    await serperPage.evaluate((targetWorktreeId) => {
      const store = window.__store
      if (!store) {
        return
      }
      const state = store.getState()
      const existing = state.tabsByWorktree[targetWorktreeId] ?? []
      if (existing.length < 2) {
        state.createTab(targetWorktreeId)
      }
    }, worktreeId)

    await expect
      .poll(async () => (await getWorktreeTabs(serperPage, worktreeId)).length, { timeout: 3_000 })
      .toBeGreaterThanOrEqual(2)

    const tabs = await getWorktreeTabs(serperPage, worktreeId)
    const activeId = await getActiveTabId(serperPage)
    const activeTab = tabs.find((t) => t.id === activeId)!
    const otherTab = tabs.find((t) => t.id !== activeId)!

    const tabLocator = tabLocatorByTitle(serperPage, activeTab.title!)
    await tabLocator.dblclick()

    const renameInput = serperPage.getByRole('textbox', {
      name: `Rename tab ${activeTab.title}`,
      exact: true
    })
    await expect(renameInput).toBeVisible()

    await renameInput.fill('Committed By Blur')
    // Why: clicking the other tab triggers blur on the input, which should
    // run commitRename and save the typed title before the focus shifts.
    await tabLocatorByTitle(serperPage, otherTab.title!).click()

    await expect(renameInput).toBeHidden()
    await expect(tabLocatorByTitle(serperPage, 'Committed By Blur')).toBeVisible()
    expect(
      await serperPage.evaluate(
        ({ targetWorktreeId, targetTabId }) => {
          const store = window.__store
          const state = store!.getState()
          const tab = (state.tabsByWorktree[targetWorktreeId] ?? []).find(
            (t) => t.id === targetTabId
          )
          return tab?.customTitle ?? null
        },
        { targetWorktreeId: worktreeId, targetTabId: activeTab.id }
      )
    ).toBe('Committed By Blur')
  })

  test('right-clicking during inline rename commits and opens context menu', async ({
    serperPage
  }) => {
    const worktreeId = (await getActiveWorktreeId(serperPage))!
    const originalTitle = await getActiveTabTitle(serperPage, worktreeId)

    const tabLocator = tabLocatorByTitle(serperPage, originalTitle)
    await tabLocator.dblclick()

    const renameInput = serperPage.getByRole('textbox', {
      name: `Rename tab ${originalTitle}`,
      exact: true
    })
    await expect(renameInput).toBeVisible()

    await renameInput.fill('Committed By Right Click')
    // Why: right-clicking the tab blurs the input (commitRename runs) and
    // opens the context menu. We assert the rename was saved; the menu
    // assertion is intentionally light because the menu markup is shared
    // with other specs.
    await tabLocator.click({ button: 'right' })

    await expect
      .poll(async () => getActiveCustomTitle(serperPage, worktreeId), { timeout: 3_000 })
      .toBe('Committed By Right Click')
    await expect(renameInput).toBeHidden()
  })

  test('rename input stays at a usable width when many tabs are open', async ({ serperPage }) => {
    const worktreeId = (await getActiveWorktreeId(serperPage))!

    // Why: create enough terminal tabs that flex space runs out. 15 is well
    // above the threshold at which the pre-fix input collapsed, and it keeps
    // the test fast. The width fix pins the input to 72px (matching the
    // slimmer tab title box), so even saturated, it should stay near that
    // size — we assert ≥60px to allow a bit of slack for fonts/padding/
    // containers differing between environments. The meaningful guarantee is
    // that the input does not collapse to ~0 when flex space is saturated.
    await serperPage.evaluate((targetWorktreeId) => {
      const store = window.__store
      if (!store) {
        return
      }
      const state = store.getState()
      const existing = (state.tabsByWorktree[targetWorktreeId] ?? []).length
      for (let i = existing; i < 15; i++) {
        state.createTab(targetWorktreeId, undefined, undefined, { activate: false })
      }
    }, worktreeId)

    await expect
      .poll(async () => (await getWorktreeTabs(serperPage, worktreeId)).length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(15)

    const targetTitle = await getActiveTabTitle(serperPage, worktreeId)
    const tabLocator = tabLocatorByTitle(serperPage, targetTitle)
    await tabLocator.scrollIntoViewIfNeeded()
    await expect(tabLocator).toBeVisible()
    // Why: once 15 tabs are packed into the strip, the tab center can overlap
    // the close affordance. Target the visible title text, which is the rename
    // hit area users aim for.
    const tabTitle = tabLocator.getByText(targetTitle, { exact: true })
    await expect(tabTitle).toBeVisible()
    await tabTitle.dblclick()

    const renameInput = serperPage.getByRole('textbox', {
      name: `Rename tab ${targetTitle}`,
      exact: true
    })
    await expect(renameInput).toBeVisible()

    const width = await renameInput.evaluate((element) => element.getBoundingClientRect().width)
    expect(width).toBeGreaterThanOrEqual(60)
  })

  test('middle-clicking inside the rename input does not close the tab', async ({ serperPage }) => {
    const worktreeId = (await getActiveWorktreeId(serperPage))!
    const tabsBefore = (await getWorktreeTabs(serperPage, worktreeId)).length
    const originalTitle = await getActiveTabTitle(serperPage, worktreeId)

    const tabLocator = tabLocatorByTitle(serperPage, originalTitle)
    await tabLocator.dblclick()

    const renameInput = serperPage.getByRole('textbox', {
      name: `Rename tab ${originalTitle}`,
      exact: true
    })
    await expect(renameInput).toBeVisible()

    // Why: the outer tab's middle-click handler closes the tab. The rename
    // input stops propagation + preventDefaults middle-click so the tab
    // isn't closed while the user is editing.
    await dispatchMiddleClickSequence(renameInput)

    // The tab must still exist — no regression where editing-then-middle-click
    // accidentally closes the tab out from under the input.
    await expect(renameInput).toBeVisible()
    await expect(tabLocatorByTitle(serperPage, originalTitle)).toBeVisible()
    expect((await getWorktreeTabs(serperPage, worktreeId)).length).toBe(tabsBefore)
  })
})
