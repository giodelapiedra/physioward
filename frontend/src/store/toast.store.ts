import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id:      string
  kind:    ToastKind
  message: string
}

interface ToastState {
  toasts: Toast[]
  show:   (kind: ToastKind, message: string, ttlMs?: number) => void
  dismiss: (id: string) => void
}

const DEFAULT_TTL_MS = 3500

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (kind, message, ttlMs = DEFAULT_TTL_MS) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    set({ toasts: [...get().toasts, { id, kind, message }] })
    if (ttlMs > 0) {
      setTimeout(() => get().dismiss(id), ttlMs)
    }
  },
  dismiss: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),
}))

// Convenience helpers — most callers don't need to grab the hook themselves.
export const toast = {
  success: (msg: string) => useToastStore.getState().show('success', msg),
  error:   (msg: string) => useToastStore.getState().show('error', msg, 5000),
  info:    (msg: string) => useToastStore.getState().show('info', msg),
}
