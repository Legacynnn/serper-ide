/**
 * E2E test for terminal keyboard shortcuts.
 *
 * Verifies every chord resolved by resolveTerminalShortcutAction end-to-end:
 * real DOM keydown → window capture handler → policy → transport → IPC.
 *
 * sendInput chords are verified by intercepting pty:write in the Electron main
 * process so the test proves the bytes actually leave the renderer, without
 * depending on the shell's readline behaving identically across OSes. Action
 * chords (split, close, search, clear) are verified via their user-visible
 * side effect (pane count, search overlay, terminal buffer).
 *
 * Platform-specific chords (Cmd+Arrow, Cmd+Backspace on macOS only) are
 * skipped on the other platform since they'd never fire there at runtime.
 */

import { test, expect } from './helpers/serper-app'
import type { ElectronApplication, Page } from '@stablyai/playwright-test'
import {
  discoverActivePtyId,
  execInTerminal,
  countVisibleTerminalPanes,
  waitForActiveTerminalManager,
  waitForTerminalOutput,
  waitForPaneCount,
  getTerminalContent
} from './helpers/terminal'
import { waitForSessionReady, waitForActiveWorktree, ensureTerminalVisible } from './helpers/store'

// Why: contextBridge freezes window.api so the renderer cannot spy on
// pty.write directly. Intercept in the main process instead — pty:write is an
// ipcMain.on listener, so prepending a listener lets us capture every call
// without disturbing the real handler.
async function installMainProcessPtyWriteSpy(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    const g = globalThis as unknown as {
      __ptyWriteLog?: { id: string; data: string }[]
      __ptyWriteSpyInstalled?: boolean
    }
    if (g.__ptyWriteSpyInstalled) {
      return
    }
    g.__ptyWriteLog = []
    g.__ptyWriteSpyInstalled = true
    ipcMain.prependListener('pty:write', (_event: unknown, args: { id: string; data: string }) => {
      g.__ptyWriteLog!.push({ id: args.id, data: args.data })
    })
  })
}

async function clearPtyWriteLog(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const g = globalThis as unknown as { __ptyWriteLog?: { id: string; data: string }[] }
    if (g.__ptyWriteLog) {
      g.__ptyWriteLog.length = 0
    }
  })
}

async function getPtyWrites(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => {
    const g = globalThis as unknown as { __ptyWriteLog?: { id: string; data: string }[] }
    return (g.__ptyWriteLog ?? []).map((e) => e.data)
  })
}

// Why: the window-level keydown handler is gated on non-editable targets; the
// xterm helper textarea is treated as non-editable on purpose. Focusing it
// guarantees each chord reaches the shortcut policy through the real DOM path.
async function focusActiveTerminal(page: Page): Promise<void> {
  await page.evaluate(() => {
    const textarea = document.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null
    textarea?.focus()
  })
}

async function enableKittyKeyboardReporting(page: Page, flags: number): Promise<void> {
  await page.evaluate(async (flags) => {
    const state = window.__store?.getState()
    const worktreeId = state?.activeWorktreeId
    const tabId =
      state?.activeTabType === 'terminal'
        ? state.activeTabId
        : worktreeId
          ? (state?.activeTabIdByWorktree?.[worktreeId] ?? null)
          : null
    const manager = tabId ? window.__paneManagers?.get(tabId) : null
    const pane = manager?.getActivePane?.() ?? manager?.getPanes?.()[0] ?? null
    if (!pane) {
      throw new Error('No active terminal pane for kitty keyboard setup')
    }
    await new Promise<void>((resolve) => {
      pane.terminal.write(`\x1b[=${flags}u`, resolve)
    })
  }, flags)
}

