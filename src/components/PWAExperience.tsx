import { Download, RefreshCw, Share2, WifiOff, X } from 'lucide-react'
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
const UPDATE_DISMISS_KEY = 'rv-pwa-update-dismissed-signature'
const INSTALL_DISMISS_DAYS = 3
const UPDATE_CHECK_INTERVAL = 2 * 60 * 1000

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
    return new URL(value, window.location.origin).pathname
  } catch {
    return value
  }
}

function getAssetSignature(documentToRead: Document) {
  const modules = Array.from(
    documentToRead.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'),
  ).map((item) => normalizeAssetUrl(item.getAttribute('src') || ''))

  const styles = Array.from(
    documentToRead.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
  ).map((item) => normalizeAssetUrl(item.getAttribute('href') || ''))

  return [...modules, ...styles].filter(Boolean).sort().join('|')
}

function installWasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISS_KEY)
    if (!raw) return false

    const dismissedAt = Number(raw)
    const elapsed = Date.now() - dismissedAt
    return elapsed < INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function rememberInstallDismissal() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()))
  } catch {
    // A experiência continua funcionando mesmo sem localStorage.
  }
}

function getDismissedUpdateSignature() {
  try {
    return sessionStorage.getItem(UPDATE_DISMISS_KEY) || ''
  } catch {
    return ''
  }
}

function rememberDismissedUpdate(signature: string) {
  try {
    sessionStorage.setItem(UPDATE_DISMISS_KEY, signature)
  } catch {
    // Sem impacto no funcionamento do update.
  }
}

export default function PWAExperience() {
  const [installPrompt, setInstallPrompt] =
    useState<DeferredInstallPrompt | null>(null)
  const [standalone, setStandalone] = useState(isStandaloneMode)
  const [showIosInstall, setShowIosInstall] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [latestSignature, setLatestSignature] = useState('')
  const [updating, setUpdating] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  const currentSignatureRef = useRef('')
  const checkingRef = useRef(false)
  const lastCheckAtRef = useRef(0)

  useEffect(() => {
    currentSignatureRef.current = getAssetSignature(document)

    const currentUrl = new URL(window.location.href)
    if (currentUrl.searchParams.has('rv_update')) {
      currentUrl.searchParams.delete('rv_update')
      window.history.replaceState(
        {},
        document.title,
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      )
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
      return Boolean(element.closest('input, textarea, select, [contenteditable="true"]'))
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
    async function checkForNewVersion(force = false) {
      if (!navigator.onLine || checkingRef.current) return

      const now = Date.now()
      if (!force && now - lastCheckAtRef.current < 25_000) return

      checkingRef.current = true
      lastCheckAtRef.current = now

      try {
        const response = await fetch(
          `/?rv_version_check=${Date.now()}`,
          {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
          },
        )

        if (!response.ok) return

        const html = await response.text()
        const latestDocument = new DOMParser().parseFromString(html, 'text/html')
        const nextSignature = getAssetSignature(latestDocument)
        const currentSignature =
          currentSignatureRef.current || getAssetSignature(document)

        if (
          nextSignature &&
          currentSignature &&
          nextSignature !== currentSignature
        ) {
          setLatestSignature(nextSignature)

          if (getDismissedUpdateSignature() !== nextSignature) {
            setUpdateAvailable(true)
          }
        }
      } catch {
        // Falha silenciosa: uma perda de rede não deve atrapalhar o uso do app.
      } finally {
        checkingRef.current = false
      }
    }

    const initialTimer = window.setTimeout(() => {
      checkForNewVersion(true)
    }, 5000)

    const interval = window.setInterval(
      () => checkForNewVersion(),
      UPDATE_CHECK_INTERVAL,
    )

    function onVisible() {
      if (document.visibilityState === 'visible') {
        checkForNewVersion()
      }
    }

    function onFocus() {
      checkForNewVersion()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
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

  async function applyUpdate() {
    if (updating) return

    setUpdating(true)

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        await registration?.update().catch(() => undefined)
        registration?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(
          cacheNames
            .filter((name) => name.startsWith('rv-fisiologia-pwa-'))
            .map((name) => caches.delete(name)),
        )
      }
    } catch {
      // Mesmo se a limpeza falhar, o cache-busting abaixo força uma navegação nova.
    }

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('rv_update', String(Date.now()))
    window.location.replace(nextUrl.toString())
  }

  function dismissUpdate() {
    if (latestSignature) {
      rememberDismissedUpdate(latestSignature)
    }

    setUpdateAvailable(false)
  }

  if (!online) {
    return (
      <aside className="rvPwaToast rvPwaOffline" role="status">
        <div className="rvPwaToastIcon">
          <WifiOff size={18} />
        </div>
        <div className="rvPwaToastCopy">
          <strong>Você está sem conexão</strong>
          <span>
            O app continua aberto, mas dados, progresso e vídeos precisam de internet.
          </span>
        </div>
      </aside>
    )
  }

  if (updateAvailable) {
    return (
      <aside className="rvPwaToast rvPwaUpdate" role="status">
        <div className="rvPwaToastIcon">
          <RefreshCw size={18} />
        </div>

        <div className="rvPwaToastCopy">
          <strong>Nova versão disponível</strong>
          <span>Atualize para carregar as melhorias mais recentes do RV App.</span>
        </div>

        <div className="rvPwaToastActions">
          <button
            type="button"
            className="rvPwaPrimaryAction"
            onClick={applyUpdate}
            disabled={updating}
          >
            {updating ? 'Atualizando...' : 'Atualizar agora'}
          </button>
          <button
            type="button"
            className="rvPwaCloseAction"
            onClick={dismissUpdate}
            aria-label="Atualizar depois"
            title="Atualizar depois"
          >
            <X size={16} />
          </button>
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
      <aside className="rvPwaToast rvPwaInstall rvPwaIosInstall" role="status">
        <div className="rvPwaToastIcon">
          <Share2 size={18} />
        </div>

        <div className="rvPwaToastCopy">
          <strong>Adicione o RV App à Tela de Início</strong>
          <span>
            No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.
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
