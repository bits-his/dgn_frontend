import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'dgn_hide_money'
const EVENT_NAME = 'dgn-hide-money'

function readHidden() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function useHideMoney() {
  const [hidden, setHidden] = useState(readHidden)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setHidden(event.newValue === '1')
    }
    const onLocal = (event: Event) => {
      const next = (event as CustomEvent<{ hidden?: boolean }>).detail?.hidden
      if (typeof next === 'boolean') setHidden(next)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(EVENT_NAME, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EVENT_NAME, onLocal)
    }
  }, [])

  const setHiddenPersist = useCallback((next: boolean) => {
    setHidden(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      // ignore quota / private mode
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { hidden: next } }))
  }, [])

  const toggle = useCallback(() => {
    setHiddenPersist(!hidden)
  }, [hidden, setHiddenPersist])

  const maskMoney = useCallback(
    (value: string) => (hidden ? '••••••' : value),
    [hidden],
  )

  return { hidden, toggle, setHidden: setHiddenPersist, maskMoney }
}
