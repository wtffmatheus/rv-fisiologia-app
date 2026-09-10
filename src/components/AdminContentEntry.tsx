import {
  lazy,
  Suspense,
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
  const [mobile] =
    useState(readMobile)

  return (
    <Suspense
      fallback={
        <RvLoadingState
          title="Abrindo conteúdo"
          text="Preparando o editor."
        />
      }
    >
      <div data-rv-editor-open>
        {mobile ? (
          <MobileEditor />
        ) : (
          <DesktopEditor />
        )}
      </div>
    </Suspense>
  )
}
