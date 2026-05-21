import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { WorkspaceIcon } from '../workspace-icon/WorkspaceIcon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { useActiveWorktree, useRepoById } from '@/store/selectors'
import { getRepoIdFromWorktreeId } from '../../../../shared/worktree-id'
import { openWorktreePath } from '../sidebar/WorktreeOpenInMenu'
import { EditorIcon } from './editor-icons'

// Why: built-in editor choices that users see without configuring anything in
// Settings. VS Code is the existing default (matches the worktree "Open in"
// submenu, which also hardcodes only VS Code). The rest are included so the
// header surfaces every editor that has a brand glyph — when a user doesn't
// have a given editor installed, the main-process `spawn` fails and surfaces
// the existing "Could not open workspace folder" toast, which is the same
// graceful path that user-defined `openInApplications` already use. `xed` is
// Apple's bundled Xcode CLI; other commands match each editor's standard
// PATH entry. Platform-only editors (Xcode is macOS) stay listed everywhere
// because adding a platform gate would force this file to import platform
// detection just to hide a row that already fails gracefully.
const BUILTIN_EDITOR_CHOICES: EditorChoice[] = [
  { id: 'vscode', label: 'VS Code' },
  { id: 'cursor', label: 'Cursor', command: 'cursor' },
  { id: 'zed', label: 'Zed', command: 'zed' },
  { id: 'windsurf', label: 'Windsurf', command: 'windsurf' },
  { id: 'sublime', label: 'Sublime Text', command: 'subl' },
  { id: 'xcode', label: 'Xcode', command: 'xed' },
  { id: 'kiro', label: 'Kiro', command: 'kiro' }
]
const DEFAULT_EDITOR_ID = 'vscode'

const DEFAULT_EDITOR_STORAGE_KEY = 'orca:workspace-canvas-header:defaultEditorId'

type EditorChoice = {
  id: string
  label: string
  command?: string
}

function readStoredEditorId(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_EDITOR_ID
  }
  try {
    return window.localStorage.getItem(DEFAULT_EDITOR_STORAGE_KEY) ?? DEFAULT_EDITOR_ID
  } catch {
    return DEFAULT_EDITOR_ID
  }
}

function writeStoredEditorId(value: string): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(DEFAULT_EDITOR_STORAGE_KEY, value)
  } catch {
    // Why: localStorage can be disabled (private mode, quota); the header just
    // falls back to the in-memory state for the session.
  }
}

