import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getRelayShellLaunchConfig } from './pty-shell-launch'

describe('getRelayShellLaunchConfig', () => {
  let homeDir: string

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'relay-shell-launch-'))
  })

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true })
  })

  it.skipIf(process.platform === 'win32')(
    'preserves a user ZDOTDIR exported from .zshenv for later startup files',
    () => {
      const config = getRelayShellLaunchConfig('/bin/zsh', {
        HOME: homeDir,
        SERPER_OPENCODE_CONFIG_DIR: '/tmp/serper-opencode-overlay'
      })
      const zshRoot = join(homeDir, '.serper-relay', 'shell-ready', 'zsh')

      expect(config.args).toEqual(['-l'])
      expect(config.env.ZDOTDIR).toBe(zshRoot)
      expect(readFileSync(join(zshRoot, '.zshenv'), 'utf8')).toContain(
        'export SERPER_USER_ZDOTDIR="${ZDOTDIR:-${SERPER_ORIG_ZDOTDIR:-$HOME}}"'
      )
      expect(readFileSync(join(zshRoot, '.zprofile'), 'utf8')).toContain(
        '_serper_home="${SERPER_USER_ZDOTDIR:-${SERPER_ORIG_ZDOTDIR:-$HOME}}"'
      )
      expect(readFileSync(join(zshRoot, '.zshrc'), 'utf8')).toContain(
        '_serper_home="${SERPER_USER_ZDOTDIR:-${SERPER_ORIG_ZDOTDIR:-$HOME}}"'
      )
      expect(readFileSync(join(zshRoot, '.zlogin'), 'utf8')).toContain(
        '_serper_home="${SERPER_USER_ZDOTDIR:-${SERPER_ORIG_ZDOTDIR:-$HOME}}"'
      )
    }
  )

  it.skipIf(process.platform === 'win32')('rewrites stale persistent wrapper files', () => {
    const zshRoot = join(homeDir, '.serper-relay', 'shell-ready', 'zsh')
    mkdirSync(zshRoot, { recursive: true })
    writeFileSync(join(zshRoot, '.zshenv'), '# stale relay wrapper\n')

    getRelayShellLaunchConfig('/bin/zsh', {
      HOME: homeDir,
      SERPER_OPENCODE_CONFIG_DIR: '/tmp/serper-opencode-overlay'
    })

    expect(readFileSync(join(zshRoot, '.zshenv'), 'utf8')).toContain(
      'export SERPER_USER_ZDOTDIR="${ZDOTDIR:-${SERPER_ORIG_ZDOTDIR:-$HOME}}"'
    )
  })
})
