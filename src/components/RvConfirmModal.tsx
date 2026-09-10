import {
  AlertTriangle,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

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
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const textId = useId()
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector<HTMLButtonElement>('.rvConfirmCancel')?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])
        const first = controls[0]
        const last = controls.at(-1)
        if (!first) { event.preventDefault(); return }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
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
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={text ? textId : undefined}
      aria-busy={busy}
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
          <h2 id={titleId}>{title}</h2>
          {text && <p id={textId}>{text}</p>}
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
