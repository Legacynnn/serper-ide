import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export const TITLEBAR_PAGE_CONTROLS_DOM_ID = 'titlebar-page-controls'

// Why: full-page nav surfaces (Dashboard, Tasks, Automations) render their
// title row into the 36px app titlebar so the page doesn't ship a redundant
// second header below an otherwise empty titlebar. The target div is mounted
// by App.tsx when activeView matches one of those surfaces; pages portal into
// it from inside their own component so their local state and handlers stay
// co-located with the rest of the page.
export function TitlebarPageControlsPortal({
  children
}: {
  children: ReactNode
}): React.ReactPortal | null {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setTarget(document.getElementById(TITLEBAR_PAGE_CONTROLS_DOM_ID))
  }, [])
  if (!target) {
    return null
  }
  return createPortal(children, target)
}
