import React from 'react'
import { cn } from '@/lib/utils'
import type { FileIconSpec } from '@/lib/file-type-icons'

type FileTypeIconProps = {
  spec: FileIconSpec
  className?: string
}

/**
 * Renders a file-type icon inside a 12px slot. Brand-mark icons (simple-icons)
 * are scaled to 10px so they visually match Lucide glyphs, which carry more
 * internal padding. Test files get a 4px corner dot to mark them.
 */
export function FileTypeIcon({ spec, className }: FileTypeIconProps): React.JSX.Element {
  const { Icon, isTest, isBrand } = spec
  const iconClass = cn(isBrand ? 'size-2.5' : 'size-3', 'text-muted-foreground', className)
  if (!isTest) {
    return (
      <span className="inline-flex size-3 shrink-0 items-center justify-center">
        <Icon className={iconClass} />
      </span>
    )
  }
  return (
    <span className="relative inline-flex size-3 shrink-0 items-center justify-center">
      <Icon className={iconClass} />
      <span
        aria-hidden
        className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-current ring-1 ring-background"
      />
    </span>
  )
}
