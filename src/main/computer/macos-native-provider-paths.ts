import { existsSync } from 'fs'
import { join, resolve } from 'path'

export function resolveMacOSComputerUseAppPath(): string | null {
  const override = process.env.SERPER_COMPUTER_MACOS_HELPER_APP_PATH
  if (override && existsSync(override)) {
    return override
  }

  const packaged = [join(process.resourcesPath ?? '', 'Serper Computer Use.app')]
  const dev = [
    join(process.cwd(), 'native/computer-use-macos/.build/release/Serper Computer Use.app'),
    resolve(__dirname, '../../native/computer-use-macos/.build/release/Serper Computer Use.app')
  ]
  const candidates = process.resourcesPath ? [...packaged, ...dev] : dev

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null
}

export function resolveMacOSComputerUseExecutablePath(): string | null {
  const appPath = resolveMacOSComputerUseAppPath()
  if (!appPath) {
    return null
  }
  const executablePath = join(appPath, 'Contents', 'MacOS', 'serper-computer-use-macos')
  return existsSync(executablePath) ? executablePath : null
}

export function resolveMacOSNativeProviderPath(): string | null {
  const override = process.env.SERPER_COMPUTER_MACOS_PROVIDER_PATH
  if (override && existsSync(override)) {
    return override
  }

  const packaged = [
    join(process.resourcesPath ?? '', 'computer-use-macos/serper-computer-use-macos')
  ]
  const dev = [
    join(process.cwd(), 'native/computer-use-macos/.build/debug/serper-computer-use-macos'),
    join(process.cwd(), 'native/computer-use-macos/.build/release/serper-computer-use-macos'),
    resolve(__dirname, '../../native/computer-use-macos/.build/debug/serper-computer-use-macos')
  ]
  const candidates = process.resourcesPath ? [...packaged, ...dev] : dev

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null
}