export default function WorkspaceCanvasHeader(): React.JSX.Element | null {
  const activeWorktree = useActiveWorktree()
  const worktreeId = activeWorktree?.id ?? null
  const repoId = worktreeId ? getRepoIdFromWorktreeId(worktreeId) : null
  const repo = useRepoById(repoId)
  const openInApplications = useAppStore((s) => s.settings?.openInApplications ?? [])
  // Why: when these sidebars are closed in workspace view, a floating toggle
  // button overlays the top corners of the canvas. The header reserves
  // equivalent padding on the corresponding side so the breadcrumb and the
  // open-in-editor button don't sit underneath those floating affordances.
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const rightSidebarOpen = useAppStore((s) => s.rightSidebarOpen)

  const editorChoices = useMemo<EditorChoice[]>(
    () => [
      ...BUILTIN_EDITOR_CHOICES,
      ...openInApplications
        .filter((app) => app.command.trim().length > 0)
        .map((app) => ({ id: app.id, label: app.label, command: app.command }))
    ],
    [openInApplications]
  )

  const [selectedEditorId, setSelectedEditorId] = useState<string>(() => readStoredEditorId())

  useEffect(() => {
    // Why: if the user deletes the previously selected editor in Settings,
    // fall back to the built-in default so the button keeps working.
    if (!editorChoices.some((choice) => choice.id === selectedEditorId)) {
      setSelectedEditorId(DEFAULT_EDITOR_ID)
      writeStoredEditorId(DEFAULT_EDITOR_ID)
    }
  }, [editorChoices, selectedEditorId])

  const selectedEditor =
    editorChoices.find((choice) => choice.id === selectedEditorId) ?? editorChoices[0]

  const handleSelectEditor = useCallback((nextId: string) => {
    setSelectedEditorId(nextId)
    writeStoredEditorId(nextId)
  }, [])

  const handleOpen = useCallback(async () => {
    if (!activeWorktree || !selectedEditor) {
      return
    }
    await openWorktreePath({
      target: 'external-editor',
      worktreePath: activeWorktree.path,
      connectionId: repo?.connectionId ?? null,
      command: selectedEditor.command
    })
  }, [activeWorktree, repo?.connectionId, selectedEditor])

  if (!activeWorktree || !repo || !selectedEditor) {
    return null
  }

  return (
    <div
      // Why: the truly empty parts of this strip — the side spacers and the
      // gap between the breadcrumb and the editor split-button — drag the
      // window, matching the macOS hiddenInset titlebar contract. Interactive
      // children below override with `no-drag` so Electron doesn't swallow
      // the pointerdown that Radix relies on for outside-click dismissal of
      // the editor dropdown. Window dragging from the canvas top edge is
      // also available one row lower via TabGroupPanel's 32px tab strip.
      // Why inset shadow over border-b: border-bottom + box-border would
      // shift the content center to y=17.5 and break alignment with the
      // sibling sidebar toggle (see the `.titlebar-left` comment in main.css).
      className="flex h-9 shrink-0 items-center gap-2 bg-card pr-2 shadow-[inset_0_-1px_0_var(--border)]"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Why: when the left sidebar is collapsed, the floating sidebar toggle
          sits in the same band as this header. Reserve its width as left
          padding so the breadcrumb starts to the right of that toggle with a
          clear gap. When the sidebar is open, fall back to a normal 2u gutter
          since the sidebar column itself provides the seam. */}
      <div
        className="shrink-0 self-stretch"
        style={{
          width: sidebarOpen ? '0.5rem' : 'var(--collapsed-sidebar-header-width)'
        }}
        aria-hidden
      />
      <div
        className="flex min-w-0 items-center gap-1.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Why: per-project icon resolved from disk or GitHub, with the folder
            glyph as the fallback. Sized to match the existing 20px slot so the
            breadcrumb baseline stays aligned with the editor button row. */}
        <WorkspaceIcon repoId={repo.id} sizePx={20} />
        <span className="truncate text-[13px] font-medium text-foreground">{repo.displayName}</span>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-[13px] text-muted-foreground">
          {activeWorktree.displayName}
        </span>
      </div>

      {/* Why: explicit filler so the empty middle of the header is a real DOM
          element that inherits the parent's `drag` region — without it, the
          breadcrumb's `flex-1` would consume every empty pixel and leave no
          drag surface between it and the editor button. */}
      <div className="min-w-0 flex-1 self-stretch" aria-hidden />

      <div
        className="flex shrink-0 items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Why: split-button pattern — the main button triggers the action with
            the currently selected editor; the chevron half opens a dropdown
            that ONLY changes which editor is used, not what runs on click.
            Rounded corners are split between halves so the pair reads as one
            control. xs size keeps the chrome compact alongside the breadcrumb. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                void handleOpen()
              }}
              className="rounded-r-none border-r-0 px-1.5"
              aria-label={`Open workspace in ${selectedEditor.label}`}
            >
              <EditorIcon
                id={selectedEditor.id}
                command={selectedEditor.command}
                className="size-3.5"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            Open {activeWorktree.displayName} in {selectedEditor.label}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="xs"
              className="rounded-l-none px-1"
              aria-label="Choose editor"
            >
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4} className="min-w-[12rem]">
            <DropdownMenuLabel>Open workspace in</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={selectedEditorId} onValueChange={handleSelectEditor}>
              {editorChoices.map((choice) => (
                <DropdownMenuRadioItem key={choice.id} value={choice.id}>
                  <EditorIcon
                    id={choice.id}
                    command={choice.command}
                    className="size-3.5 text-muted-foreground"
                  />
                  {choice.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Why: same idea as the left spacer — when the right sidebar is closed,
          a floating toggle button overlays the canvas top-right. Reserve
          equivalent space so the split-button doesn't slide under it. */}
      {!rightSidebarOpen ? (
        <div
          className="shrink-0"
          style={{ width: 'calc(40px + var(--window-controls-width, 0px))' }}
          aria-hidden
        />
      ) : null}
    </div>
  )
}