async function pressShiftedRussianLayoutKey(page: Page): Promise<{
  keydownDefaultPrevented: boolean
  keypressSent: boolean
  keyupSent: boolean
}> {
  return page.evaluate(() => {
    const textarea = document.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('No xterm helper textarea to receive keyboard input')
    }
    textarea.focus()

    const keydown = new KeyboardEvent('keydown', {
      key: 'Ф',
      code: 'KeyA',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(keydown, 'keyCode', { get: () => 65 })
    Object.defineProperty(keydown, 'which', { get: () => 65 })
    textarea.dispatchEvent(keydown)

    if (keydown.defaultPrevented) {
      return { keydownDefaultPrevented: true, keypressSent: false, keyupSent: false }
    }

    const keypress = new KeyboardEvent('keypress', {
      key: 'Ф',
      code: 'KeyA',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(keypress, 'keyCode', { get: () => 1060 })
    Object.defineProperty(keypress, 'charCode', { get: () => 1060 })
    Object.defineProperty(keypress, 'which', { get: () => 1060 })
    textarea.dispatchEvent(keypress)

    const keyup = new KeyboardEvent('keyup', {
      key: 'Ф',
      code: 'KeyA',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })
    Object.defineProperty(keyup, 'keyCode', { get: () => 65 })
    Object.defineProperty(keyup, 'which', { get: () => 65 })
    textarea.dispatchEvent(keyup)

    return { keydownDefaultPrevented: false, keypressSent: true, keyupSent: true }
  })
}

// Why: handleRequestClosePane pops a "Close Terminal?" dialog when the pane
// reports a running child process. Under E2E, a freshly split pane's
// proc.process is briefly unset so the check returns true spuriously. Click
// Close when the dialog appears so the test's chord-routing assertion stays
// deterministic; no-op when it doesn't.
async function confirmCloseDialogIfShown(page: Page): Promise<void> {
  const confirmButton = page.getByRole('button', { name: 'Close', exact: true })
  try {
    await confirmButton.waitFor({ state: 'visible', timeout: 500 })
    await confirmButton.click()
  } catch {
    // Dialog did not appear — pane closed directly.
  }
}

async function pressAndExpectWrite(
  page: Page,
  app: ElectronApplication,
  chord: string,
  expectedData: string
): Promise<void> {
  await clearPtyWriteLog(app)
  await focusActiveTerminal(page)
  await page.keyboard.press(chord)

  // Why: assert exact equality, not substring match. Short control codes like
  // \x01 (Ctrl+A) and \x05 (Ctrl+E) are single bytes that can appear inside
  // unrelated writes (shell prompt redraws, bracketed-paste sequences), so a
  // substring match would produce false positives.
  await expect
    .poll(async () => (await getPtyWrites(app)).some((w) => w === expectedData), {
      timeout: 5_000,
      message: `Expected chord "${chord}" to write ${JSON.stringify(expectedData)}`
    })
    .toBe(true)
}

const isMac = process.platform === 'darwin'
const mod = isMac ? 'Meta' : 'Control'

// Why: split chords differ by platform. On macOS Cmd+D splits vertically and
// Cmd+Shift+D horizontally. On Linux/Windows Ctrl+D is reserved for EOF
// (see terminal-shortcut-policy.ts and #586), so vertical is Ctrl+Shift+D
// and horizontal is Alt+Shift+D (Windows Terminal convention).
const splitVerticalChord = isMac ? `${mod}+d` : `${mod}+Shift+d`
const splitHorizontalChord = isMac ? `${mod}+Shift+d` : 'Alt+Shift+d'

// Why: serial mode is load-bearing. Tests mutate shared Electron app state
// (pane layout, terminal buffer, expand toggle) and the pty:write spy log is
// a single main-process singleton. Parallel execution would interleave chord
// effects and corrupt assertions.
test.describe.configure({ mode: 'serial' })
test.describe('Terminal Shortcuts', () => {
  test.beforeEach(async ({ serperPage }) => {
    await waitForSessionReady(serperPage)
    await waitForActiveWorktree(serperPage)
    await ensureTerminalVisible(serperPage)
    const hasPaneManager = await waitForActiveTerminalManager(serperPage, 30_000)
      .then(() => true)
      .catch(() => false)
    test.skip(
      !hasPaneManager,
      'Electron automation in this environment never mounts the live TerminalPane manager.'
    )
    await waitForPaneCount(serperPage, 1, 30_000)
  })

  test('all terminal chords reach the PTY or fire their action', async ({
    serperPage,
    electronApp
  }) => {
    await installMainProcessPtyWriteSpy(electronApp)

    // Seed the buffer so Cmd+K has something to clear.
    const ptyId = await discoverActivePtyId(serperPage)
    const marker = `SHORTCUT_TEST_${Date.now()}`
    await execInTerminal(serperPage, ptyId, `echo ${marker}`)
    await waitForTerminalOutput(serperPage, marker)

    // --- send-input chords (platform-agnostic) ---

    // Alt+←/→ → readline backward-word / forward-word (\eb / \ef).
    await pressAndExpectWrite(serperPage, electronApp, 'Alt+ArrowLeft', '\x1bb')
    await pressAndExpectWrite(serperPage, electronApp, 'Alt+ArrowRight', '\x1bf')

    // Ctrl+←/→ on non-mac → readline backward-word / forward-word (\eb / \ef).
    // Mac-gated: Ctrl+Arrow on macOS is reserved for Mission Control / Spaces.
    if (!isMac) {
      await pressAndExpectWrite(serperPage, electronApp, 'Control+ArrowLeft', '\x1bb')
      await pressAndExpectWrite(serperPage, electronApp, 'Control+ArrowRight', '\x1bf')
    }

    // Alt+Backspace → Esc+DEL (readline backward-kill-word).
    await pressAndExpectWrite(serperPage, electronApp, 'Alt+Backspace', '\x1b\x7f')

    // Ctrl+Backspace → \x17 (unix-word-rubout).
    await pressAndExpectWrite(serperPage, electronApp, 'Control+Backspace', '\x17')

    // Shift+Enter → CSI-u so agents can distinguish from plain Enter.
    await pressAndExpectWrite(serperPage, electronApp, 'Shift+Enter', '\x1b[13;2u')

    // --- send-input chords (macOS-only) ---

    if (isMac) {
      // Cmd+←/→ → Ctrl+A / Ctrl+E (beginning/end of line).
      await pressAndExpectWrite(serperPage, electronApp, 'Meta+ArrowLeft', '\x01')
      await pressAndExpectWrite(serperPage, electronApp, 'Meta+ArrowRight', '\x05')

      // Cmd+Backspace → Ctrl+U (kill line). Cmd+Delete → Ctrl+K (kill to EOL).
      await pressAndExpectWrite(serperPage, electronApp, 'Meta+Backspace', '\x15')
      await pressAndExpectWrite(serperPage, electronApp, 'Meta+Delete', '\x0b')
    }

    // --- action chords (no PTY byte; assert via visible effect) ---

    // Cmd/Ctrl+K clears the pane.
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(`${mod}+k`)
    await expect
      .poll(async () => (await getTerminalContent(serperPage)).includes(marker), {
        timeout: 5_000,
        message: 'Cmd+K did not clear the terminal buffer'
      })
      .toBe(false)

    // Split vertically (chord varies by platform — see splitVerticalChord).
    const panesBeforeSplit = await countVisibleTerminalPanes(serperPage)
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(splitVerticalChord)
    await waitForPaneCount(serperPage, panesBeforeSplit + 1)

    // Cmd/Ctrl+] and Cmd/Ctrl+[ cycle focus (no pane-count change).
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(`${mod}+BracketRight`)
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(`${mod}+BracketLeft`)
    expect(await countVisibleTerminalPanes(serperPage)).toBe(panesBeforeSplit + 1)

    // Cmd/Ctrl+Shift+Enter toggles expand on the active pane. Requires >1 pane,
    // so it runs while the vertical split from above is still open.
    const readExpanded = async (): Promise<boolean> =>
      serperPage.evaluate(() => {
        const state = window.__store?.getState()
        const tabId = state?.activeTabId
        if (!state || !tabId) {
          return false
        }
        return state.expandedPaneByTabId[tabId] === true
      })
    expect(await readExpanded()).toBe(false)
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(`${mod}+Shift+Enter`)
    await expect
      .poll(readExpanded, { timeout: 3_000, message: 'Cmd+Shift+Enter did not expand pane' })
      .toBe(true)
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(`${mod}+Shift+Enter`)
    await expect
      .poll(readExpanded, { timeout: 3_000, message: 'Cmd+Shift+Enter did not collapse pane' })
      .toBe(false)

    // Cmd/Ctrl+W closes the active split pane (not the whole tab: >1 pane).
    // Why: the close handler checks hasChildProcesses async; a freshly
    // spawned pane can transiently report a running child (node-pty's
    // proc.process lags the spawn), which surfaces a confirmation dialog
    // instead of closing immediately. Confirm it if it appears — the test
    // only needs to prove the chord routed to the close handler.
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(`${mod}+w`)
    await confirmCloseDialogIfShown(serperPage)
    await waitForPaneCount(serperPage, panesBeforeSplit)

    // Split horizontally (chord varies by platform — see splitHorizontalChord).
    const panesBeforeHSplit = await countVisibleTerminalPanes(serperPage)
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(splitHorizontalChord)
    await waitForPaneCount(serperPage, panesBeforeHSplit + 1)
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(`${mod}+w`)
    await confirmCloseDialogIfShown(serperPage)
    await waitForPaneCount(serperPage, panesBeforeHSplit)

    // Cmd/Ctrl+F toggles the search overlay.
    await focusActiveTerminal(serperPage)
    await serperPage.keyboard.press(`${mod}+f`)
    const searchInput = serperPage.locator('[data-terminal-search-root] input').first()
    // Why: Escape is handled by TerminalSearch's React onKeyDown, which only
    // fires when focus is inside the overlay. The overlay auto-focuses its
    // input via a useEffect, but Playwright can press Escape before that
    // effect runs and the keystroke goes to the xterm textarea instead.
    // Wait for the input to actually be focused before pressing Escape.
    await expect(searchInput).toBeFocused({ timeout: 3_000 })
    await serperPage.keyboard.press('Escape')
    await expect(serperPage.locator('[data-terminal-search-root]').first()).toBeHidden({
      timeout: 3_000
    })
  })

  test('Shift with Russian layout text reaches the PTY as Cyrillic under kitty keyboard reporting', async ({
    serperPage,
    electronApp
  }) => {
    await installMainProcessPtyWriteSpy(electronApp)
    await enableKittyKeyboardReporting(serperPage, 31)
    await clearPtyWriteLog(electronApp)

    const dispatch = await pressShiftedRussianLayoutKey(serperPage)

    expect(dispatch).toEqual({
      keydownDefaultPrevented: false,
      keypressSent: true,
      keyupSent: true
    })
    await expect
      .poll(async () => (await getPtyWrites(electronApp)).some((write) => write.includes('Ф')), {
        timeout: 5_000,
        message: 'Shift+Russian layout text did not reach the PTY as Cyrillic'
      })
      .toBe(true)
    const writes = await getPtyWrites(electronApp)
    const joinedWrites = writes.join('')
    expect(joinedWrites).not.toContain('\x1b[97:1060;2;1060u')
    expect(joinedWrites).not.toContain('\x1b[97:1060;2:3u')
  })
})
