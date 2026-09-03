import {
  AlertTriangle,
  BookOpen,
  LoaderCircle,
  SearchX,
} from 'lucide-react'

type LoadingStateProps = {
  title?: string
  text?: string
  compact?: boolean
  fullScreen?: boolean
}

type EmptyStateProps = {
  kind?: 'program' | 'search' | 'error'
  title: string
  text?: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
  className?: string
}

export function RvLoadingState({
  title = 'Carregando',
  text = 'Preparando as informações mais recentes.',
  compact = false,
  fullScreen = false,
}: LoadingStateProps) {
  return (
    <div
      className={[
        'rvUiState',
        'rvUiLoading',
        compact ? 'compact' : '',
        fullScreen ? 'fullscreen' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
    >
      {fullScreen && (
        <img
          src="/logo-rv-app.png"
          className="rvUiStateLogo"
          alt="RV App"
        />
      )}

      <div className="rvUiStateIcon">
        <LoaderCircle size={compact ? 20 : 25} className="rvUiSpin" />
      </div>

      <div className="rvUiStateCopy">
        <strong>{title}</strong>
        {text && <span>{text}</span>}
      </div>
    </div>
  )
}

export function RvEmptyState({
  kind = 'search',
  title,
  text,
  actionLabel,
  onAction,
  compact = false,
  className = '',
}: EmptyStateProps) {
  const Icon =
    kind === 'program'
      ? BookOpen
      : kind === 'error'
        ? AlertTriangle
        : SearchX

  return (
    <div
      className={[
        'rvUiState',
        'rvUiEmpty',
        `kind-${kind}`,
        compact ? 'compact' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="rvUiStateIcon">
        <Icon size={compact ? 20 : 25} />
      </div>

      <div className="rvUiStateCopy">
        <strong>{title}</strong>
        {text && <span>{text}</span>}
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          className="rvUiStateAction"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
