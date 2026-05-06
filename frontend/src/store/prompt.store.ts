import { create } from 'zustand'

export interface PromptOptions {
  title:         string
  message?:      string
  /** 'text' or 'password' (use 'password' for credentials). */
  inputType?:    'text' | 'password'
  placeholder?:  string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?:  string
  /**
   * Optional validator. Return a string error message to block submit, or
   * null/undefined to allow it. Runs on every input change AND on submit.
   */
  validate?:     (value: string) => string | null | undefined
}

interface PromptRequest extends PromptOptions {
  id:      string
  resolve: (value: string | null) => void
}

interface PromptState {
  current: PromptRequest | null
  ask:     (opts: PromptOptions) => Promise<string | null>
  resolve: (value: string | null) => void
}

export const usePromptStore = create<PromptState>((set, get) => ({
  current: null,

  ask: (opts) =>
    new Promise<string | null>((resolve) => {
      const previous = get().current
      if (previous) previous.resolve(null)

      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      set({ current: { ...opts, id, resolve } })
    }),

  resolve: (value) => {
    const cur = get().current
    if (!cur) return
    cur.resolve(value)
    set({ current: null })
  },
}))

export const promptDialog = {
  ask: (opts: PromptOptions): Promise<string | null> =>
    usePromptStore.getState().ask(opts),
}
