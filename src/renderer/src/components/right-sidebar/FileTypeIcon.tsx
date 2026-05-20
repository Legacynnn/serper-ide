import React from 'react'
import { cn } from '@/lib/utils'
import type { FileIconSpec } from '@/lib/file-type-icons'

type FileTypeIconProps = {
  spec: FileIconSpec
  className?: string
}

/**
 * Renders a file-type icon at the explorer's 12px size. When the spec is
 * flagged as a test file, overlays a small currentColor dot in the bottom-
 * right so the language remains identifiable while signalling "test".
 */
export function FileTypeIcon({ spec, className }: FileTypeIconProps): React.JSX.Element {
  const { Icon, isTest } = spec
  if (!isTest) {
    return <Icon className={cn('size-3 shrink-0 text-muted-foreground', className)} />
  }
  return (
    <span className="relative inline-flex size-3 shrink-0 items-center justify-center">
      <Icon className={cn('size-3 text-muted-foreground', className)} />
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-current ring-1 ring-background"
      />
    </span>
  )
}
