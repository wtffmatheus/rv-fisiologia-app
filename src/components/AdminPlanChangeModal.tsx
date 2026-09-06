import { ArrowRight, RefreshCw, X } from 'lucide-react'
import { useEffect } from 'react'

export type AdminPlanChangeRequest = {
  studentId: string
  programId: number
  startDate: string
  studentName: string
  currentProgram: string
  nextProgram: string
}

export default function AdminPlanChangeModal({
  request,
  saving,
  onCancel,
  onConfirm,
}: {
  request: AdminPlanChangeRequest
  saving: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, saving])

  return (
    <div
      className="rvPlanConfirmBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rv-plan-confirm-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) {
          onCancel()
        }
      }}
    >
      <section className="rvPlanConfirmModal">
        <header className="rvPlanConfirmHeader">
          <div className="rvPlanConfirmIcon">
            <RefreshCw size={22} />
          </div>

          <button
            type="button"
            className="rvPlanConfirmClose"
            onClick={onCancel}
            disabled={saving}
            aria-label="Cancelar troca de metodologia"
          >
            <X size={18} />
          </button>
        </header>

        <div className="rvPlanConfirmCopy">
          <span>ALTERAÇÃO DE PLANO</span>
          <h2 id="rv-plan-confirm-title">Trocar metodologia?</h2>
          <p>
            Confirme a nova metodologia de <strong>{request.studentName}</strong>.
          </p>
        </div>

        <div className="rvPlanConfirmCompare">
          <div>
            <small>Atual</small>
            <strong>{request.currentProgram}</strong>
          </div>

          <ArrowRight size={20} />

          <div>
            <small>Nova metodologia</small>
            <strong>{request.nextProgram}</strong>
          </div>
        </div>

        <p className="rvPlanConfirmNote">
          O plano atual será finalizado e o novo plano será aplicado com a data de início selecionada.
        </p>

        <div className="rvPlanConfirmActions">
          <button
            type="button"
            className="rvPlanConfirmCancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="rvPlanConfirmSubmit"
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>
      </section>
    </div>
  )
}
