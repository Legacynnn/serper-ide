/**
 * E2E tests for the Tasks page.
 *
 * Verifies that opening the tasks view renders correctly and that the
 * repo selector, mode tabs, and close affordance are all present.
 */

import { test, expect } from './helpers/serper-app'
import { waitForSessionReady, waitForActiveWorktree, getStoreState } from './helpers/store'

async function openTasksPage(page: Parameters<typeof getStoreState>[0]): Promise<void> {
  await page.evaluate(() => {
    const store = window.__store
    store?.getState().openTaskPage()
  })
}

test.describe('Tasks page', () => {
  test.beforeEach(async ({ serperPage }) => {
    await waitForSessionReady(serperPage)
    await waitForActiveWorktree(serperPage)
  })

  test('opening the tasks view renders the tasks UI', async ({ serperPage }) => {
    await openTasksPage(serperPage)

    await expect
      .poll(async () => getStoreState<string>(serperPage, 'activeView'), { timeout: 5_000 })
      .toBe('tasks')

    // Titlebar label, close button, and mode tabs should all render.
    await expect(serperPage.getByRole('button', { name: 'Close tasks' })).toBeVisible({
      timeout: 10_000
    })
    await expect(serperPage.getByRole('button', { name: 'GitHub', exact: true })).toBeVisible()
    await expect(serperPage.getByRole('button', { name: 'Issues', exact: true })).toBeVisible()
    await expect(serperPage.getByRole('button', { name: 'PRs', exact: true })).toBeVisible()
    await expect(serperPage.getByRole('button', { name: 'Projects', exact: true })).toBeVisible()
    await expect(
      serperPage.getByRole('textbox', { name: /Search GitHub (issues|PRs)/i })
    ).toBeVisible()
  })

  test('closing the tasks page returns to the previous view', async ({ serperPage }) => {
    const previousView = await getStoreState<string>(serperPage, 'activeView')

    await openTasksPage(serperPage)
    await expect
      .poll(async () => getStoreState<string>(serperPage, 'activeView'), { timeout: 5_000 })
      .toBe('tasks')
    // Sanity: the tasks UI actually painted before we close it.
    await expect(serperPage.getByRole('button', { name: 'Close tasks' })).toBeVisible()

    await serperPage.getByRole('button', { name: 'Close tasks' }).click()

    await expect
      .poll(async () => getStoreState<string>(serperPage, 'activeView'), { timeout: 5_000 })
      .toBe(previousView)
    // Why: the load-bearing check is that the previous view's DOM actually
    // re-rendered — a store-only `activeView` assertion would pass even if the
    // terminal/editor surface had silently stopped mounting. `.xterm` is the
    // stable class xterm.js emits on every live terminal pane; if the
    // previous view was terminal (by far the common case in E2E setup), that
    // element must be visible. Tasks-close also hides the "Close tasks"
    // button regardless of previous view, so we assert that too.
    await expect(serperPage.getByRole('button', { name: 'Close tasks' })).toHaveCount(0)
    if (previousView === 'terminal') {
      await expect(serperPage.locator('.xterm').first()).toBeVisible({ timeout: 5_000 })
    }
  })
})
