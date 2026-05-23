/**
 * Stress test for dead-terminal reproduction (setup-split flow).
 *
 * Why @headful: the dead-terminal bug is a WebGL canvas staleness issue — after
 * wrapInSplit() reparents the existing pane's container, the WebGL canvas can
 * fail to repaint. In headless mode WebGL is NEVER active, so the DOM fallback
 * renderer is used and the bug cannot manifest. Running headful ensures real
 * WebGL contexts matching production.
 *
 * See helpers/dead-terminal.ts for the shared worktree-creation helper that
 * replicates the exact activateAndRevealWorktree + ensureWorktreeHasInitialTerminal
 * production flow.
 */

import { test, expect } from './helpers/serper-app'
import {
  waitForSessionReady,
  waitForActiveWorktree,
  getActiveWorktreeId,
  switchToWorktree,
  ensureTerminalVisible
} from './helpers/store'
import { waitForActiveTerminalManager, waitForPaneCount } from './helpers/terminal'
import {
  createAndActivateWorktreeWithSetup,
  removeWorktreeViaStore,
  waitForAllPanesToHaveContent,
  checkWebglState
} from './helpers/dead-terminal'

const STRESS_ITERATIONS = 5

test.describe('Dead Terminal Reproduction @headful', () => {
  const createdWorktreeIds: string[] = []

  test.beforeEach(async ({ serperPage }) => {
    await waitForSessionReady(serperPage)
    await waitForActiveWorktree(serperPage)
    await ensureTerminalVisible(serperPage)

    await serperPage.evaluate(async () => {
      const state = window.__store?.getState()
      if (!state) {
        return
      }
      state.updateSettings({ setupScriptLaunchMode: 'split-vertical' })
    })
  })

  test.afterEach(async ({ serperPage }) => {
    for (const id of createdWorktreeIds) {
      await removeWorktreeViaStore(serperPage, id)
    }
    createdWorktreeIds.length = 0
  })

  test('@headful setup-split flow does not produce dead terminals', async ({ serperPage }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(serperPage)
    await waitForActiveTerminalManager(serperPage, 30_000)
    await checkWebglState(serperPage, 'home-initial')

    for (let i = 0; i < STRESS_ITERATIONS; i++) {
      const direction = i % 2 === 0 ? 'vertical' : 'horizontal'
      const newId = await createAndActivateWorktreeWithSetup(serperPage, `setup-${i}`, direction)
      createdWorktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(serperPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(serperPage)
      await waitForActiveTerminalManager(serperPage, 30_000)
      await waitForPaneCount(serperPage, 2, 15_000)
      await checkWebglState(serperPage, `setup-${i}`)
      await waitForAllPanesToHaveContent(serperPage, `setup-${i} both panes`)

      await switchToWorktree(serperPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(serperPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await removeWorktreeViaStore(serperPage, newId)
      createdWorktreeIds.pop()
    }
  })

  test('@headful setup-split then switch-back does not leave panes dead', async ({
    serperPage
  }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(serperPage)
    await waitForActiveTerminalManager(serperPage, 30_000)

    for (let i = 0; i < STRESS_ITERATIONS; i++) {
      const newId = await createAndActivateWorktreeWithSetup(
        serperPage,
        `switchback-${i}`,
        'vertical'
      )
      createdWorktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(serperPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(serperPage)
      await waitForActiveTerminalManager(serperPage, 30_000)
      await waitForPaneCount(serperPage, 2, 15_000)
      await waitForAllPanesToHaveContent(serperPage, `switchback-${i} initial`)

      await switchToWorktree(serperPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(serperPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await ensureTerminalVisible(serperPage)
      await waitForActiveTerminalManager(serperPage, 15_000)

      await switchToWorktree(serperPage, newId)
      await expect
        .poll(async () => getActiveWorktreeId(serperPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(serperPage)
      await waitForActiveTerminalManager(serperPage, 15_000)
      await waitForAllPanesToHaveContent(serperPage, `switchback-${i} after return`)

      await switchToWorktree(serperPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(serperPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await removeWorktreeViaStore(serperPage, newId)
      createdWorktreeIds.pop()
    }
  })

  test('@headful rapid switching between many setup-split worktrees', async ({ serperPage }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(serperPage)
    await waitForActiveTerminalManager(serperPage, 30_000)

    const worktreeIds = [homeWorktreeId]
    for (let i = 0; i < 4; i++) {
      const newId = await createAndActivateWorktreeWithSetup(serperPage, `multi-${i}`, 'vertical')
      createdWorktreeIds.push(newId)
      worktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(serperPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(serperPage)
      await waitForActiveTerminalManager(serperPage, 30_000)
      await waitForPaneCount(serperPage, 2, 15_000)
      await waitForAllPanesToHaveContent(serperPage, `multi-create-${i}`)
    }

    for (let round = 0; round < 3; round++) {
      for (const wId of worktreeIds) {
        await switchToWorktree(serperPage, wId)
        await expect
          .poll(async () => getActiveWorktreeId(serperPage), { timeout: 10_000 })
          .toBe(wId)
        await ensureTerminalVisible(serperPage)
        await waitForActiveTerminalManager(serperPage, 15_000)
        await waitForAllPanesToHaveContent(serperPage, `multi-r${round}-${wId.slice(0, 8)}`)
      }
    }
  })
})
