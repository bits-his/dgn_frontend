import { useState } from 'react'
import { Download, X, Smartphone, Share, PlusSquare, CheckCircle2 } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { Button } from '@/components/ui/button'

export function PwaInstallPrompt() {
  const { isInstallable, isInstalled, isIos, isDismissed, promptInstall, dismissPrompt } =
    usePwaInstall()
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [installing, setInstalling] = useState(false)

  // Don't render if already installed, not installable, or dismissed
  if (isInstalled || !isInstallable || isDismissed) {
    return null
  }

  const handleInstall = async () => {
    if (isIos) {
      setShowIosGuide(true)
      return
    }

    setInstalling(true)
    try {
      await promptInstall()
    } finally {
      setInstalling(false)
    }
  }

  return (
    <>
      {/* Floating PWA Install Banner */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/95 backdrop-blur-md p-4 text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {/* Icon badge */}
              <div className="size-11 rounded-xl bg-gradient-to-br from-violet-600 to-purple-800 p-0.5 shadow-md shrink-0 flex items-center justify-center">
                <img src="/pwa-192x192.png" alt="DGN" className="size-full rounded-[10px] object-cover" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-bold tracking-tight text-zinc-100">
                    Install DGN Factory Control
                  </h4>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    App
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Install for quick factory access, offline caching & standalone full-screen view.
                </p>
              </div>
            </div>

            {/* Close / Dismiss */}
            <button
              onClick={() => dismissPrompt()}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/80 transition-colors shrink-0"
              title="Dismiss"
              aria-label="Dismiss installation prompt"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="mt-3.5 flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissPrompt()}
              className="h-8 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/60"
            >
              Maybe later
            </Button>
            <Button
              size="sm"
              onClick={handleInstall}
              disabled={installing}
              className="h-8 px-3.5 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              {isIos ? (
                <>
                  <Smartphone className="size-3.5" />
                  How to install
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  {installing ? 'Installing…' : 'Install App'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-violet-600/30 text-violet-400 flex items-center justify-center">
                  <Smartphone className="size-4" />
                </div>
                <h3 className="text-sm font-bold">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-zinc-300">
              <div className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-[11px] font-bold">
                  1
                </span>
                <p>
                  In Safari, tap the <strong className="text-white">Share</strong> button{' '}
                  <Share className="inline size-3.5 text-blue-400 mx-1 align-baseline" /> at the bottom of your browser screen.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-[11px] font-bold">
                  2
                </span>
                <p>
                  Scroll down the menu and select{' '}
                  <strong className="text-white">Add to Home Screen</strong>{' '}
                  <PlusSquare className="inline size-3.5 text-zinc-200 mx-1 align-baseline" />.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-[11px] font-bold">
                  3
                </span>
                <p>
                  Tap <strong className="text-white">Add</strong> in the top right corner. The DGN icon will appear on your home screen.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-zinc-800 flex justify-end">
              <Button
                size="sm"
                onClick={() => setShowIosGuide(false)}
                className="w-full h-8 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white"
              >
                <CheckCircle2 className="size-3.5 mr-1.5" />
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
