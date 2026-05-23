import { test, expect } from './helpers/serper-app'
import { getStoreState, waitForSessionReady } from './helpers/store'
import type { ElectronApplication, Page } from '@stablyai/playwright-test'

async function openFeatureTourFromMenu(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow, Menu }) => {
    const featureTourItem = Menu.getApplicationMenu()
      ?.items.find((item) => item.label === 'Help')
      ?.submenu?.items.find((item) => item.label === 'Feature tour')

    if (!featureTourItem) {
      throw new Error('Feature tour menu item was not registered')
    }

    const window = BrowserWindow.getAllWindows()[0]
    featureTourItem.click(featureTourItem, window, {
      triggeredByAccelerator: false,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false
    } as Electron.KeyboardEvent)
  })
}

async function loadedFeatureWallImageCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-feature-wall-tile-id] img')).filter(
      (image): image is HTMLImageElement =>
        image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    ).length
  })
}

test.describe('Feature tour modal', () => {
  test.beforeEach(async ({ serperPage }) => {
    await waitForSessionReady(serperPage)
  })

  test('opens from the Help menu, renders bundled media, and closes cleanly', async ({
    electronApp,
    serperPage
  }) => {
    await openFeatureTourFromMenu(electronApp)

    await expect(
      serperPage.getByRole('dialog', { name: "Explore some of Serper's features" })
    ).toBeVisible({
      timeout: 10_000
    })
    await expect(
      serperPage.getByText('Tasks, terminal, agents, browser, SSH, review, and more.')
    ).toBeVisible()
    await expect(
      serperPage.getByText('Reopen this any time from Help > Feature tour.')
    ).toBeVisible()
    await expect(serperPage.getByRole('listitem')).toHaveCount(12)
    await expect(
      serperPage.getByRole('listitem', { name: /Remote worktrees over SSH/i })
    ).toBeVisible()

    await expect
      .poll(async () => loadedFeatureWallImageCount(serperPage), {
        timeout: 10_000,
        message: 'feature-wall media did not load'
      })
      .toBeGreaterThanOrEqual(12)

    const assetSources = await serperPage
      .locator('[data-feature-wall-tile-id] img')
      .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src))
    expect(assetSources.length).toBeGreaterThanOrEqual(12)
    expect(assetSources.every((src) => src.includes('/onboarding/feature-wall/'))).toBe(true)

    await electronApp.evaluate(({ shell }) => {
      const testGlobal = globalThis as typeof globalThis & {
        __featureWallOpenedDocsUrl: string | null
        __featureWallOriginalOpenExternal?: typeof shell.openExternal
      }
      testGlobal.__featureWallOpenedDocsUrl = null
      testGlobal.__featureWallOriginalOpenExternal = shell.openExternal
      shell.openExternal = ((url: string) => {
        testGlobal.__featureWallOpenedDocsUrl = url
        return Promise.resolve()
      }) as typeof shell.openExternal
    })
    try {
      await serperPage.locator('[data-feature-wall-tile-id="tile-02"]').click()
      await expect
        .poll(() =>
          electronApp.evaluate(
            () =>
              (
                globalThis as typeof globalThis & {
                  __featureWallOpenedDocsUrl: string | null
                }
              ).__featureWallOpenedDocsUrl
          )
        )
        .toBe('https://www.onserper.dev/docs/terminal')
    } finally {
      await electronApp.evaluate(({ shell }) => {
        const originalOpenExternal = (
          globalThis as typeof globalThis & {
            __featureWallOriginalOpenExternal?: typeof shell.openExternal
          }
        ).__featureWallOriginalOpenExternal
        if (originalOpenExternal) {
          shell.openExternal = originalOpenExternal
        }
      })
    }

    await serperPage.locator('[data-feature-wall-tile-id="tile-01"]').focus()
    await serperPage.keyboard.press('ArrowRight')
    await expect
      .poll(() =>
        serperPage.evaluate(
          () => (document.activeElement as HTMLElement | null)?.dataset.featureWallTileId
        )
      )
      .toBe('tile-02')

    await serperPage.getByRole('button', { name: 'Close' }).click()
    await expect(
      serperPage.getByRole('dialog', { name: "Explore some of Serper's features" })
    ).toHaveCount(0)
    await expect.poll(async () => getStoreState<string>(serperPage, 'activeModal')).toBe('none')
  })

  test('shows the bottom-right nudge and opens the full tour', async ({ serperPage }) => {
    await serperPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.getState().showFeatureTourNudge()
    })

    const nudge = serperPage.getByRole('complementary', {
      name: "Explore some of Serper's features"
    })
    await expect(nudge).toBeVisible()
    await expect(nudge.getByText('GitHub & Linear, native')).toBeVisible()
    await expect(
      nudge.getByText(
        'Browse GitHub and Linear tasks in-app. Start worktrees, review PRs, and approve without switching context.'
      )
    ).toBeVisible()
    await expect(nudge.getByText('Reopen this any time from Help > Feature tour.')).toBeVisible()
    await expect
      .poll(
        () =>
          nudge
            .locator('[data-feature-tour-nudge-caption]')
            .evaluate((node) => node.scrollHeight <= node.clientHeight + 1),
        {
          message: 'feature tour nudge caption should not be clipped'
        }
      )
      .toBe(true)
    await expect(nudge.locator('img')).toHaveAttribute('src', /tile-03/)

    await nudge.getByRole('button', { name: /^Open tour$/ }).click()
    await expect(
      serperPage.getByRole('dialog', { name: "Explore some of Serper's features" })
    ).toBeVisible()
    await expect
      .poll(async () => getStoreState<boolean>(serperPage, 'featureTourNudgeVisible'))
      .toBe(false)
  })
})
