import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

export default function SettingsAccordion({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  className = '',
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      className={`rvSettingsAccordion ${open ? 'open' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className="rvSettingsAccordionTrigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {icon && (
          <span className="rvSettingsAccordionIcon">
            {icon}
          </span>
        )}

        <span className="rvSettingsAccordionHeading">
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </span>

        <span className="rvSettingsAccordionChevron" aria-hidden="true">
          {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
      </button>

      {open && (
        <div className="rvSettingsAccordionBody">
          {children}
        </div>
      )}
    </section>
  )
}
