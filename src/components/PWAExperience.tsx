import { Download, Share2, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type InstallChoice = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

interface DeferredInstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

const INSTALL_DISMISS_KEY = 'rv-pwa-install-dismissed-at'
const AUTO_UPDATE_ATTEMPT_KEY = 'rv-pwa-auto-update-attempt'
const INSTALL_DISMISS_DAYS = 3
const UPDATE_CHECK_INTERVAL = 60 * 1000
const SAME_VERSION_RETRY_DELAY = 10 * 60 * 1000

function isStandaloneMode() {
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  )

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    iosStandalone
  )
}

function isIosSafari() {
  const agent = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(agent)
  const alternateBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(agent)

  return ios && !alternateBrowser
}

function normalizeAssetUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    return `${url.pathname}${url.search}`
  } catch {
    return value
  }
}

function getAssetSignature(documentToRead: Document) {
  const modules = Array.from(
    documentToRead.querySelectorAll<HTMLScriptElement>(
      'script[type="module"][src]',
    ),
  ).map((item) => normalizeAssetUrl(item.getAttribute('src') || ''))

  const styles = Array.from(
    documentToRead.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"][href]',
    ),
  ).map((item) => normalizeAssetUrl(item.getAttribute('href') || ''))

  return [...modules, ...styles].filter(Boolean).sort().join('|')
}

function installWasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISS_KEY)
    if (!raw) return false

    const dismissedAt = Number(raw)

    return (
      Date.now() - dismissedAt <
      INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000
    )
  } catch {
    return false
  }
}

function rememberInstallDismissal() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()))
  } catch {
    // Sem impacto no funcionamento.
  }
}

