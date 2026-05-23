/* eslint-disable max-lines -- Why: the dashboard owns shared board state, drag/drop, and settings callbacks that need one coordinated surface. */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Kanban, LayoutList, Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useAllWorktrees, useRepoMap } from '@/store/selectors'
import RepoDotLabel from '@/components/repo/RepoDotLabel'
import { TitlebarPageControlsPortal } from '@/components/titlebar-page-controls/TitlebarPageControlsPortal'
import SidebarFilter from '@/components/sidebar/SidebarFilter'
import WorkspaceKanbanAreaSelectionOverlay from '@/components/sidebar/WorkspaceKanbanAreaSelectionOverlay'
import WorkspaceKanbanLaneGrid from '@/components/sidebar/WorkspaceKanbanLaneGrid'
import WorkspaceKanbanPinDropTarget from '@/components/sidebar/WorkspaceKanbanPinDropTarget'
import WorkspaceKanbanSettingsMenu from '@/components/sidebar/WorkspaceKanbanSettingsMenu'
import {
  getWorkspaceStatus,
  hasWorkspaceDragData,
  readWorkspaceDragDataIds
} from '@/components/sidebar/workspace-status'
import { useWorkspaceStatusDocumentDrop } from '@/components/sidebar/use-workspace-status-drop'
import { useWorkspaceKanbanAreaSelection } from '@/components/sidebar/use-workspace-kanban-area-selection'
import { useWorkspaceKanbanCardPointerDrag } from '@/components/sidebar/use-workspace-kanban-card-pointer-drag'
import { useWorkspaceKanbanColumnResize } from '@/components/sidebar/use-workspace-kanban-column-resize'
import { useWorkspaceKanbanCreateWorktree } from '@/components/sidebar/use-workspace-kanban-create-worktree'
import { useWorkspaceKanbanSelection } from '@/components/sidebar/use-workspace-kanban-selection'
import { useWorkspaceKanbanShiftWheelScroll } from '@/components/sidebar/use-workspace-kanban-shift-wheel-scroll'
import { useVisibleWorkspaceKanbanWorktreeIds } from '@/components/sidebar/use-visible-workspace-kanban-worktree-ids'
import { groupWorkspaceKanbanWorktrees } from '@/components/sidebar/workspace-kanban-worktree-groups'
import type { WorkspaceStatus } from '../../../../shared/types'
import { makeWorkspaceStatusId } from '../../../../shared/workspace-statuses'

