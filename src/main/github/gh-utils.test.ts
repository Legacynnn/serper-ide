import { beforeEach, describe, expect, it, vi } from 'vitest'

const { gitExecFileAsyncMock, getSshGitProviderMock } = vi.hoisted(() => ({
  gitExecFileAsyncMock: vi.fn(),
  getSshGitProviderMock: vi.fn()
}))

vi.mock('../git/runner', () => ({
  gitExecFileAsync: gitExecFileAsyncMock,
  ghExecFileAsync: vi.fn()
}))

vi.mock('../providers/ssh-git-dispatch', () => ({
  getSshGitProvider: getSshGitProviderMock
}))

import {
  _resetOwnerRepoCache,
  classifyGhError,
  classifyListIssuesError,
  getIssueOwnerRepo,
  getOwnerRepo,
  getOwnerRepoForRemote,
  parseGitHubRemoteIdentity,
  parseGitHubOwnerRepo,
  resolvePRRepositoryCandidates,
  resolveIssueSource
} from './gh-utils'

describe('github owner/repo resolution', () => {
  beforeEach(() => {
    gitExecFileAsyncMock.mockReset()
    getSshGitProviderMock.mockReset()
    _resetOwnerRepoCache()
  })

  it('parses GitHub HTTPS and SSH remotes', () => {
    expect(parseGitHubOwnerRepo('https://github.com/acme/widgets.git')).toEqual({
      owner: 'acme',
      repo: 'widgets'
    })
    expect(parseGitHubOwnerRepo('git@github.com:Legacynnn/serper.git')).toEqual({
      owner: 'Legacynnn',
      repo: 'serper'
    })
    expect(parseGitHubOwnerRepo('git@github.com:TheBoredTeam/boring.notch.git')).toEqual({
      owner: 'TheBoredTeam',
      repo: 'boring.notch'
    })
    expect(parseGitHubOwnerRepo('git@example.com:Legacynnn/serper.git')).toBeNull()
  })

  it('parses GitHub Enterprise host identity', () => {
    expect(parseGitHubRemoteIdentity('https://ghe.acme.internal/acme/serper.git')).toEqual({
      host: 'ghe.acme.internal',
      owner: 'acme',
      repo: 'serper'
    })
    expect(parseGitHubRemoteIdentity('git@ghe.acme.internal:acme/serper.git')).toEqual({
      host: 'ghe.acme.internal',
      owner: 'acme',
      repo: 'serper'
    })
    expect(parseGitHubOwnerRepo('https://ghe.acme.internal/acme/serper.git')).toBeNull()
  })

  it('keeps getOwnerRepo origin-based', async () => {
    gitExecFileAsyncMock.mockResolvedValueOnce({
      stdout: 'git@github.com:fork/serper.git\n'
    })

    await expect(getOwnerRepo('/repo')).resolves.toEqual({ owner: 'fork', repo: 'serper' })
    expect(gitExecFileAsyncMock).toHaveBeenCalledWith(['remote', 'get-url', 'origin'], {
      cwd: '/repo'
    })
  })

  it('prefers upstream for issue owner/repo resolution', async () => {
    gitExecFileAsyncMock.mockResolvedValueOnce({
      stdout: 'git@github.com:Legacynnn/serper.git\n'
    })

    await expect(getIssueOwnerRepo('/repo')).resolves.toEqual({
      owner: 'Legacynnn',
      repo: 'serper'
    })
    expect(gitExecFileAsyncMock).toHaveBeenCalledWith(['remote', 'get-url', 'upstream'], {
      cwd: '/repo'
    })
  })

  it('falls back to origin when upstream is missing or non-GitHub', async () => {
    gitExecFileAsyncMock
      .mockResolvedValueOnce({ stdout: 'git@example.com:Legacynnn/serper.git\n' })
      .mockResolvedValueOnce({ stdout: 'git@github.com:fork/serper.git\n' })

    await expect(getIssueOwnerRepo('/repo')).resolves.toEqual({ owner: 'fork', repo: 'serper' })
    expect(gitExecFileAsyncMock).toHaveBeenNthCalledWith(1, ['remote', 'get-url', 'upstream'], {
      cwd: '/repo'
    })
    expect(gitExecFileAsyncMock).toHaveBeenNthCalledWith(2, ['remote', 'get-url', 'origin'], {
      cwd: '/repo'
    })
  })

  it('does not mix origin and upstream cache entries for the same repo path', async () => {
    gitExecFileAsyncMock
      .mockResolvedValueOnce({ stdout: 'git@github.com:fork/serper.git\n' })
      .mockResolvedValueOnce({ stdout: 'git@github.com:Legacynnn/serper.git\n' })

    await expect(getOwnerRepo('/repo')).resolves.toEqual({ owner: 'fork', repo: 'serper' })
    await expect(getIssueOwnerRepo('/repo')).resolves.toEqual({
      owner: 'Legacynnn',
      repo: 'serper'
    })
  })

  it('resolves SSH repo remotes through the registered SSH git provider', async () => {
    const sshProvider = {
      exec: vi
        .fn()
        .mockResolvedValue({ stdout: 'git@github.com:Legacynnn/serper.git\n', stderr: '' })
    }
    getSshGitProviderMock.mockReturnValue(sshProvider)

    await expect(getOwnerRepo('/home/user/serper', 'openclaw-2')).resolves.toEqual({
      owner: 'Legacynnn',
      repo: 'serper'
    })

    expect(gitExecFileAsyncMock).not.toHaveBeenCalled()
    expect(getSshGitProviderMock).toHaveBeenCalledWith('openclaw-2')
    expect(sshProvider.exec).toHaveBeenCalledWith(
      ['remote', 'get-url', 'origin'],
      '/home/user/serper'
    )
  })

  it('keeps local and SSH owner/repo cache entries separate for the same path', async () => {
    const sshProvider = {
      exec: vi.fn().mockResolvedValue({ stdout: 'git@github.com:remote/serper.git\n', stderr: '' })
    }
    gitExecFileAsyncMock.mockResolvedValueOnce({ stdout: 'git@github.com:local/serper.git\n' })
    getSshGitProviderMock.mockReturnValue(sshProvider)

    await expect(getOwnerRepo('/repo')).resolves.toEqual({ owner: 'local', repo: 'serper' })
    await expect(getOwnerRepo('/repo', 'ssh-1')).resolves.toEqual({
      owner: 'remote',
      repo: 'serper'
    })
  })

  it('resolves PR candidates as upstream then origin and de-dupes matching slugs', async () => {
    gitExecFileAsyncMock
      .mockResolvedValueOnce({ stdout: 'git@github.com:Acme/Serper.git\n' })
      .mockResolvedValueOnce({ stdout: 'git@github.com:acme/serper.git\n' })

    await expect(resolvePRRepositoryCandidates('/repo')).resolves.toEqual({
      candidates: [{ owner: 'Acme', repo: 'Serper' }],
      headRepo: { owner: 'acme', repo: 'serper' }
    })
  })

  it('ignores non-GitHub upstream while keeping origin as the head repo', async () => {
    gitExecFileAsyncMock
      .mockResolvedValueOnce({ stdout: 'git@example.com:Acme/Serper.git\n' })
      .mockResolvedValueOnce({ stdout: 'git@github.com:fork/serper.git\n' })

    await expect(resolvePRRepositoryCandidates('/repo')).resolves.toEqual({
      candidates: [{ owner: 'fork', repo: 'serper' }],
      headRepo: { owner: 'fork', repo: 'serper' }
    })
  })

  it('expires cached remote owner/repo entries after the TTL', async () => {
    vi.useFakeTimers()
    try {
      gitExecFileAsyncMock
        .mockResolvedValueOnce({ stdout: 'git@github.com:old/serper.git\n' })
        .mockResolvedValueOnce({ stdout: 'git@github.com:new/serper.git\n' })

      await expect(getOwnerRepoForRemote('/repo', 'origin')).resolves.toEqual({
        owner: 'old',
        repo: 'serper'
      })
      await expect(getOwnerRepoForRemote('/repo', 'origin')).resolves.toEqual({
        owner: 'old',
        repo: 'serper'
      })
      expect(gitExecFileAsyncMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(30_001)

      await expect(getOwnerRepoForRemote('/repo', 'origin')).resolves.toEqual({
        owner: 'new',
        repo: 'serper'
      })
      expect(gitExecFileAsyncMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('resolveIssueSource', () => {
  beforeEach(() => {
    gitExecFileAsyncMock.mockReset()
    getSshGitProviderMock.mockReset()
    _resetOwnerRepoCache()
  })

  it("'auto' + upstream exists → upstream, fellBack=false", async () => {
    gitExecFileAsyncMock.mockResolvedValueOnce({
      stdout: 'git@github.com:Legacynnn/serper.git\n'
    })

    await expect(resolveIssueSource('/repo', 'auto')).resolves.toEqual({
      source: { owner: 'Legacynnn', repo: 'serper' },
      fellBack: false
    })
  })

  it("'auto' + no upstream → origin, fellBack=false", async () => {
    gitExecFileAsyncMock
      .mockResolvedValueOnce({ stdout: 'git@example.com:Legacynnn/serper.git\n' })
      .mockResolvedValueOnce({ stdout: 'git@github.com:solo/serper.git\n' })

    await expect(resolveIssueSource('/repo', 'auto')).resolves.toEqual({
      source: { owner: 'solo', repo: 'serper' },
      fellBack: false
    })
  })

  it("'upstream' + upstream exists → upstream, fellBack=false", async () => {
    gitExecFileAsyncMock.mockResolvedValueOnce({
      stdout: 'git@github.com:Legacynnn/serper.git\n'
    })

    await expect(resolveIssueSource('/repo', 'upstream')).resolves.toEqual({
      source: { owner: 'Legacynnn', repo: 'serper' },
      fellBack: false
    })
  })

  it("'upstream' + no upstream remote → origin, fellBack=true", async () => {
    // No upstream remote configured — the first call fails.
    gitExecFileAsyncMock
      .mockRejectedValueOnce(new Error('fatal: No such remote'))
      .mockResolvedValueOnce({ stdout: 'git@github.com:solo/serper.git\n' })

    await expect(resolveIssueSource('/repo', 'upstream')).resolves.toEqual({
      source: { owner: 'solo', repo: 'serper' },
      fellBack: true
    })
  })

  it("'origin' + upstream exists → origin (ignores upstream), fellBack=false", async () => {
    // Only one gh call should happen — origin. Upstream is never consulted.
    gitExecFileAsyncMock.mockResolvedValueOnce({
      stdout: 'git@github.com:fork/serper.git\n'
    })

    await expect(resolveIssueSource('/repo', 'origin')).resolves.toEqual({
      source: { owner: 'fork', repo: 'serper' },
      fellBack: false
    })
    expect(gitExecFileAsyncMock).toHaveBeenCalledTimes(1)
    expect(gitExecFileAsyncMock).toHaveBeenCalledWith(['remote', 'get-url', 'origin'], {
      cwd: '/repo'
    })
  })

  it("'origin' + no upstream → origin, fellBack=false", async () => {
    gitExecFileAsyncMock.mockResolvedValueOnce({
      stdout: 'git@github.com:solo/serper.git\n'
    })

    await expect(resolveIssueSource('/repo', 'origin')).resolves.toEqual({
      source: { owner: 'solo', repo: 'serper' },
      fellBack: false
    })
  })

  it('undefined preference is treated identically to auto', async () => {
    gitExecFileAsyncMock.mockResolvedValueOnce({
      stdout: 'git@github.com:Legacynnn/serper.git\n'
    })

    await expect(resolveIssueSource('/repo', undefined)).resolves.toEqual({
      source: { owner: 'Legacynnn', repo: 'serper' },
      fellBack: false
    })
  })
})

describe('gh error classification', () => {
  // Why: a fork with Issues turned off triggers `gh issue list` stderr
  // "the '<slug>' repository has disabled issues". Without a dedicated branch
  // the raw "Command failed: gh issue list …" line leaks into the Tasks banner
  // via the `unknown` fallback — which is what users see when they flip the
  // per-repo selector to an origin fork that has issues disabled.
  it('classifies "has disabled issues" stderr as issues_disabled', () => {
    const stderr =
      "Command failed: gh issue list --limit 36 --json number,title,state --repo brennanb2025/serper --state open\nthe 'brennanb2025/serper' repository has disabled issues"
    expect(classifyGhError(stderr)).toEqual({
      type: 'issues_disabled',
      message: 'Issues are disabled on this repository.'
    })
    expect(classifyListIssuesError(stderr)).toEqual({
      type: 'issues_disabled',
      message: 'Issues are disabled on this repository.'
    })
  })
})