function readLastUpdateAttempt(): {
  signature: string
  attemptedAt: number
} | null {
  try {
    const raw = sessionStorage.getItem(AUTO_UPDATE_ATTEMPT_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as {
      signature?: string
      attemptedAt?: number
    }

    if (!parsed.signature || !parsed.attemptedAt) return null

    return {
      signature: parsed.signature,
      attemptedAt: parsed.attemptedAt,
    }
  } catch {
    return null
  }
}

function rememberUpdateAttempt(signature: string) {
  try {
    sessionStorage.setItem(
      AUTO_UPDATE_ATTEMPT_KEY,
      JSON.stringify({
        signature,
        attemptedAt: Date.now(),
      }),
    )
  } catch {
    // Sem impacto crítico.
  }
}

function clearUpdateAttempt() {
  try {
    sessionStorage.removeItem(AUTO_UPDATE_ATTEMPT_KEY)
  } catch {
    // Sem impacto.
  }
}

function isEditingForm() {
  const element = document.activeElement

  if (!element) return false

  return Boolean(
    element.closest(
      'input, textarea, select, [contenteditable="true"]',
    ),
  )
}

function cleanUpdateParams() {
  const url = new URL(window.location.href)
  let changed = false

  for (const key of ['rv_update', 'rv_sw']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }

  if (changed) {
    window.history.replaceState(
      {},
      document.title,
      `${url.pathname}${url.search}${url.hash}`,
    )
  }
}

export default function PWAExperience() {
  const [installPrompt, setInstallPrompt] =
    useState<DeferredInstallPrompt | null>(null)
  const [standalone, setStandalone] = useState(isStandaloneMode)
  const [showIosInstall, setShowIosInstall] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  const currentSignatureRef = useRef('')
  const checkingRef = useRef(false)
  const updatingRef = useRef(false)
  const pendingSignatureRef = useRef('')
  const lastCheckAtRef = useRef(0)

  useEffect(() => {
    currentSignatureRef.current = getAssetSignature(document)
    cleanUpdateParams()

    const lastAttempt = readLastUpdateAttempt()

    if (
      lastAttempt &&
      lastAttempt.signature === currentSignatureRef.current
    ) {
      clearUpdateAttempt()
    }
  }, [])

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const refreshStandalone = () => setStandalone(isStandaloneMode())

    displayMode.addEventListener?.('change', refreshStandalone)
    window.addEventListener('appinstalled', refreshStandalone)

    return () => {
      displayMode.removeEventListener?.('change', refreshStandalone)
      window.removeEventListener('appinstalled', refreshStandalone)
    }
  }, [])

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault()

      if (isStandaloneMode() || installWasRecentlyDismissed()) return

      setInstallPrompt(event as DeferredInstallPrompt)
    }

    function onInstalled() {
      setInstallPrompt(null)
      setShowIosInstall(false)
      setStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    const iosTimer = window.setTimeout(() => {
      if (
        isIosSafari() &&
        !isStandaloneMode() &&
        !installWasRecentlyDismissed()
      ) {
        setShowIosInstall(true)
      }
    }, 1800)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      window.clearTimeout(iosTimer)
    }
  }, [])

  useEffect(() => {
    function onOnline() {
      setOnline(true)
    }

    function onOffline() {
      setOnline(false)
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    function isFormControl(element: Element | null) {
      if (!element) return false

      return Boolean(
        element.closest(
          'input, textarea, select, [contenteditable="true"]',
        ),
      )
    }

    function onFocusIn(event: FocusEvent) {
      if (isFormControl(event.target as Element | null)) {
        document.documentElement.classList.add('rvKeyboardOpen')
      }
    }

    function onFocusOut() {
      window.setTimeout(() => {
        if (!isFormControl(document.activeElement)) {
          document.documentElement.classList.remove('rvKeyboardOpen')
        }
      }, 80)
    }

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.documentElement.classList.remove('rvKeyboardOpen')
    }
  }, [])

  useEffect(() => {
    async function applyUpdate(signature: string) {
      if (updatingRef.current) return

      const lastAttempt = readLastUpdateAttempt()

      if (
        lastAttempt?.signature === signature &&
        Date.now() - lastAttempt.attemptedAt < SAME_VERSION_RETRY_DELAY
      ) {
        return
      }

      if (isEditingForm()) {
        pendingSignatureRef.current = signature
        return
      }

      updatingRef.current = true
      rememberUpdateAttempt(signature)

      try {
        if ('serviceWorker' in navigator) {
          const registration =
            await navigator.serviceWorker.getRegistration()

          await registration?.update().catch(() => undefined)

          if (registration?.waiting) {
            registration.waiting.postMessage({
              type: 'SKIP_WAITING',
            })

            // O SW novo assume a aba e também força a navegação.
            return
          }
        }

        if ('caches' in window) {
          const cacheNames = await caches.keys()

          await Promise.all(
            cacheNames
              .filter((name) =>
                name.startsWith('rv-fisiologia-pwa-'),
              )
              .map((name) => caches.delete(name)),
          )
        }
      } catch {
        // O reload abaixo ainda força a navegação para a versão publicada.
      }

      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set('rv_update', String(Date.now()))
      window.location.replace(nextUrl.toString())
    }

    async function checkForNewVersion(force = false) {
      if (
        !navigator.onLine ||
        checkingRef.current ||
        updatingRef.current
      ) {
        return
      }

      const now = Date.now()

      if (
        !force &&
        now - lastCheckAtRef.current < 20_000
      ) {
        return
      }

      checkingRef.current = true
      lastCheckAtRef.current = now

      try {
        const response = await fetch(
          `/?rv_version_check=${Date.now()}`,
          {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache',
            },
          },
        )

        if (!response.ok) return

        const html = await response.text()
        const latestDocument = new DOMParser().parseFromString(
          html,
          'text/html',
        )

        const nextSignature = getAssetSignature(latestDocument)
        const currentSignature =
          currentSignatureRef.current ||
          getAssetSignature(document)

        if (
          nextSignature &&
          currentSignature &&
          nextSignature !== currentSignature
        ) {
          await applyUpdate(nextSignature)
        }
      } catch {
        // Falha de rede: tenta novamente depois.
      } finally {
        checkingRef.current = false
      }
    }

    const initialTimer = window.setTimeout(() => {
      checkForNewVersion(true)
    }, 2500)

    const interval = window.setInterval(
      () => checkForNewVersion(),
      UPDATE_CHECK_INTERVAL,
    )

    function onVisible() {
      if (document.visibilityState === 'visible') {
        checkForNewVersion(true)
      }
    }

    function onFocus() {
      checkForNewVersion(true)
    }

    function onFocusOut() {
      window.setTimeout(() => {
        const signature = pendingSignatureRef.current

        if (signature && !isEditingForm()) {
          pendingSignatureRef.current = ''
          applyUpdate(signature)
        }
      }, 120)
    }

    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) return

    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice

      if (choice.outcome === 'dismissed') {
        rememberInstallDismissal()
      }
    } finally {
      setInstallPrompt(null)
    }
  }

  function dismissInstall() {
    rememberInstallDismissal()
    setInstallPrompt(null)
    setShowIosInstall(false)
  }

  if (!online) {
    return (
      <aside className="rvPwaToast rvPwaOffline" role="status">
        <div className="rvPwaToastCopy">
          <strong>Você está sem conexão</strong>
          <span>Dados, progresso e vídeos precisam de internet.</span>
        </div>
      </aside>
    )
  }

  if (standalone) return null

  if (installPrompt) {
    return (
      <aside className="rvPwaToast rvPwaInstall" role="status">
        <div className="rvPwaToastIcon">
          <Download size={18} />
        </div>

        <div className="rvPwaToastCopy">
          <strong>Instale o RV App</strong>
          <span>Acesse como aplicativo, sem a barra do navegador.</span>
        </div>

        <div className="rvPwaToastActions">
          <button
            type="button"
            className="rvPwaPrimaryAction"
            onClick={installApp}
          >
            Instalar
          </button>

          <button
            type="button"
            className="rvPwaCloseAction"
            onClick={dismissInstall}
            aria-label="Agora não"
            title="Agora não"
          >
            <X size={16} />
          </button>
        </div>
      </aside>
    )
  }

  if (showIosInstall) {
    return (
      <aside
        className="rvPwaToast rvPwaInstall rvPwaIosInstall"
        role="status"
      >
        <div className="rvPwaToastIcon">
          <Share2 size={18} />
        </div>

        <div className="rvPwaToastCopy">
          <strong>Adicione o RV App à Tela de Início</strong>
          <span>
            No Safari, toque em Compartilhar e depois em Adicionar à
            Tela de Início.
          </span>
        </div>

        <div className="rvPwaToastActions">
          <button
            type="button"
            className="rvPwaSecondaryAction"
            onClick={dismissInstall}
          >
            Entendi
          </button>
        </div>
      </aside>
    )
  }

  return null
}
