import { useEffect, useState } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'dgn_pwa_install_dismissed_until'
const INSTALLED_KEY = 'dgn_pwa_installed'
const SNOOZE_HOURS = 24

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)
  // Initialise from localStorage so the button never flickers after install
  const [isInstalled, setIsInstalled] = useState(
    () => localStorage.getItem(INSTALLED_KEY) === 'true'
  )
  const [isIos, setIsIos] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if already in standalone / installed mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error - iOS specific standalone flag
      window.navigator.standalone === true

    if (isStandalone) {
      setIsInstalled(true)
      localStorage.setItem(INSTALLED_KEY, 'true')
      return
    }

    // Check if dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISS_KEY)
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setIsDismissed(true)
    }

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(ua)
    const isSafari = /safari/.test(ua) && !/chrome|crios|fxios/.test(ua)
    if (isIosDevice && isSafari && !isStandalone) {
      setIsIos(true)
      setIsInstallable(true)
    }

    // Listen for standard beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      setIsInstallable(true)
    }

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
      setDeferredPrompt(null)
      localStorage.setItem(INSTALLED_KEY, 'true')
      localStorage.removeItem(DISMISS_KEY)
      console.log('[PWA] App successfully installed!')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> => {
    if (isIos) {
      return 'ios'
    }

    if (!deferredPrompt) {
      return 'unavailable'
    }

    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsInstalled(true)
        setIsInstallable(false)
        setDeferredPrompt(null)
        localStorage.setItem(INSTALLED_KEY, 'true')
        return 'accepted'
      } else {
        dismissPrompt(SNOOZE_HOURS)
        return 'dismissed'
      }
    } catch (err) {
      console.warn('[PWA] Prompt error:', err)
      return 'unavailable'
    }
  }

  const dismissPrompt = (hours = SNOOZE_HOURS) => {
    setIsDismissed(true)
    const snoozeTime = Date.now() + hours * 60 * 60 * 1000
    localStorage.setItem(DISMISS_KEY, String(snoozeTime))
  }

  const clearDismissal = () => {
    setIsDismissed(false)
    localStorage.removeItem(DISMISS_KEY)
  }

  return {
    isInstallable,
    isInstalled,
    isIos,
    isDismissed,
    promptInstall,
    dismissPrompt,
    clearDismissal,
  }
}
