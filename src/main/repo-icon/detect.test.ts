import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { detectWorkspaceIcon, iconMimeType, resolveIconAbsolutePath } from './detect'

describe('detectWorkspaceIcon', () => {
  let repoPath: string

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), 'serper-icon-detect-'))
  })

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true })
  })

  function place(relative: string, content = 'x'): void {
    const absolute = join(repoPath, relative)
    mkdirSync(join(absolute, '..'), { recursive: true })
    writeFileSync(absolute, content)
  }

  it('returns null when no candidate exists', async () => {
    expect(await detectWorkspaceIcon(repoPath)).toBeNull()
  })

  it('picks the highest-priority match (root SVG over PNG)', async () => {
    place('logo.png')
    place('logo.svg')
    const result = await detectWorkspaceIcon(repoPath)
    expect(result?.relativePath).toBe('logo.svg')
  })

  it('matches hyphenated and digit-suffixed names (logo-dark.svg)', async () => {
    place('public/logo-dark.svg')
    const result = await detectWorkspaceIcon(repoPath)
    expect(result?.relativePath).toBe('public/logo-dark.svg')
  })

  it('matches underscore-suffixed names (icon_white.png)', async () => {
    place('assets/icon_white.png')
    const result = await detectWorkspaceIcon(repoPath)
    expect(result?.relativePath).toBe('assets/icon_white.png')
  })

  it('matches digit-suffixed names (icon-512.png)', async () => {
    place('public/icon-512.png')
    const result = await detectWorkspaceIcon(repoPath)
    expect(result?.relativePath).toBe('public/icon-512.png')
  })

  it('does NOT match unrelated stems (logout.png, iconography.svg)', async () => {
    place('public/logout.png')
    place('public/iconography.svg')
    const result = await detectWorkspaceIcon(repoPath)
    expect(result).toBeNull()
  })

  it('prefers exact stem over hyphenated within the same dir/extension', async () => {
    place('public/logo-dark.svg')
    place('public/logo.svg')
    const result = await detectWorkspaceIcon(repoPath)
    expect(result?.relativePath).toBe('public/logo.svg')
  })

  it('prefers logo over icon over favicon at the same priority', async () => {
    place('public/favicon.svg')
    place('public/icon.svg')
    place('public/logo.svg')
    const result = await detectWorkspaceIcon(repoPath)
    expect(result?.relativePath).toBe('public/logo.svg')
  })

  it('falls back to public/ when root has no icon', async () => {
    place('public/favicon.png')
    place('public/logo.png')
    const result = await detectWorkspaceIcon(repoPath)
    // Why: within public/, logo.svg would beat logo.png, but neither logo.svg
    // exists here. The ordered list places `public/logo.png` before
    // `public/favicon.png`, so logo.png wins.
    expect(result?.relativePath).toBe('public/logo.png')
  })

  it('detects Next.js app router icon.png', async () => {
    place('app/icon.png')
    const result = await detectWorkspaceIcon(repoPath)
    expect(result?.relativePath).toBe('app/icon.png')
  })

  it('ignores empty files', async () => {
    place('logo.svg', '')
    expect(await detectWorkspaceIcon(repoPath)).toBeNull()
  })

  it('does not crash on a missing repo path', async () => {
    const result = await detectWorkspaceIcon(join(repoPath, 'does-not-exist'))
    expect(result).toBeNull()
  })
})

describe('iconMimeType', () => {
  it('maps the supported extensions', () => {
    expect(iconMimeType('logo.svg')).toBe('image/svg+xml')
    expect(iconMimeType('logo.PNG')).toBe('image/png')
    expect(iconMimeType('logo.jpg')).toBe('image/jpeg')
    expect(iconMimeType('logo.jpeg')).toBe('image/jpeg')
    expect(iconMimeType('logo.webp')).toBe('image/webp')
    expect(iconMimeType('logo.gif')).toBe('image/gif')
    expect(iconMimeType('favicon.ico')).toBe('image/x-icon')
  })

  it('returns null for unsupported types', () => {
    expect(iconMimeType('logo.bmp')).toBeNull()
    expect(iconMimeType('logo')).toBeNull()
    expect(iconMimeType('logo.tif')).toBeNull()
  })
})

describe('resolveIconAbsolutePath', () => {
  it('returns the iconPath unchanged when absolute', () => {
    expect(resolveIconAbsolutePath('/repo', '/somewhere/else/logo.png')).toBe(
      '/somewhere/else/logo.png'
    )
  })

  it('joins repo-relative paths under the repo root', () => {
    expect(resolveIconAbsolutePath('/repo', 'public/logo.svg')).toBe('/repo/public/logo.svg')
  })
})
