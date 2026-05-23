import os from 'os'

import { test, expect } from './helpers/serper-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  UUID_RE,
  execInTerminal,
  waitForActivePanePtyId,
  waitForActiveTerminalManager,
  waitForTerminalOutput
} from './helpers/terminal'

type LocalhostSshTarget = {
  label: string
  host: string
  port: number
  username: string
  configHost?: string
  identityFile?: string
}

const RUN_LOCALHOST_SSH = process.env.SERPER_E2E_SSH_LOCALHOST === '1'
const RUN_REMOTE_HOOKS =
  process.env.SERPER_FEATURE_REMOTE_AGENT_HOOKS === undefined ||
  (process.env.SERPER_FEATURE_REMOTE_AGENT_HOOKS.trim() !== '' &&
    process.env.SERPER_FEATURE_REMOTE_AGENT_HOOKS.trim() !== '0')

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? '22')
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed
  }
  throw new Error(`Invalid SERPER_E2E_SSH_PORT: ${value}`)
}

function currentUsername(): string {
  return (
    process.env.SERPER_E2E_SSH_USER ??
    process.env.USER ??
    process.env.USERNAME ??
    os.userInfo().username
  )
}

function readLocalhostSshTarget(): LocalhostSshTarget {
  const configHost = process.env.SERPER_E2E_SSH_CONFIG_HOST?.trim()
  const host = process.env.SERPER_E2E_SSH_HOST?.trim() ?? (configHost ? '' : '127.0.0.1')
  const identityFile = process.env.SERPER_E2E_SSH_IDENTITY_FILE?.trim()

  return {
    label: `Localhost SSH E2E ${Date.now()}`,
    host,
    port: parsePort(process.env.SERPER_E2E_SSH_PORT),
    username: currentUsername(),
    ...(configHost ? { configHost } : {}),
    ...(identityFile ? { identityFile } : {})
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function marker(name: string): string {
  return `__SERPER_${name}_${Date.now()}__`
}

function emitMarkerCommand(value: string): string {
  const midpoint = Math.floor(value.length / 2)
  return `printf '%s%s\\n' ${shellQuote(value.slice(0, midpoint))} ${shellQuote(
    value.slice(midpoint)
  )}`
}

test.describe('Localhost SSH', () => {
  test.skip(
    !RUN_LOCALHOST_SSH,
    'Set SERPER_E2E_SSH_LOCALHOST=1 to run this local-machine-only SSH E2E test.'
  )
  test.skip(
    !RUN_REMOTE_HOOKS,
    'Unset SERPER_FEATURE_REMOTE_AGENT_HOOKS or set it to 1 so remote PTYs keep pane identity and forward hook events.'
  )
  test.skip(process.platform === 'win32', 'Localhost SSH hook E2E uses POSIX hook scripts.')

  test('routes a terminal and agent-hook status over localhost SSH', async ({
    serperPage,
    testRepoPath
  }) => {
    test.slow()
    await waitForSessionReady(serperPage)
    await waitForActiveWorktree(serperPage)

    const target = readLocalhostSshTarget()
    const remote = await serperPage.evaluate(
      async ({ remotePath, target }) => {
        const store = window.__store
        if (!store) {
          throw new Error('Store unavailable')
        }

        const credentialUnsub = window.api.ssh.onCredentialRequest((request) => {
          void window.api.ssh.submitCredential({ requestId: request.requestId, value: null })
        })

        try {
          const createdTarget = await window.api.ssh.addTarget({
            target: {
              ...target,
              // Why: local-only E2E should not leave a long-lived relay process
              // behind if the Electron app is killed between cleanup hooks.
              relayGracePeriodSeconds: 1
            }
          })

          let state
          try {
            state = await window.api.ssh.connect({ targetId: createdTarget.id })
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            throw new Error(
              `Failed to connect to localhost SSH target ${target.username}@${target.host || target.configHost}:${target.port}. ` +
                `Ensure sshd is running and key/agent auth is non-interactive. ${message}`
            )
          }

          if (!state || state.status !== 'connected') {
            throw new Error(`SSH target did not reach connected state: ${JSON.stringify(state)}`)
          }

          store.getState().setSshConnectionState(createdTarget.id, state)
          const labels = new Map(store.getState().sshTargetLabels)
          labels.set(createdTarget.id, createdTarget.label)
          store.getState().setSshTargetLabels(labels)

          const result = await window.api.repos.addRemote({
            connectionId: createdTarget.id,
            remotePath,
            displayName: 'Localhost SSH E2E'
          })
          if ('error' in result) {
            throw new Error(result.error)
          }

          await store.getState().fetchRepos()
          await store.getState().fetchWorktrees(result.repo.id)

          const worktrees = store.getState().worktreesByRepo[result.repo.id] ?? []
          const worktree =
            worktrees.find((candidate) => candidate.path === result.repo.path) ?? worktrees[0]
          if (!worktree) {
            throw new Error(`No remote worktree found for ${result.repo.path}`)
          }

          store.getState().setActiveWorktree(worktree.id)
          if ((store.getState().tabsByWorktree[worktree.id] ?? []).length === 0) {
            store.getState().createTab(worktree.id)
          }
          store.getState().setActiveTabType('terminal')

          return {
            targetId: createdTarget.id,
            repoId: result.repo.id,
            worktreeId: worktree.id
          }
        } finally {
          credentialUnsub()
        }
      },
      { remotePath: testRepoPath, target }
    )

    await expect(remote.targetId).toBeTruthy()
    await ensureTerminalVisible(serperPage, 30_000)
    await waitForActiveTerminalManager(serperPage, 45_000)
    const ptyId = await waitForActivePanePtyId(serperPage, 45_000)
    const paneKey = await serperPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('Store unavailable')
      }
      const state = store.getState()
      const worktreeId = state.activeWorktreeId
      if (!worktreeId) {
        throw new Error('No active worktree')
      }
      const tabs = state.tabsByWorktree[worktreeId] ?? []
      const tabId =
        state.activeTabType === 'terminal'
          ? state.activeTabId
          : (state.activeTabIdByWorktree?.[worktreeId] ?? tabs[0]?.id)
      if (!tabId) {
        throw new Error('No active terminal tab')
      }
      const manager = window.__paneManagers?.get(tabId)
      const pane = manager?.getActivePane?.() ?? manager?.getPanes?.()[0]
      if (!pane) {
        throw new Error('No active terminal pane')
      }
      return `${tabId}:${pane.leafId}`
    })
    const paneKeyLeafId = paneKey.slice(paneKey.indexOf(':') + 1)
    expect(paneKeyLeafId).toMatch(UUID_RE)

    const terminalMarker = marker('LOCALHOST_SSH')
    await execInTerminal(serperPage, ptyId, emitMarkerCommand(terminalMarker))
    await waitForTerminalOutput(serperPage, terminalMarker, 20_000)

    const envMarker = marker('AGENT_HOOK_ENV_OK')
    const envFailedMarker = marker('AGENT_HOOK_ENV_BAD')
    await execInTerminal(
      serperPage,
      ptyId,
      [
        `if [ "$SERPER_PANE_KEY" = ${shellQuote(paneKey)} ] && [ -n "$SERPER_AGENT_HOOK_PORT" ] && [ -n "$SERPER_AGENT_HOOK_TOKEN" ] && /bin/sh -c 'test -n "$SERPER_PANE_KEY" && test -n "$SERPER_AGENT_HOOK_PORT" && test -n "$SERPER_AGENT_HOOK_TOKEN"'; then`,
        `  ${emitMarkerCommand(envMarker)}`,
        'else',
        '  token_state=${SERPER_AGENT_HOOK_TOKEN:+set}',
        `  printf '%s pane=%s port=%s token=%s endpoint=%s\\n' ${shellQuote(envFailedMarker)} "$SERPER_PANE_KEY" "$SERPER_AGENT_HOOK_PORT" "$token_state" "$SERPER_AGENT_HOOK_ENDPOINT"`,
        'fi'
      ].join('\n')
    )
    await waitForTerminalOutput(serperPage, envMarker, 20_000)

    const pluginOverlayMarker = marker('AGENT_PLUGIN_OVERLAYS_OK')
    const pluginOverlayFailedMarker = marker('AGENT_PLUGIN_OVERLAYS_BAD')
    await execInTerminal(
      serperPage,
      ptyId,
      [
        'opencode_status_file="$OPENCODE_CONFIG_DIR/plugins/serper-opencode-status.js"',
        'pi_status_file="$PI_CODING_AGENT_DIR/extensions/serper-agent-status.ts"',
        'if [ -n "$OPENCODE_CONFIG_DIR" ] && [ -f "$opencode_status_file" ] && [ -n "$PI_CODING_AGENT_DIR" ] && [ -f "$pi_status_file" ]; then',
        `  ${emitMarkerCommand(pluginOverlayMarker)}`,
        'else',
        `  printf '%s opencode=%s opencode_file=%s pi=%s pi_file=%s\\n' ${shellQuote(pluginOverlayFailedMarker)} "$OPENCODE_CONFIG_DIR" "$opencode_status_file" "$PI_CODING_AGENT_DIR" "$pi_status_file"`,
        'fi'
      ].join('\n')
    )
    await waitForTerminalOutput(serperPage, pluginOverlayMarker, 20_000)

    const prompt = `serper ssh e2e prompt ${Date.now()}`
    const hookPostedMarker = marker('AGENT_HOOK_POSTED')
    await execInTerminal(
      serperPage,
      ptyId,
      [
        'if [ -z "$SERPER_AGENT_HOOK_PORT" ] || [ -z "$SERPER_AGENT_HOOK_TOKEN" ] || [ -z "$SERPER_PANE_KEY" ]; then',
        '  echo __SERPER_AGENT_HOOK_ENV_MISSING__',
        'else',
        `  hook_payload=${shellQuote(JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt }))}`,
        '  if curl -sS -X POST "http://127.0.0.1:${SERPER_AGENT_HOOK_PORT}/hook/codex" \\',
        '    -H "Content-Type: application/x-www-form-urlencoded" \\',
        '    -H "X-Serper-Agent-Hook-Token: ${SERPER_AGENT_HOOK_TOKEN}" \\',
        '    --data-urlencode "paneKey=${SERPER_PANE_KEY}" \\',
        '    --data-urlencode "tabId=${SERPER_TAB_ID}" \\',
        '    --data-urlencode "worktreeId=${SERPER_WORKTREE_ID}" \\',
        '    --data-urlencode "env=${SERPER_AGENT_HOOK_ENV}" \\',
        '    --data-urlencode "version=${SERPER_AGENT_HOOK_VERSION}" \\',
        '    --data-urlencode "payload=${hook_payload}" >/dev/null; then',
        `    ${emitMarkerCommand(hookPostedMarker)}`,
        '  fi',
        'fi'
      ].join('\n')
    )
    await waitForTerminalOutput(serperPage, hookPostedMarker, 20_000)

    await expect
      .poll(
        async () =>
          serperPage.evaluate(
            ({ paneKey, prompt, targetId, worktreeId }) => {
              const state = window.__store?.getState()
              const entries = Object.values(state?.agentStatusByPaneKey ?? {})
              return entries.some(
                (entry) =>
                  entry.paneKey === paneKey &&
                  entry.prompt === prompt &&
                  entry.agentType === 'codex' &&
                  entry.state === 'working' &&
                  state?.repos.some((repo) => repo.connectionId === targetId) === true &&
                  Object.values(state?.worktreesByRepo ?? {})
                    .flat()
                    .some((worktree) => worktree.id === worktreeId)
              )
            },
            { paneKey, prompt, targetId: remote.targetId, worktreeId: remote.worktreeId }
          ),
        {
          timeout: 20_000,
          message: 'Remote Codex hook status did not reach the renderer agent-status store'
        }
      )
      .toBe(true)
  })
})
