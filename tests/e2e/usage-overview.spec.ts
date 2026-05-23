import { test, expect } from './helpers/serper-app'
import { getStoreState, waitForSessionReady } from './helpers/store'

test.describe('usage overview', () => {
  test.beforeEach(async ({ serperPage }) => {
    await waitForSessionReady(serperPage)
  })

  test('Stats & Usage opens on the combined overview with provider controls', async ({
    serperPage
  }) => {
    await serperPage.evaluate(() => {
      const state = window.__store!.getState()
      state.openSettingsPage()
    })

    await expect
      .poll(async () => getStoreState<string>(serperPage, 'activeView'), { timeout: 5_000 })
      .toBe('settings')
    await serperPage.getByRole('button', { name: 'Stats & Usage' }).click()
    await expect(serperPage.getByRole('heading', { name: 'Usage Analytics' })).toBeVisible()
    const providerDropdown = serperPage.getByTestId('usage-provider-select')
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: Overview'
    )
    await expect(serperPage.getByTestId('usage-overview-pane')).toBeVisible()
    await expect(serperPage.getByRole('heading', { name: 'Usage Overview' })).toBeVisible()
    await expect(serperPage.getByRole('heading', { name: 'Providers' })).toBeVisible()
    await expect(serperPage.getByRole('button', { name: 'Enable Claude' })).toBeVisible()
    await expect(serperPage.getByRole('button', { name: 'Enable Codex' })).toBeVisible()
    await expect(serperPage.getByRole('button', { name: 'Enable OpenCode' })).toBeVisible()

    await providerDropdown.click()
    await serperPage.getByRole('menuitem', { name: 'Codex', exact: true }).click()
    await expect(serperPage.getByRole('heading', { name: 'Codex Usage Tracking' })).toBeVisible()
    await expect(providerDropdown).toHaveAttribute('aria-label', 'Usage analytics provider: Codex')

    await providerDropdown.click()
    await serperPage.getByRole('menuitem', { name: 'OpenCode', exact: true }).click()
    await expect(serperPage.getByRole('heading', { name: 'OpenCode Usage Tracking' })).toBeVisible()
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: OpenCode'
    )
  })
})
