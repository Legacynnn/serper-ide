import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import type * as ShellReadyModule from './shell-ready'

async function importFreshShellReady(): Promise<typeof ShellReadyModule> {
  vi.resetModules()
  return import('./shell-ready')
}

const describePosix = process.platform === 'win32' ? describe.skip : describe

describePosix('daemon shell-ready launch config', () => {
  let previousUserDataPath: string | undefined
  let previousSerperOrigZdotdir: string | undefined
  let userDataPath: string

  beforeEach(() => {
    previousUserDataPath = process.env.SERPER_USER_DATA_PATH
    previousSerperOrigZdotdir = process.env.SERPER_ORIG_ZDOTDIR
    delete process.env.SERPER_ORIG_ZDOTDIR
    userDataPath = mkdtempSync(join(tmpdir(), 'daemon-shell-ready-test-'))
    process.env.SERPER_USER_DATA_PATH = userDataPath
  })

  afterEach(() => {
    if (previousUserDataPath === undefined) {
      delete process.env.SERPER_USER_DATA_PATH
    } else {
      process.env.SERPER_USER_DATA_PATH = previousUserDataPath
    }
    if (previousSerperOrigZdotdir === undefined) {
      delete process.env.SERPER_ORIG_ZDOTDIR
    } else {
      process.env.SERPER_ORIG_ZDOTDIR = previousSerperOrigZdotdir
    }
    rmSync(userDataPath, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('stores wrapper rcfiles under durable userData instead of tmp', async () => {
    const { getShellReadyLaunchConfig } = await importFreshShellReady()

    const config = getShellReadyLaunchConfig('/bin/bash')
    const rcfile = join(userDataPath, 'shell-ready', 'bash', 'rcfile')

    expect(config.args).toEqual(['--rcfile', rcfile])
    expect(existsSync(rcfile)).toBe(true)
  })

  it('rewrites wrappers when a long-lived daemon finds a missing rcfile', async () => {
    const { getShellReadyLaunchConfig } = await importFreshShellReady()
    const rcfile = join(userDataPath, 'shell-ready', 'bash', 'rcfile')

    getShellReadyLaunchConfig('/bin/bash')
    rmSync(rcfile)

    expect(existsSync(rcfile)).toBe(false)
    getShellReadyLaunchConfig('/bin/bash')
    expect(existsSync(rcfile)).toBe(true)
  })

  it('points zsh launch config at durable wrapper files', async () => {
    const { getShellReadyLaunchConfig } = await importFreshShellReady()

    const config = getShellReadyLaunchConfig('/bin/zsh')

    expect(config.args).toEqual(['-l'])
    expect(config.env.ZDOTDIR).toBe(join(userDataPath, 'shell-ready', 'zsh'))
    expect(existsSync(join(userDataPath, 'shell-ready', 'zsh', '.zshenv'))).toBe(true)
  })

  it('falls back to HOME for SERPER_ORIG_ZDOTDIR when inherited ZDOTDIR points at a wrapper dir', async () => {
    // Why: guards against the zsh recursion loop that happens when the daemon
    // was forked from a shell which was itself an Serper PTY. Such a shell has
    // ZDOTDIR=<some>/shell-ready/zsh; propagating that unchanged would make
    // the wrapper `source "$SERPER_ORIG_ZDOTDIR/.zshenv"` source itself.
    const previousZdotdir = process.env.ZDOTDIR
    const previousHome = process.env.HOME
    process.env.ZDOTDIR = '/some/other/serper/shell-ready/zsh'
    process.env.HOME = '/Users/alice'
    try {
      const { getShellReadyLaunchConfig } = await importFreshShellReady()
      const config = getShellReadyLaunchConfig('/bin/zsh')
      expect(config.env.SERPER_ORIG_ZDOTDIR).toBe('/Users/alice')
    } finally {
      if (previousZdotdir === undefined) {
        delete process.env.ZDOTDIR
      } else {
        process.env.ZDOTDIR = previousZdotdir
      }
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
    }
  })

  it('uses inherited SERPER_ORIG_ZDOTDIR when ZDOTDIR is an Serper wrapper dir', async () => {
    const previousZdotdir = process.env.ZDOTDIR
    const previousOrigZdotdir = process.env.SERPER_ORIG_ZDOTDIR
    const previousHome = process.env.HOME
    process.env.ZDOTDIR = '/some/other/serper/shell-ready/zsh'
    process.env.SERPER_ORIG_ZDOTDIR = '/Users/alice/.config/zsh'
    process.env.HOME = '/Users/alice'
    try {
      const { getShellReadyLaunchConfig } = await importFreshShellReady()
      const config = getShellReadyLaunchConfig('/bin/zsh')
      expect(config.env.SERPER_ORIG_ZDOTDIR).toBe('/Users/alice/.config/zsh')
    } finally {
      if (previousZdotdir === undefined) {
        delete process.env.ZDOTDIR
      } else {
        process.env.ZDOTDIR = previousZdotdir
      }
      if (previousOrigZdotdir === undefined) {
        delete process.env.SERPER_ORIG_ZDOTDIR
      } else {
        process.env.SERPER_ORIG_ZDOTDIR = previousOrigZdotdir
      }
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
    }
  })

  it('falls back to HOME when inherited SERPER_ORIG_ZDOTDIR points at a wrapper dir', async () => {
    const previousZdotdir = process.env.ZDOTDIR
    const previousOrigZdotdir = process.env.SERPER_ORIG_ZDOTDIR
    const previousHome = process.env.HOME
    delete process.env.ZDOTDIR
    process.env.SERPER_ORIG_ZDOTDIR = '/some/other/serper/shell-ready/zsh'
    process.env.HOME = '/Users/alice'
    try {
      const { getShellReadyLaunchConfig } = await importFreshShellReady()
      const config = getShellReadyLaunchConfig('/bin/zsh')
      expect(config.env.SERPER_ORIG_ZDOTDIR).toBe('/Users/alice')
    } finally {
      if (previousZdotdir === undefined) {
        delete process.env.ZDOTDIR
      } else {
        process.env.ZDOTDIR = previousZdotdir
      }
      if (previousOrigZdotdir === undefined) {
        delete process.env.SERPER_ORIG_ZDOTDIR
      } else {
        process.env.SERPER_ORIG_ZDOTDIR = previousOrigZdotdir
      }
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
    }
  })

  it('writes zsh wrappers that guard against SERPER_ORIG_ZDOTDIR self-loops', async () => {
    const { getShellReadyLaunchConfig } = await importFreshShellReady()

    getShellReadyLaunchConfig('/bin/zsh')

    const zshenv = readFileSync(join(userDataPath, 'shell-ready', 'zsh', '.zshenv'), 'utf8')
    expect(zshenv).toContain('local _serper_user_zdotdir="${_serper_spawn_orig_zdotdir:-$HOME}"')
    expect(zshenv).toContain('[[ -f "$_serper_user_zdotdir/.zshenv" ]]')
    expect(zshenv).toContain('*/shell-ready/zsh) export SERPER_ORIG_ZDOTDIR="$HOME" ;;')
  })

  it('writes wrappers that restore OpenCode and Pi config after user startup files', async () => {
    const { getShellReadyLaunchConfig } = await importFreshShellReady()

    getShellReadyLaunchConfig('/bin/zsh')
    getShellReadyLaunchConfig('/bin/bash')

    const zshrc = readFileSync(join(userDataPath, 'shell-ready', 'zsh', '.zshrc'), 'utf8')
    const zlogin = readFileSync(join(userDataPath, 'shell-ready', 'zsh', '.zlogin'), 'utf8')
    const bashRc = readFileSync(join(userDataPath, 'shell-ready', 'bash', 'rcfile'), 'utf8')
    const restoreLine =
      '[[ -n "${SERPER_OPENCODE_CONFIG_DIR:-}" ]] && export OPENCODE_CONFIG_DIR="${SERPER_OPENCODE_CONFIG_DIR}"'
    const piRestoreLine =
      '[[ -n "${SERPER_PI_CODING_AGENT_DIR:-}" ]] && export PI_CODING_AGENT_DIR="${SERPER_PI_CODING_AGENT_DIR}"'
    expect(zshrc).toContain(restoreLine)
    expect(zlogin).toContain(restoreLine)
    expect(bashRc).toContain(restoreLine)
    expect(zshrc).toContain(piRestoreLine)
    expect(zlogin).toContain(piRestoreLine)
    expect(bashRc).toContain(piRestoreLine)
  })

  it('preserves a real inherited ZDOTDIR as SERPER_ORIG_ZDOTDIR', async () => {
    // Why: users who run a custom zsh dotfiles directory legitimately set
    // ZDOTDIR before launching Serper. We only want to reject the self-loop
    // case — any real user ZDOTDIR must round-trip so their configs load.
    const previousZdotdir = process.env.ZDOTDIR
    process.env.ZDOTDIR = '/Users/alice/.config/zsh'
    try {
      const { getShellReadyLaunchConfig } = await importFreshShellReady()
      const config = getShellReadyLaunchConfig('/bin/zsh')
      expect(config.env.SERPER_ORIG_ZDOTDIR).toBe('/Users/alice/.config/zsh')
    } finally {
      if (previousZdotdir === undefined) {
        delete process.env.ZDOTDIR
      } else {
        process.env.ZDOTDIR = previousZdotdir
      }
    }
  })

  it('rejects inherited ZDOTDIR ending in /shell-ready/zsh even with a trailing slash', async () => {
    // Why: `endsWith('/shell-ready/zsh')` without normalization is bypassed by
    // a trailing slash, which some shell startup scripts add. Pinning this case
    // guards against a regression that would reintroduce the recursion loop.
    const previousZdotdir = process.env.ZDOTDIR
    const previousHome = process.env.HOME
    process.env.ZDOTDIR = '/some/other/serper/shell-ready/zsh/'
    process.env.HOME = '/Users/alice'
    try {
      const { getShellReadyLaunchConfig } = await importFreshShellReady()
      const config = getShellReadyLaunchConfig('/bin/zsh')
      expect(config.env.SERPER_ORIG_ZDOTDIR).toBe('/Users/alice')
    } finally {
      if (previousZdotdir === undefined) {
        delete process.env.ZDOTDIR
      } else {
        process.env.ZDOTDIR = previousZdotdir
      }
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
    }
  })

  it('falls back to HOME when ZDOTDIR is only slashes (e.g. "/")', async () => {
    // Why: a bare `/` (or `////`) normalizes to empty and is never a user's
    // real zsh config root; sourcing `/.zshenv` would silently no-op. Falling
    // back to HOME matches what the wrapper already assumes when ZDOTDIR is
    // unset.
    const previousZdotdir = process.env.ZDOTDIR
    const previousHome = process.env.HOME
    process.env.ZDOTDIR = '/'
    process.env.HOME = '/Users/alice'
    try {
      const { getShellReadyLaunchConfig } = await importFreshShellReady()
      const config = getShellReadyLaunchConfig('/bin/zsh')
      expect(config.env.SERPER_ORIG_ZDOTDIR).toBe('/Users/alice')
    } finally {
      if (previousZdotdir === undefined) {
        delete process.env.ZDOTDIR
      } else {
        process.env.ZDOTDIR = previousZdotdir
      }
      if (previousHome === undefined) {
        delete process.env.HOME
      } else {
        process.env.HOME = previousHome
      }
    }
  })

  it('preserves ZDOTDIR that contains /shell-ready/zsh as a substring but does not end with it', async () => {
    // Why: the guard must match the suffix, not a substring — a user directory
    // like `/Users/alice/shell-ready/zsh-custom` should round-trip unchanged.
    // Pinning this case prevents an over-eager `includes` swap in the future.
    const previousZdotdir = process.env.ZDOTDIR
    process.env.ZDOTDIR = '/Users/alice/shell-ready/zsh-custom'
    try {
      const { getShellReadyLaunchConfig } = await importFreshShellReady()
      const config = getShellReadyLaunchConfig('/bin/zsh')
      expect(config.env.SERPER_ORIG_ZDOTDIR).toBe('/Users/alice/shell-ready/zsh-custom')
    } finally {
      if (previousZdotdir === undefined) {
        delete process.env.ZDOTDIR
      } else {
        process.env.ZDOTDIR = previousZdotdir
      }
    }
  })
})
