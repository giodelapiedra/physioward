import { useEffect, useState } from 'react'

/**
 * Returns a value that only updates after `delayMs` of stable input.
 * Useful for search boxes — avoids hitting the backend on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
