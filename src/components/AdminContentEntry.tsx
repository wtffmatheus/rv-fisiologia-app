import {
  lazy,
  Suspense,
  useEffect,
  useState,
} from 'react'
import { RvLoadingState } from './PlatformState'

const DesktopEditor = lazy(
  () => import('./AdminContentManager'),
)

const MobileEditor = lazy(
  () => import('./AdminContentMobile'),
)

function readMobile() {
  return window.matchMedia(
    '(max-width: 820px)',
  ).matches
}

export default function AdminContentEntry() {
  const [mobile, setMobile] =
    useState(readMobile)

  useEffect(() => {
    const media = window.matchMedia(
      '(max-width: 820px)',
    )

    function sync() {
      setMobile(media.matches)
    }

    media.addEventListener('change', sync)

    return () => {
      media.removeEventListener('change', sync)
    }
  }, [])

  return (
    <Suspense
      fallback={
        <RvLoadingState
          title="Abrindo conteúdo"
          text="Preparando o editor."
        />
      }
    >
      {mobile ? (
        <MobileEditor />
      ) : (
        <DesktopEditor />
      )}
    </Suspense>
  )
}
