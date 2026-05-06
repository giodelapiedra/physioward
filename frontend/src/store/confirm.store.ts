import { create } from 'zustand'

export interface ConfirmOptions {
  title:         string
  message:       string
  confirmLabel?: string
  cancelLabel?:  string
  /** Renders the confirm button in red and uses a danger icon. */
  destructive?:  boolean
}

interface ConfirmRequest extends ConfirmOptions {
  id:      string
  resolve: (ok: boolean) => void
}

interface ConfirmState {
  current: ConfirmRequest | null
  ask:     (opts: ConfirmOptions) => Promise<boolean>
  resolve: (ok: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  current: null,

  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      // If a previous dialog is still open, auto-cancel it. In practice the
      // user can't trigger two simultaneously, but this keeps state sane.
      const previous = get().current
      if (previous) previous.resolve(false)

      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      set({ current: { ...opts, id, resolve } })
    }),

  resolve: (ok) => {
    const cur = get().current
    if (!cur) return
    cur.resolve(ok)
    set({ current: null })
  },
}))

// Convenience: keeps callsites short.
export const confirmDialog = {
  ask: (opts: ConfirmOptions): Promise<boolean> =>
    useConfirmStore.getState().ask(opts),

  destructive: (opts: Omit<ConfirmOptions, 'destructive'>): Promise<boolean> =>
    useConfirmStore.getState().ask({ ...opts, destructive: true }),
}
