import {
  AlertTriangle,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect } from 'react'

export default function RvConfirmModal({
  eyebrow = 'CONFIRMAÇÃO',
  title,
  text,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  eyebrow?: string
  title: string
  text?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, onCancel])

  return (
    <div
      className="rvConfirmBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rv-confirm-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) {
          onCancel()
        }
      }}
    >
      <section className={`rvConfirmModal ${danger ? 'danger' : ''}`}>
        <header className="rvConfirmHeader">
          <span className="rvConfirmIcon">
            {danger ? (
              <AlertTriangle size={21} />
            ) : (
              <ShieldCheck size={21} />
            )}
          </span>

          <button
            type="button"
            className="rvConfirmClose"
            onClick={onCancel}
            disabled={busy}
            aria-label={cancelLabel}
          >
            <X size={17} />
          </button>
        </header>

        <div className="rvConfirmCopy">
          <span>{eyebrow}</span>
          <h2 id="rv-confirm-title">{title}</h2>
          {text && <p>{text}</p>}
        </div>

        <div className="rvConfirmActions">
          <button
            type="button"
            className="rvConfirmCancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className="rvConfirmSubmit"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
