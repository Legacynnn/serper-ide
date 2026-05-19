import type { StateCreator } from 'zustand'
import type { AppState } from '../types'

export type IntegratedTerminalSlice = {
  integratedTerminalOpen: boolean
  setIntegratedTerminalOpen: (open: boolean) => void
  toggleIntegratedTerminal: () => void
}

export const createIntegratedTerminalSlice: StateCreator<
  AppState,
  [],
  [],
  IntegratedTerminalSlice
> = (set, get) => ({
  integratedTerminalOpen: false,
  setIntegratedTerminalOpen: (open) => set({ integratedTerminalOpen: open }),
  toggleIntegratedTerminal: () => set({ integratedTerminalOpen: !get().integratedTerminalOpen })
})
