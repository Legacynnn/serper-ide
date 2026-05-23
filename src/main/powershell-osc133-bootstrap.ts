const POWERSHELL_OSC133_BOOTSTRAP = `# Serper OSC 133 shell integration for PowerShell.
if ((Test-Path variable:global:__SerperOsc133State) -and
    $null -ne $Global:__SerperOsc133State.OriginalPrompt) {
    return
}

if ($ExecutionContext.SessionState.LanguageMode -ne "FullLanguage") {
    return
}

# Profiles have already loaded normally by the time -EncodedCommand runs.
# Wrap the user's final prompt/readline state; do not source profiles here.

# Preserve Windows CJK output by keeping ConPTY on UTF-8 without bypassing
# profile loading or execution-policy checks.
try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
    $OutputEncoding = [Console]::OutputEncoding
} catch { Write-Error $_ -ErrorAction Continue }

# Profiles can re-export user defaults after Serper's spawn env is set.
if ($env:SERPER_OPENCODE_CONFIG_DIR) { $env:OPENCODE_CONFIG_DIR = $env:SERPER_OPENCODE_CONFIG_DIR }
if ($env:SERPER_PI_CODING_AGENT_DIR) { $env:PI_CODING_AGENT_DIR = $env:SERPER_PI_CODING_AGENT_DIR }

$Global:__SerperOsc133State = @{
    OriginalPrompt = $function:prompt
    OriginalReadLine = $function:PSConsoleHostReadLine
    HasSeenPrompt = $false
    HasPSReadLine = $null -ne (Get-Module -Name PSReadLine)
    Esc = [char]27
    Bel = [char]7
}

function Global:prompt {
    # Capture FIRST; any other expression can clobber PowerShell's success bit.
    $fakeExitCode = [int](!$global:?)
    Set-StrictMode -Off
    $result = ""

    # Emit D from prompt, not readline state. Some profile setups bypass
    # PSConsoleHostReadLine; the consumer only needs completion.
    if ($Global:__SerperOsc133State.HasSeenPrompt) {
        $result += "$($Global:__SerperOsc133State.Esc)]133;D;$fakeExitCode$($Global:__SerperOsc133State.Bel)"
    }
    $Global:__SerperOsc133State.HasSeenPrompt = $true

    $result += "$($Global:__SerperOsc133State.Esc)]133;A$($Global:__SerperOsc133State.Bel)"
    # Preserve the previous success/failure value for prompts that inspect it.
    if ($fakeExitCode -ne 0) { Write-Error "failure" -ea ignore }
    $result += $Global:__SerperOsc133State.OriginalPrompt.Invoke()
    $result += "$($Global:__SerperOsc133State.Esc)]133;B$($Global:__SerperOsc133State.Bel)"
    $result
}

if ($Global:__SerperOsc133State.HasPSReadLine -and
    $null -ne $Global:__SerperOsc133State.OriginalReadLine) {
    function Global:PSConsoleHostReadLine {
        $commandLine = $Global:__SerperOsc133State.OriginalReadLine.Invoke()
        [Console]::Write("$($Global:__SerperOsc133State.Esc)]133;C$($Global:__SerperOsc133State.Bel)")
        return $commandLine
    }
}
`

export function getPowerShellOsc133Bootstrap(): string {
  return POWERSHELL_OSC133_BOOTSTRAP
}

export function encodePowerShellCommand(command: string): string {
  return Buffer.from(command, 'utf16le').toString('base64')
}

export function isPowerShellExecutableName(shellName: string): boolean {
  const normalized = shellName.toLowerCase()
  return (
    normalized === 'pwsh' ||
    normalized === 'pwsh.exe' ||
    normalized === 'powershell' ||
    normalized === 'powershell.exe'
  )
}