export default function DashboardPage(): React.JSX.Element {
  const allWorktrees = useAllWorktrees()
  const repoMap = useRepoMap()
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const updateWorktreeMeta = useAppStore((s) => s.updateWorktreeMeta)
  const updateWorktreesMeta = useAppStore((s) => s.updateWorktreesMeta)
  const workspaceStatuses = useAppStore((s) => s.workspaceStatuses)
  const setWorkspaceStatuses = useAppStore((s) => s.setWorkspaceStatuses)
  const workspaceBoardOpacity = useAppStore((s) => s.workspaceBoardOpacity)
  const setWorkspaceBoardOpacity = useAppStore((s) => s.setWorkspaceBoardOpacity)
  const workspaceBoardCompact = useAppStore((s) => s.workspaceBoardCompact)
  const setWorkspaceBoardCompact = useAppStore((s) => s.setWorkspaceBoardCompact)
  const workspaceBoardColumnWidth = useAppStore((s) => s.workspaceBoardColumnWidth)
  const setWorkspaceBoardColumnWidth = useAppStore((s) => s.setWorkspaceBoardColumnWidth)
  const closeDashboardPage = useAppStore((s) => s.closeDashboardPage)
  const repos = useAppStore((s) => s.repos)
  const filterRepoIds = useAppStore((s) => s.filterRepoIds)
  const setFilterRepoIds = useAppStore((s) => s.setFilterRepoIds)
  const boardRef = useRef<HTMLDivElement>(null)
  const laneScrollerRef = useRef<HTMLDivElement>(null)
  const areaSelectionOverlayRef = useRef<HTMLDivElement>(null)
  const [dragOverStatus, setDragOverStatus] = useState<WorkspaceStatus | null>(null)
  const [pinDragOver, setPinDragOver] = useState(false)
  const { canCreateWorktree, createWorktreeForStatus } = useWorkspaceKanbanCreateWorktree()
  const visibleWorktreeIdSet = useVisibleWorkspaceKanbanWorktreeIds({
    allWorktrees,
    activeWorktreeId,
    repoMap
  })
  const worktreesByStatus = useMemo(() => {
    return groupWorkspaceKanbanWorktrees({
      worktrees: allWorktrees,
      visibleWorktreeIds: visibleWorktreeIdSet,
      workspaceStatuses
    })
  }, [allWorktrees, visibleWorktreeIdSet, workspaceStatuses])
  const worktreeById = useMemo(
    () => new Map(allWorktrees.map((worktree) => [worktree.id, worktree])),
    [allWorktrees]
  )
  const boardWorktrees = useMemo(
    () => workspaceStatuses.flatMap((status) => worktreesByStatus.get(status.id) ?? []),
    [worktreesByStatus, workspaceStatuses]
  )
  // Why: the kanban hooks gate their work on an `open` flag from the old drawer
  // implementation. On the dashboard page the board is always "open" while the
  // page is mounted, so pass `true` to keep selection, drag, and area-select
  // wired up.
  const isBoardOpen = true
  const {
    selectedWorktreeIds,
    selectedWorktrees,
    selectionAnchorId,
    updateSelectionForGesture,
    updateSelectionForArea,
    selectForContextMenu
  } = useWorkspaceKanbanSelection(isBoardOpen, boardWorktrees)
  const { handleAreaSelectionPointerDown } = useWorkspaceKanbanAreaSelection({
    open: isBoardOpen,
    boardRef,
    overlayRef: areaSelectionOverlayRef,
    selectedWorktreeIds,
    selectionAnchorId,
    updateSelectionForArea
  })
  const { columnWidth, isResizingColumn, onColumnResizeStart, onColumnResizeKeyDown } =
    useWorkspaceKanbanColumnResize(workspaceBoardColumnWidth, setWorkspaceBoardColumnWidth)
  const moveWorktreeToStatus = useCallback(
    (worktreeId: string, status: WorkspaceStatus) => {
      const current = worktreeById.get(worktreeId)
      if (!current || getWorkspaceStatus(current, workspaceStatuses) === status) {
        return
      }
      void updateWorktreeMeta(worktreeId, { workspaceStatus: status })
    },
    [updateWorktreeMeta, workspaceStatuses, worktreeById]
  )
  const moveWorktreesToStatus = useCallback(
    (worktreeIds: readonly string[], status: WorkspaceStatus) => {
      const updates = new Map<string, { workspaceStatus: WorkspaceStatus }>()
      for (const worktreeId of worktreeIds) {
        const current = worktreeById.get(worktreeId)
        if (!current || getWorkspaceStatus(current, workspaceStatuses) === status) {
          continue
        }
        updates.set(worktreeId, { workspaceStatus: status })
      }
      if (updates.size > 0) {
        void updateWorktreesMeta(updates)
      }
    },
    [updateWorktreesMeta, workspaceStatuses, worktreeById]
  )
  const pinWorktree = useCallback(
    (worktreeId: string) => {
      const current = worktreeById.get(worktreeId)
      if (!current || current.isPinned) {
        return
      }
      void updateWorktreeMeta(worktreeId, { isPinned: true })
    },
    [updateWorktreeMeta, worktreeById]
  )

  const pinWorktrees = useCallback(
    (worktreeIds: readonly string[]) => {
      const updates = new Map<string, { isPinned: true }>()
      for (const worktreeId of worktreeIds) {
        const current = worktreeById.get(worktreeId)
        if (!current || current.isPinned) {
          continue
        }
        updates.set(worktreeId, { isPinned: true })
      }
      if (updates.size > 0) {
        void updateWorktreesMeta(updates)
      }
    },
    [updateWorktreesMeta, worktreeById]
  )
  const { isPointerDragActiveRef, onCardPointerDownCapture } = useWorkspaceKanbanCardPointerDrag({
    open: isBoardOpen,
    boardRef,
    selectedWorktreeIds,
    selectedWorktrees,
    onMoveWorktreesToStatus: moveWorktreesToStatus,
    onPinWorktrees: pinWorktrees,
    onDragTargetChange: setDragOverStatus,
    onPinDragTargetChange: setPinDragOver
  })
  const handleDragOver = useCallback((event: React.DragEvent, status: WorkspaceStatus) => {
    if (!hasWorkspaceDragData(event.dataTransfer)) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverStatus(status)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return
    }
    setDragOverStatus(null)
  }, [])

  const handlePinDragOver = useCallback((event: React.DragEvent) => {
    if (!hasWorkspaceDragData(event.dataTransfer)) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setPinDragOver(true)
  }, [])

  const handlePinDragLeave = useCallback((event: React.DragEvent) => {
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return
    }
    setPinDragOver(false)
  }, [])

  const handleDragFinish = useCallback(() => {
    setDragOverStatus(null)
    setPinDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent, status: WorkspaceStatus) => {
      const worktreeIds = readWorkspaceDragDataIds(event.dataTransfer)
      if (worktreeIds.length === 0) {
        return
      }
      event.preventDefault()
      setDragOverStatus(null)
      moveWorktreesToStatus(worktreeIds, status)
    },
    [moveWorktreesToStatus]
  )

  // Why: activating a workspace from the dashboard sends the user to its
  // terminal view. Closing the page records the navigation back to whichever
  // view was active before the dashboard opened.
  const handleWorktreeActivate = useCallback(() => {
    closeDashboardPage()
  }, [closeDashboardPage])

  const handleOpacityChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setWorkspaceBoardOpacity(Number(event.target.value) / 100)
    },
    [setWorkspaceBoardOpacity]
  )

  const handleRenameStatus = useCallback(
    (statusId: string, label: string) => {
      const trimmed = label.trim()
      if (!trimmed) {
        return
      }
      setWorkspaceStatuses(
        workspaceStatuses.map((status) =>
          status.id === statusId ? { ...status, label: trimmed } : status
        )
      )
    },
    [setWorkspaceStatuses, workspaceStatuses]
  )

  const handleChangeStatusColor = useCallback(
    (statusId: string, color: string) => {
      setWorkspaceStatuses(
        workspaceStatuses.map((status) => (status.id === statusId ? { ...status, color } : status))
      )
    },
    [setWorkspaceStatuses, workspaceStatuses]
  )

  const handleChangeStatusIcon = useCallback(
    (statusId: string, icon: string) => {
      setWorkspaceStatuses(
        workspaceStatuses.map((status) => (status.id === statusId ? { ...status, icon } : status))
      )
    },
    [setWorkspaceStatuses, workspaceStatuses]
  )

  const handleMoveStatus = useCallback(
    (statusId: string, direction: -1 | 1) => {
      const index = workspaceStatuses.findIndex((status) => status.id === statusId)
      const nextIndex = index + direction
      if (index === -1 || nextIndex < 0 || nextIndex >= workspaceStatuses.length) {
        return
      }
      const next = [...workspaceStatuses]
      const [moved] = next.splice(index, 1)
      next.splice(nextIndex, 0, moved)
      setWorkspaceStatuses(next)
    },
    [setWorkspaceStatuses, workspaceStatuses]
  )

  const handleAddStatus = useCallback(() => {
    const label = `Status ${workspaceStatuses.length + 1}`
    setWorkspaceStatuses([
      ...workspaceStatuses,
      { id: makeWorkspaceStatusId(label, workspaceStatuses), label }
    ])
  }, [setWorkspaceStatuses, workspaceStatuses])

  const handleRemoveStatus = useCallback(
    (statusId: string) => {
      if (workspaceStatuses.length <= 1) {
        return
      }
      const index = workspaceStatuses.findIndex((status) => status.id === statusId)
      if (index === -1) {
        return
      }
      const next = workspaceStatuses.filter((status) => status.id !== statusId)
      const fallbackStatus = next[Math.min(index, next.length - 1)]?.id ?? next[0]!.id
      setWorkspaceStatuses(next)
      for (const worktree of allWorktrees) {
        if (getWorkspaceStatus(worktree, workspaceStatuses) === statusId) {
          void updateWorktreeMeta(worktree.id, { workspaceStatus: fallbackStatus })
        }
      }
    },
    [allWorktrees, setWorkspaceStatuses, updateWorktreeMeta, workspaceStatuses]
  )

  useWorkspaceStatusDocumentDrop(
    boardRef,
    moveWorktreeToStatus,
    pinWorktree,
    handleDragFinish,
    isBoardOpen,
    {
      onMoveWorktreesToStatus: moveWorktreesToStatus,
      onPinWorktrees: pinWorktrees
    }
  )

  useWorkspaceKanbanShiftWheelScroll(boardRef, laneScrollerRef, isBoardOpen, isPointerDragActiveRef)

  const opacityPercent = Math.round(workspaceBoardOpacity * 100)
  const BoardModeIcon = workspaceBoardCompact ? Rows3 : LayoutList
  const selectedCount = selectedWorktrees.length
  const canFilterRepos = repos.length > 1
  // Why: an empty `filterRepoIds` means "show all", so when nothing is selected
  // every pill should read as active. Once the user picks any repo, only the
  // picked ones light up.
  const selectedRepoIds = useMemo(() => new Set(filterRepoIds), [filterRepoIds])
  const allReposSelected = selectedRepoIds.size === 0
  const handleToggleRepoFilter = useCallback(
    (repoId: string) => {
      if (allReposSelected) {
        // Why: jumping from "all repos" to "only this one" matches what a user
        // expects when they click a chip in the unfiltered state — otherwise
        // the first click would invert the entire list to "everything except".
        setFilterRepoIds([repoId])
        return
      }
      const next = filterRepoIds.includes(repoId)
        ? filterRepoIds.filter((id) => id !== repoId)
        : [...filterRepoIds, repoId]
      setFilterRepoIds(next)
    },
    [allReposSelected, filterRepoIds, setFilterRepoIds]
  )
  const handleClearRepoFilter = useCallback(() => {
    setFilterRepoIds([])
  }, [setFilterRepoIds])

  return (
    <main
      className="relative flex h-full min-h-0 flex-col bg-background text-foreground"
      data-workspace-board-compact={workspaceBoardCompact ? 'true' : 'false'}
    >
      <TitlebarPageControlsPortal>
        <div
          className="flex h-full min-w-0 flex-1 items-center justify-between gap-2 px-3"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Kanban className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.25} />
            <h1 className="truncate text-xs font-semibold">Dashboard</h1>
            {selectedCount > 1 ? (
              <span className="shrink-0 rounded-full bg-sidebar-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {selectedCount} selected
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <SidebarFilter tooltipSide="bottom" contentSide="bottom" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={workspaceBoardCompact ? 'secondary' : 'ghost'}
                  size="icon-xs"
                  aria-pressed={workspaceBoardCompact}
                  aria-label={
                    workspaceBoardCompact ? 'Compact workspace cards' : 'Detailed workspace cards'
                  }
                  onClick={() => setWorkspaceBoardCompact(!workspaceBoardCompact)}
                >
                  <BoardModeIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {workspaceBoardCompact ? 'Show detailed cards' : 'Show compact cards'}
              </TooltipContent>
            </Tooltip>
            <WorkspaceKanbanSettingsMenu
              opacityPercent={opacityPercent}
              workspaceStatuses={workspaceStatuses}
              onOpacityChange={handleOpacityChange}
              onRenameStatus={handleRenameStatus}
              onChangeStatusColor={handleChangeStatusColor}
              onChangeStatusIcon={handleChangeStatusIcon}
              onMoveStatus={handleMoveStatus}
              onRemoveStatus={handleRemoveStatus}
              onAddStatus={handleAddStatus}
            />
          </div>
        </div>
      </TitlebarPageControlsPortal>
      {canFilterRepos ? (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-5 pt-2 pb-2 scrollbar-sleek md:px-8">
          <button
            type="button"
            onClick={handleClearRepoFilter}
            aria-pressed={allReposSelected}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              allReposSelected
                ? 'border-foreground/20 bg-foreground/10 text-foreground'
                : 'border-border/60 bg-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground'
            )}
          >
            All repos
          </button>
          {repos.map((repo) => {
            const checked = !allReposSelected && selectedRepoIds.has(repo.id)
            return (
              <button
                key={repo.id}
                type="button"
                onClick={() => handleToggleRepoFilter(repo.id)}
                aria-pressed={checked}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                  checked
                    ? 'border-foreground/20 bg-foreground/10 text-foreground'
                    : 'border-border/60 bg-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                )}
              >
                <RepoDotLabel name={repo.displayName} color={repo.badgeColor} />
              </button>
            )
          })}
        </div>
      ) : null}
      <div
        ref={boardRef}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3"
        data-workspace-board-selection-surface=""
        onPointerDownCapture={onCardPointerDownCapture}
        onPointerDown={handleAreaSelectionPointerDown}
      >
        <WorkspaceKanbanAreaSelectionOverlay ref={areaSelectionOverlayRef} />
        <WorkspaceKanbanPinDropTarget
          isDragOver={pinDragOver}
          onDragOver={handlePinDragOver}
          onDragLeave={handlePinDragLeave}
        />
        <div
          ref={laneScrollerRef}
          className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden scrollbar-sleek"
        >
          <WorkspaceKanbanLaneGrid
            statuses={workspaceStatuses}
            worktreesByStatus={worktreesByStatus}
            repoMap={repoMap}
            activeWorktreeId={activeWorktreeId}
            compact={workspaceBoardCompact}
            columnWidth={columnWidth}
            isResizingColumn={isResizingColumn}
            dragOverStatus={dragOverStatus}
            canCreateWorktree={canCreateWorktree}
            selectedWorktreeIds={selectedWorktreeIds}
            selectedWorktrees={selectedWorktrees}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onActivate={handleWorktreeActivate}
            onSelectionGesture={updateSelectionForGesture}
            onContextMenuSelect={selectForContextMenu}
            onCreateWorktree={createWorktreeForStatus}
            onColumnResizeStart={onColumnResizeStart}
            onColumnResizeKeyDown={onColumnResizeKeyDown}
          />
        </div>
      </div>
    </main>
  )
}
