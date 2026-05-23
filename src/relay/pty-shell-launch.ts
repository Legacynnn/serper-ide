import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join } from 'path'

const RELAY_SHELL_READY_DIR = '.serper-relay/shell-ready'
const POSIX_LOGIN_ARGS = ['-l']

export type RelayShellLaunchConfig = {
  args: string[]
  env: Record<string, string>
}

function quotePosixSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function hasOverlayRestoreEnv(env: Record<string, string>): boolean {
  return Boolean(env.SERPER_OPENCODE_CONFIG_DIR || env.SERPER_PI_CODING_AGENT_DIR)
}

function getWrapperRoot(env: Record<string, string>): string {
  return join(env.HOME || process.env.HOME || homedir(), RELAY_SHELL_READY_DIR)
}

function normalizeOriginalZdotdirCandidate(value: string | undefined): string | null {
  if (!value) {
    return null
  }
  const normalized = value.replace(/\/+$/, '')
  if (!normalized || normalized.endsWith('/shell-ready/zsh')) {
    return null
  }
  return value
}

function resolveOriginalZdotdir(env: Record<string, string>): string {
  return (
    normalizeOriginalZdotdirCandidate(env.ZDOTDIR) ||
    normalizeOriginalZdotdirCandidate(env.SERPER_ORIG_ZDOTDIR) ||
    env.HOME ||
    process.env.HOME ||
    ''
  )
}

function ensureOverlayRestoreWrappers(root: string): void {
  const zshDir = join(root, 'zsh')
  const bashDir = join(root, 'bash')

  const zshEnv = `# Serper relay zsh overlay wrapper
export SERPER_ORIG_ZDOTDIR="\${SERPER_ORIG_ZDOTDIR:-$HOME}"
case "\${SERPER_ORIG_ZDOTDIR%/}" in
  */shell-ready/zsh) export SERPER_ORIG_ZDOTDIR="$HOME" ;;
esac
[[ -f "$SERPER_ORIG_ZDOTDIR/.zshenv" ]] && source "$SERPER_ORIG_ZDOTDIR/.zshenv"
export SERPER_USER_ZDOTDIR="\${ZDOTDIR:-\${SERPER_ORIG_ZDOTDIR:-$HOME}}"
case "\${SERPER_USER_ZDOTDIR%/}" in
  */shell-ready/zsh) export SERPER_USER_ZDOTDIR="$HOME" ;;
esac
export ZDOTDIR=${quotePosixSingle(zshDir)}
`
  const zshProfile = `# Serper relay zsh overlay wrapper
_serper_home="\${SERPER_USER_ZDOTDIR:-\${SERPER_ORIG_ZDOTDIR:-$HOME}}"
case "\${_serper_home%/}" in
  */shell-ready/zsh) _serper_home="$HOME" ;;
esac
[[ -f "$_serper_home/.zprofile" ]] && source "$_serper_home/.zprofile"
`
  const zshRc = `# Serper relay zsh overlay wrapper
_serper_home="\${SERPER_USER_ZDOTDIR:-\${SERPER_ORIG_ZDOTDIR:-$HOME}}"
case "\${_serper_home%/}" in
  */shell-ready/zsh) _serper_home="$HOME" ;;
esac
if [[ -o interactive && -f "$_serper_home/.zshrc" ]]; then
  source "$_serper_home/.zshrc"
fi
if [[ ! -o login ]]; then
  # Why: remote startup files can re-export user defaults after relay spawn.
  [[ -n "\${SERPER_OPENCODE_CONFIG_DIR:-}" ]] && export OPENCODE_CONFIG_DIR="\${SERPER_OPENCODE_CONFIG_DIR}"
  [[ -n "\${SERPER_PI_CODING_AGENT_DIR:-}" ]] && export PI_CODING_AGENT_DIR="\${SERPER_PI_CODING_AGENT_DIR}"
fi
`
  const zshLogin = `# Serper relay zsh overlay wrapper
_serper_home="\${SERPER_USER_ZDOTDIR:-\${SERPER_ORIG_ZDOTDIR:-$HOME}}"
case "\${_serper_home%/}" in
  */shell-ready/zsh) _serper_home="$HOME" ;;
esac
if [[ -o interactive && -f "$_serper_home/.zlogin" ]]; then
  source "$_serper_home/.zlogin"
fi
# Why: .zlogin is the final zsh login startup file before the prompt.
[[ -n "\${SERPER_OPENCODE_CONFIG_DIR:-}" ]] && export OPENCODE_CONFIG_DIR="\${SERPER_OPENCODE_CONFIG_DIR}"
[[ -n "\${SERPER_PI_CODING_AGENT_DIR:-}" ]] && export PI_CODING_AGENT_DIR="\${SERPER_PI_CODING_AGENT_DIR}"
`
  const bashRc = `# Serper relay bash overlay wrapper
[[ -f /etc/profile ]] && source /etc/profile
if [[ -f "$HOME/.bash_profile" ]]; then
  source "$HOME/.bash_profile"
elif [[ -f "$HOME/.bash_login" ]]; then
  source "$HOME/.bash_login"
elif [[ -f "$HOME/.profile" ]]; then
  source "$HOME/.profile"
fi
# Why: remote startup files can re-export user defaults after relay spawn.
[[ -n "\${SERPER_OPENCODE_CONFIG_DIR:-}" ]] && export OPENCODE_CONFIG_DIR="\${SERPER_OPENCODE_CONFIG_DIR}"
[[ -n "\${SERPER_PI_CODING_AGENT_DIR:-}" ]] && export PI_CODING_AGENT_DIR="\${SERPER_PI_CODING_AGENT_DIR}"
`

  const files = [
    [join(zshDir, '.zshenv'), zshEnv],
    [join(zshDir, '.zprofile'), zshProfile],
    [join(zshDir, '.zshrc'), zshRc],
    [join(zshDir, '.zlogin'), zshLogin],
    [join(bashDir, 'rcfile'), bashRc]
  ] as const

  for (const [path, content] of files) {
    mkdirSync(dirname(path), { recursive: true })
    let existing: string | null = null
    try {
      existing = readFileSync(path, 'utf8')
    } catch {
      existing = null
    }
    // Why: relay wrapper files persist under ~/.serper-relay across app
    // upgrades. Existence alone is not enough; stale wrappers would miss
    // later fixes such as preserving post-.zshenv ZDOTDIR.
    if (existing !== content) {
      writeFileSync(path, content, 'utf8')
    }
    chmodSync(path, 0o644)
  }
}

export function getRelayShellLaunchConfig(
  shellPath: string,
  env: Record<string, string>
): RelayShellLaunchConfig {
  if (!hasOverlayRestoreEnv(env) || process.platform === 'win32') {
    return { args: POSIX_LOGIN_ARGS, env: {} }
  }

  const shellName = basename(shellPath).toLowerCase()
  if (shellName !== 'zsh' && shellName !== 'bash') {
    return { args: POSIX_LOGIN_ARGS, env: {} }
  }

  const root = getWrapperRoot(env)
  ensureOverlayRestoreWrappers(root)

  if (shellName === 'zsh') {
    return {
      args: POSIX_LOGIN_ARGS,
      env: {
        SERPER_ORIG_ZDOTDIR: resolveOriginalZdotdir(env),
        ZDOTDIR: join(root, 'zsh')
      }
    }
  }

  return {
    args: ['--rcfile', join(root, 'bash', 'rcfile')],
    env: {}
  }
}
