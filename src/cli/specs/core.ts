import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const CORE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['open'],
    summary: 'Launch Serper and wait for the runtime to be reachable',
    usage: 'serper open [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['serper open', 'serper open --json']
  },
  {
    path: ['serve'],
    summary: 'Start an Serper runtime server without opening a desktop window',
    usage:
      'serper serve [--port <port>] [--pairing-address <host>] [--mobile-pairing] [--no-pairing] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'port', 'pairing-address', 'mobile-pairing', 'no-pairing'],
    notes: [
      'Runs in the foreground and prints the runtime endpoint. Stop it with Ctrl+C.',
      'Use --pairing-address when clients should connect through a LAN, Tailscale, SSH-forward, or public tunnel address.',
      'Use --mobile-pairing to print a mobile-scoped pairing QR/link instead of the default runtime-environment pairing link.',
      'When the web client bundle is available, the server also prints a browser URL with the pairing data embedded.'
    ],
    examples: [
      'serper serve',
      'serper serve --json',
      'serper serve --port 6768 --pairing-address 100.64.1.20',
      'serper serve --pairing-address 100.64.1.20 --mobile-pairing'
    ]
  },
  {
    path: ['status'],
    summary: 'Show app/runtime/graph readiness',
    usage: 'serper status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['serper status', 'serper status --json']
  },
  {
    path: ['repo', 'list'],
    summary: 'List repos registered in Serper',
    usage: 'serper repo list [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['repo', 'add'],
    summary: 'Add a project to Serper by filesystem path',
    usage: 'serper repo add --path <path> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'path']
  },
  {
    path: ['repo', 'show'],
    summary: 'Show one registered repo',
    usage: 'serper repo show --repo <selector> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'repo']
  },
  {
    path: ['repo', 'set-base-ref'],
    summary: "Set the repo's default base ref for future worktrees",
    usage: 'serper repo set-base-ref --repo <selector> --ref <ref> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'repo', 'ref']
  },
  {
    path: ['repo', 'search-refs'],
    summary: 'Search branch/tag refs within a repo',
    usage: 'serper repo search-refs --repo <selector> --query <text> [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'repo', 'query', 'limit']
  },
  {
    path: ['worktree', 'list'],
    summary: 'List Serper-managed worktrees',
    usage: 'serper worktree list [--repo <selector>] [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'repo', 'limit']
  },
  {
    path: ['worktree', 'show'],
    summary: 'Show one worktree',
    usage: 'serper worktree show --worktree <selector> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree']
  },
  {
    path: ['worktree', 'current'],
    summary: 'Show the Serper-managed worktree for the current directory',
    usage: 'serper worktree current [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Resolves the current shell directory to a path: selector so agents can target the enclosing Serper worktree without spelling out $PWD.'
    ],
    examples: ['serper worktree current', 'serper worktree current --json']
  },
  {
    path: ['worktree', 'create'],
    summary: 'Create a new Serper-managed worktree',
    usage:
      'serper worktree create --repo <selector> --name <name> [--base-branch <ref>] [--issue <number>] [--comment <text>] [--parent-worktree <selector>] [--no-parent] [--run-hooks] [--activate] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'repo',
      'name',
      'base-branch',
      'issue',
      'comment',
      'parent-worktree',
      'no-parent',
      'run-hooks',
      'activate'
    ],
    notes: [
      'By default, Serper records the new worktree as a child of the caller workspace when it can infer one from the Serper terminal or current directory.',
      'Pass --parent-worktree to choose a parent explicitly, or --no-parent to force no lineage.',
      'By default this creates the worktree and its first terminal without switching the active Serper workspace.',
      'Repo-defined setup hooks follow the repository setup policy; pass --run-hooks to force them.',
      'Pass --activate when the CLI caller intentionally wants to reveal the new worktree in the app.',
      'Passing --run-hooks reveals the worktree so the setup hook can run in its first terminal.'
    ]
  },
  {
    path: ['worktree', 'set'],
    summary: 'Update Serper metadata for a worktree',
    usage:
      'serper worktree set --worktree <selector> [--display-name <name>] [--issue <number|null>] [--comment <text>] [--parent-worktree <selector>|--no-parent] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'worktree',
      'display-name',
      'issue',
      'comment',
      'parent-worktree',
      'no-parent'
    ]
  },
  {
    path: ['worktree', 'rm'],
    summary: 'Remove a worktree from Serper and git',
    usage: 'serper worktree rm --worktree <selector> [--force] [--run-hooks] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'force', 'run-hooks'],
    notes: ['Repo-defined serper.yaml archive hooks are skipped unless --run-hooks is passed.']
  },
  {
    path: ['worktree', 'ps'],
    summary: 'Show a compact orchestration summary across worktrees',
    usage: 'serper worktree ps [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'limit']
  },
  {
    path: ['terminal', 'list'],
    summary: 'List live Serper-managed terminals',
    usage: 'serper terminal list [--worktree <selector>] [--limit <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'limit']
  },
  {
    path: ['terminal', 'show'],
    summary: 'Show terminal metadata and preview',
    usage: 'serper terminal show [--terminal <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal']
  },
  {
    path: ['terminal', 'read'],
    summary: 'Read bounded terminal output',
    usage: 'serper terminal read [--terminal <handle>] [--cursor <n>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal', 'cursor'],
    notes: [
      'Omit --terminal to target the active terminal in the current worktree.',
      'Use --cursor with the nextCursor value from a previous read to get only new output since that read.',
      'Useful for capturing the response to a command: read before sending, then read --cursor <prev> after waiting.'
    ],
    examples: [
      'serper terminal read --json',
      'serper terminal read --terminal term_abc123 --cursor 42 --json'
    ]
  },
  {
    path: ['terminal', 'send'],
    summary: 'Send input to a live terminal',
    usage:
      'serper terminal send [--terminal <handle>] [--text <text>] [--enter] [--interrupt] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal', 'text', 'enter', 'interrupt']
  },
  {
    path: ['terminal', 'wait'],
    summary: 'Wait for a terminal condition',
    usage:
      'serper terminal wait [--terminal <handle>] --for exit|tui-idle [--timeout-ms <ms>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal', 'for', 'timeout-ms']
  },
  {
    path: ['terminal', 'stop'],
    summary: 'Stop terminals for a worktree',
    usage: 'serper terminal stop --worktree <selector> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree']
  },
  {
    path: ['terminal', 'create'],
    summary: 'Create a terminal session in the current worktree',
    usage:
      'serper terminal create [--worktree <selector>] [--title <name>] [--command <text>] [--focus] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'worktree', 'command', 'title', 'focus'],
    notes: [
      'Creates a visible terminal tab without switching focus when possible; falls back to a background handle if the UI cannot adopt it. Pass --focus to switch to it.'
    ],
    examples: [
      'serper terminal create --json',
      'serper terminal create --worktree path:/projects/myapp --title "RUNNER" --command "opencode"',
      'serper terminal create --worktree path:/projects/myapp --command "opencode" --focus'
    ]
  },
  {
    path: ['terminal', 'switch'],
    summary: 'Switch to a terminal tab in the UI',
    usage: 'serper terminal switch [--terminal <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal'],
    examples: ['serper terminal switch --terminal term_abc123']
  },
  {
    path: ['terminal', 'focus'],
    summary: 'Switch to a terminal tab in the UI (alias for terminal switch)',
    usage: 'serper terminal focus [--terminal <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal'],
    examples: ['serper terminal focus --terminal term_abc123']
  },
  {
    path: ['terminal', 'close'],
    summary: 'Close a terminal tab (kills PTY if running)',
    usage: 'serper terminal close [--terminal <handle>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal'],
    examples: ['serper terminal close --terminal term_abc123']
  },
  {
    path: ['terminal', 'rename'],
    summary: 'Set or clear the title of a terminal tab',
    usage: 'serper terminal rename [--terminal <handle>] [--title <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal', 'title'],
    notes: ['Omit --title or pass an empty string to reset to the auto-generated title.'],
    examples: [
      'serper terminal rename --terminal term_abc123 --title "RUNNER"',
      'serper terminal rename --terminal term_abc123 --json'
    ]
  },
  {
    path: ['terminal', 'split'],
    summary: 'Split an existing terminal pane',
    usage:
      'serper terminal split [--terminal <handle>] [--direction horizontal|vertical] [--command <text>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'terminal', 'direction', 'command'],
    examples: [
      'serper terminal split --terminal term_abc123 --direction horizontal --json',
      'serper terminal split --terminal term_abc123 --command "codex"'
    ]
  }
]
