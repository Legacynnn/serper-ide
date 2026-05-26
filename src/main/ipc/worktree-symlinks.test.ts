import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  statSync,
  lstatSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  existsSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorktreeSymlinks, removeWorktreeSymlinks } from './worktree-symlinks'

describe('createWorktreeSymlinks', () => {
  let root: string
  let primary: string
  let worktree: string
  let warn: ReturnType<typeof vi.spyOn>
  let error: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'serper-symlinks-'))
    primary = join(root, 'primary')
    worktree = join(root, 'worktree')
    mkdirSync(primary, { recursive: true })
    mkdirSync(worktree, { recursive: true })
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    error.mockRestore()
    rmSync(root, { recursive: true, force: true })
  })

  it('symlinks a file from primary into the worktree at the same relative path', async () => {
    writeFileSync(join(primary, '.env'), 'SECRET=1\n')
    await createWorktreeSymlinks(primary, worktree, ['.env'])

    const linkStat = lstatSync(join(worktree, '.env'))
    expect(linkStat.isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(worktree, '.env'))).toBe(join(primary, '.env'))
    // Following the link yields the primary's contents.
    expect(statSync(join(worktree, '.env')).isFile()).toBe(true)
  })

  it('symlinks a directory from primary into the worktree', async () => {
    mkdirSync(join(primary, 'node_modules'))
    writeFileSync(join(primary, 'node_modules', 'marker'), 'installed')
    await createWorktreeSymlinks(primary, worktree, ['node_modules'])

    expect(lstatSync(join(worktree, 'node_modules')).isSymbolicLink()).toBe(true)
    expect(statSync(join(worktree, 'node_modules', 'marker')).isFile()).toBe(true)
  })

  it('creates parent directories lazily for nested paths', async () => {
    mkdirSync(join(primary, 'apps', 'web'), { recursive: true })
    writeFileSync(join(primary, 'apps', 'web', '.env'), 'X=1\n')
    await createWorktreeSymlinks(primary, worktree, ['apps/web/.env'])

    expect(lstatSync(join(worktree, 'apps', 'web', '.env')).isSymbolicLink()).toBe(true)
  })

  it('skips entries whose source is missing in the primary checkout', async () => {
    await createWorktreeSymlinks(primary, worktree, ['node_modules'])
    // No link created, no throw.
    expect(() => lstatSync(join(worktree, 'node_modules'))).toThrow()
    expect(error).not.toHaveBeenCalled()
  })

  it('preserves a pre-existing target in the worktree (no clobber)', async () => {
    writeFileSync(join(primary, '.env'), 'FROM_PRIMARY=1\n')
    writeFileSync(join(worktree, '.env'), 'FROM_WORKTREE=1\n')

    await createWorktreeSymlinks(primary, worktree, ['.env'])

    // The pre-existing regular file stays; no symlink was created.
    expect(lstatSync(join(worktree, '.env')).isSymbolicLink()).toBe(false)
    expect(statSync(join(worktree, '.env')).isFile()).toBe(true)
  })

  it('does not escape the primary checkout via a leading-slash path', async () => {
    // Why: the helper strips leading slashes (so `/etc/passwd` becomes the
    // relative `etc/passwd`). No file is created outside the worktree, and the
    // resolved source — which falls inside `primary/etc/passwd` — is missing,
    // so the entry is silently skipped rather than linking to `/etc/passwd`.
    await createWorktreeSymlinks(primary, worktree, ['/etc/passwd'])

    expect(() => lstatSync(join(worktree, 'etc', 'passwd'))).toThrow()
    expect(error).not.toHaveBeenCalled()
  })

  it('rejects parent-directory traversal', async () => {
    await createWorktreeSymlinks(primary, worktree, ['../secrets'])

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[worktree-symlinks] Skipping unsafe path "../secrets"')
    )
  })

  it('rejects nested traversal via ..', async () => {
    await createWorktreeSymlinks(primary, worktree, ['safe/../../escape'])

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[worktree-symlinks] Skipping unsafe path "safe/../../escape"')
    )
  })

  it('rejects traversal using backslash separators (Windows form)', async () => {
    // Why: users configuring paths on Windows (or pasting a mixed-separator
    // value) could bypass a POSIX-only split. The guard normalizes across
    // `/` and `\` so `..\escape` and `foo\..\..\escape` both get rejected.
    await createWorktreeSymlinks(primary, worktree, ['..\\escape'])
    await createWorktreeSymlinks(primary, worktree, ['foo\\..\\..\\escape'])

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[worktree-symlinks] Skipping unsafe path "..\\escape"')
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[worktree-symlinks] Skipping unsafe path "foo\\..\\..\\escape"')
    )
  })

  it('strips a leading slash then treats the remainder as a relative path', async () => {
    writeFileSync(join(primary, '.env'), 'X=1\n')
    await createWorktreeSymlinks(primary, worktree, ['/.env'])

    // Leading slash is stripped in the helper; the remaining `.env` is a valid relative path.
    expect(lstatSync(join(worktree, '.env')).isSymbolicLink()).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('skips empty and whitespace-only entries', async () => {
    // The helper logs an "unsafe path" warn for these; nothing gets linked.
    await createWorktreeSymlinks(primary, worktree, ['', '   '])
    expect(error).not.toHaveBeenCalled()
  })

  it('continues processing later entries after one fails', async () => {
    writeFileSync(join(primary, '.env'), 'X=1\n')
    writeFileSync(join(primary, 'config.json'), '{}')

    await createWorktreeSymlinks(primary, worktree, [
      '../escape', // rejected
      'missing-source', // no source, skipped
      '.env', // succeeds
      'config.json' // succeeds
    ])

    expect(lstatSync(join(worktree, '.env')).isSymbolicLink()).toBe(true)
    expect(lstatSync(join(worktree, 'config.json')).isSymbolicLink()).toBe(true)
  })

  it('is a no-op for an empty paths list', async () => {
    await createWorktreeSymlinks(primary, worktree, [])
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('symlinks missing children when a tracked directory already exists in the worktree', async () => {
    // Primary has a tracked dir with gitignored subfolders.
    mkdirSync(join(primary, 'data'))
    writeFileSync(join(primary, 'data', '.gitkeep'), '')
    mkdirSync(join(primary, 'data', 'cache'))
    writeFileSync(join(primary, 'data', 'cache', 'file.bin'), 'cached')
    mkdirSync(join(primary, 'data', 'logs'))
    writeFileSync(join(primary, 'data', 'logs', 'app.log'), 'log')

    // Worktree has the tracked dir with only the tracked file (simulating git worktree add).
    mkdirSync(join(worktree, 'data'))
    writeFileSync(join(worktree, 'data', '.gitkeep'), '')

    await createWorktreeSymlinks(primary, worktree, ['data'])

    // The tracked file is untouched (not replaced with a symlink).
    expect(lstatSync(join(worktree, 'data', '.gitkeep')).isSymbolicLink()).toBe(false)
    // The gitignored children are symlinked.
    expect(lstatSync(join(worktree, 'data', 'cache')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(worktree, 'data', 'cache'))).toBe(join(primary, 'data', 'cache'))
    expect(lstatSync(join(worktree, 'data', 'logs')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(worktree, 'data', 'logs'))).toBe(join(primary, 'data', 'logs'))
    // The directory itself is not a symlink.
    expect(lstatSync(join(worktree, 'data')).isSymbolicLink()).toBe(false)
  })
})

describe('removeWorktreeSymlinks', () => {
  let root: string
  let primary: string
  let worktree: string
  let error: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'serper-unlink-'))
    primary = join(root, 'primary')
    worktree = join(root, 'worktree')
    mkdirSync(primary, { recursive: true })
    mkdirSync(worktree, { recursive: true })
    error = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    error.mockRestore()
    rmSync(root, { recursive: true, force: true })
  })

  it('unlinks configured symlinks from the worktree', async () => {
    writeFileSync(join(primary, '.env'), 'SECRET=1\n')
    mkdirSync(join(primary, 'node_modules'))
    symlinkSync(join(primary, '.env'), join(worktree, '.env'), 'file')
    symlinkSync(join(primary, 'node_modules'), join(worktree, 'node_modules'), 'dir')

    await removeWorktreeSymlinks(worktree, ['.env', 'node_modules'])

    expect(existsSync(join(worktree, '.env'))).toBe(false)
    expect(existsSync(join(worktree, 'node_modules'))).toBe(false)
    // Source is untouched.
    expect(statSync(join(primary, '.env')).isFile()).toBe(true)
    expect(statSync(join(primary, 'node_modules')).isDirectory()).toBe(true)
  })

  it('leaves a regular file at the configured path alone', async () => {
    // Why: a user who created a real file at `.env` (instead of symlinking)
    // must not lose it just because `.env` is in the configured list.
    writeFileSync(join(worktree, '.env'), 'USER_WROTE_THIS=1\n')

    await removeWorktreeSymlinks(worktree, ['.env'])

    expect(lstatSync(join(worktree, '.env')).isSymbolicLink()).toBe(false)
    expect(statSync(join(worktree, '.env')).isFile()).toBe(true)
  })

  it('ignores missing entries', async () => {
    await removeWorktreeSymlinks(worktree, ['.env', 'node_modules'])
    expect(error).not.toHaveBeenCalled()
  })

  it('rejects unsafe paths without touching the filesystem', async () => {
    // Parent-dir traversal is silently skipped; no unlink attempted.
    writeFileSync(join(root, 'outside-file'), 'DO_NOT_DELETE')
    await removeWorktreeSymlinks(worktree, ['../outside-file'])
    expect(existsSync(join(root, 'outside-file'))).toBe(true)
  })

  it('is a no-op for an empty paths list', async () => {
    await removeWorktreeSymlinks(worktree, [])
    expect(error).not.toHaveBeenCalled()
  })

  it('removes child symlinks inside a tracked directory', async () => {
    // Simulate a tracked dir with child-level symlinks (as created by the
    // new symlinkMissingChildren behavior).
    mkdirSync(join(primary, 'data'))
    mkdirSync(join(primary, 'data', 'cache'))
    mkdirSync(join(primary, 'data', 'logs'))

    mkdirSync(join(worktree, 'data'))
    writeFileSync(join(worktree, 'data', '.gitkeep'), '')
    symlinkSync(join(primary, 'data', 'cache'), join(worktree, 'data', 'cache'), 'dir')
    symlinkSync(join(primary, 'data', 'logs'), join(worktree, 'data', 'logs'), 'dir')

    await removeWorktreeSymlinks(worktree, ['data'])

    // Child symlinks are removed.
    expect(existsSync(join(worktree, 'data', 'cache'))).toBe(false)
    expect(existsSync(join(worktree, 'data', 'logs'))).toBe(false)
    // Tracked file and directory itself are untouched.
    expect(existsSync(join(worktree, 'data', '.gitkeep'))).toBe(true)
    expect(existsSync(join(worktree, 'data'))).toBe(true)
  })
})
