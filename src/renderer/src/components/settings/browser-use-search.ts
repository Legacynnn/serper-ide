import type { SettingsSearchEntry } from './settings-search'

export const BROWSER_USE_PANE_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  {
    title: 'Enable Serper CLI',
    description: 'Register the serper shell command so agents can drive the browser.',
    keywords: ['browser use', 'cli', 'serper', 'path', 'command', 'shell', 'enable', 'setup']
  },
  {
    title: 'Install Browser Use Skill',
    description: 'Install the serper-cli agent skill so agents know how to use the browser.',
    keywords: [
      'browser use',
      'skill',
      'agent',
      'install',
      'serper-cli',
      'npx',
      'agent-browser',
      'automation'
    ]
  },
  {
    title: 'Import Browser Cookies',
    description:
      'Import cookies from Chrome, Edge, or other browsers so agents can reuse your logins.',
    keywords: [
      'browser use',
      'cookies',
      'session',
      'import',
      'login',
      'auth',
      'chrome',
      'edge',
      'arc',
      'computer use',
      'system browser',
      'existing session',
      'authenticated browser',
      'chrome profile',
      'edge profile',
      'arc profile'
    ]
  }
]
