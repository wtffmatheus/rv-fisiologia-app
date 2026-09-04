import { Check, Globe2 } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AppLanguage, languages, useI18n } from '../i18n'

export default function LanguagePreferenceCard({ profileId }: { profileId: string }) {
  const { language, setLanguage, t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function changeLanguage(next: AppLanguage) {
    setSaving(true)
    setMessage('')
    const { error } = await supabase.rpc('set_own_language', { p_language: next })
    if (error) {
      setMessage(t('languageError'))
      setSaving(false)
      return
    }
    setLanguage(next)
    setMessage(t('languageSaved'))
    setSaving(false)
  }

  return (
    <div className="languagePreference">
      <div className="preferenceIcon"><Globe2 size={19} /></div>
      <div className="preferenceCopy">
        <strong>{t('languageTitle')}</strong>
        <span>{t('languageHelp')}</span>
        {message && <small><Check size={13} /> {message}</small>}
      </div>
      <select value={language} disabled={saving} onChange={(e) => void changeLanguage(e.target.value as AppLanguage)} aria-label={t('languageTitle')}>
        {languages.map((item) => <option key={item.value} value={item.value}>{item.name}</option>)}
      </select>
    </div>
  )
}
