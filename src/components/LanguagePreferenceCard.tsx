import { Check, CircleX, Globe2 } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AppLanguage, languages, useI18n } from '../i18n'

type MessageTone = 'success' | 'error' | null

export default function LanguagePreferenceCard({
  profileId: _profileId,
}: {
  profileId: string
}) {
  const { language, setLanguage, t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>(null)

  async function changeLanguage(next: AppLanguage) {
    if (next === language) return

    setSaving(true)
    setMessage('')
    setMessageTone(null)

    const { error } = await supabase.rpc('set_own_language', {
      p_language: next,
    })

    if (error) {
      console.error('Falha ao alterar idioma:', error)
      setMessage(t('languageError'))
      setMessageTone('error')
      setSaving(false)
      return
    }

    setLanguage(next)
    setMessage(t('languageSaved'))
    setMessageTone('success')
    setSaving(false)
  }

  return (
    <div className="languagePreference">
      <div className="preferenceIcon">
        <Globe2 size={19} />
      </div>

      <div className="preferenceCopy">
        <strong>{t('languageTitle')}</strong>
        <span>{t('languageHelp')}</span>

        {message && (
          <small
            className={
              messageTone === 'error'
                ? 'languagePreferenceMessage error'
                : 'languagePreferenceMessage success'
            }
          >
            {messageTone === 'error' ? (
              <CircleX size={13} />
            ) : (
              <Check size={13} />
            )}
            {message}
          </small>
        )}
      </div>

      <select
        value={language}
        disabled={saving}
        onChange={(event) =>
          void changeLanguage(event.target.value as AppLanguage)
        }
        aria-label={t('languageTitle')}
      >
        {languages.map((item) => (
          <option key={item.value} value={item.value}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  )
}
