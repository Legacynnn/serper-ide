import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

const AUTOMATION_TARGET_FLAGS = ['repo', 'workspace', 'workspace-mode', 'base-branch']
const AUTOMATION_SCHEDULE_FLAGS = ['trigger', 'schedule', 'time', 'day', 'timezone']
const AUTOMATION_STATE_FLAGS = ['enabled', 'disabled', 'missed-run-grace-minutes']

export const AUTOMATION_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['automations', 'list'],
    summary: 'List scheduled Serper automations',
    usage: 'serper automations list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['serper automations list', 'serper automations list --json']
  },
  {
    path: ['automations', 'show'],
    summary: 'Show one Serper automation',
    usage: 'serper automations show <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['serper automations show 2f9e...', 'serper automations show --id 2f9e... --json']
  },
  {
    path: ['automations', 'create'],
    summary: 'Create a scheduled Serper automation',
    usage:
      'serper automations create --name <name> --trigger <preset|cron|rrule> --prompt <text> --provider <agent> [--repo <selector>|--workspace <selector>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'name',
      'prompt',
      'provider',
      ...AUTOMATION_TARGET_FLAGS,
      ...AUTOMATION_SCHEDULE_FLAGS,
      ...AUTOMATION_STATE_FLAGS
    ],
    notes: [
      'Trigger accepts hourly, daily, weekdays, weekly, a 5-field cron expression, or an RRULE string.',
      'When --repo is omitted, the CLI uses the enclosing Serper worktree when one can be resolved from cwd.',
      'Use --workspace to run in an existing worktree; otherwise the automation creates a new worktree per run.'
    ],
    examples: [
      'serper automations create --name "Daily review" --trigger daily --prompt "Review open changes" --provider codex',
      'serper automations create --name "Weekday triage" --trigger "0 9 * * 1-5" --prompt "Triage issues" --provider claude --repo my-repo'
    ]
  },
  {
    path: ['automations', 'edit'],
    summary: 'Edit an Serper automation',
    usage: 'serper automations edit <id> [--name <name>] [--trigger <preset|cron|rrule>] [--json]',
    allowedFlags: [
      ...GLOBAL_FLAGS,
      'id',
      'name',
      'prompt',
      'provider',
      ...AUTOMATION_TARGET_FLAGS,
      ...AUTOMATION_SCHEDULE_FLAGS,
      ...AUTOMATION_STATE_FLAGS
    ],
    positionalArgs: ['id'],
    examples: [
      'serper automations edit 2f9e... --disabled',
      'serper automations edit --id 2f9e... --trigger "30 * * * *" --json'
    ]
  },
  {
    path: ['automations', 'remove'],
    summary: 'Remove an Serper automation and its run history',
    usage: 'serper automations remove <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['serper automations remove 2f9e...', 'serper automations remove --id 2f9e... --json']
  },
  {
    path: ['automations', 'run'],
    summary: 'Run an Serper automation now',
    usage: 'serper automations run <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    positionalArgs: ['id'],
    examples: ['serper automations run 2f9e...', 'serper automations run --id 2f9e... --json']
  },
  {
    path: ['automations', 'runs'],
    summary: 'List automation run history',
    usage: 'serper automations runs [--id <automation-id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'id'],
    examples: ['serper automations runs', 'serper automations runs --id 2f9e... --json']
  }
]
