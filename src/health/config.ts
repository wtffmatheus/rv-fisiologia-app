const name = String(import.meta.env.VITE_HEALTH_SHORTCUT_NAME || 'RV-ANALISE-ENXUTO-ASSINADO').trim()
const installUrl = String(import.meta.env.VITE_HEALTH_SHORTCUT_URL || 'https://www.icloud.com/shortcuts/228efc67643d470a975ae95b19c0959e').trim()
const supportsModes = import.meta.env.VITE_HEALTH_SHORTCUT_SUPPORTS_MODES === 'true'

export const healthIntegration = {
  name,
  installUrl: /^https:\/\/www\.icloud\.com\/shortcuts\/[a-f0-9]{32}$/.test(installUrl) ? installUrl : undefined,
  run(mode: 'analysis' | 'start' | 'sync' | 'end') {
    if (mode !== 'analysis' && !supportsModes) return undefined
    if (!name) return 'shortcuts://'
    const base = `shortcuts://run-shortcut?name=${encodeURIComponent(name)}`
    return supportsModes ? `${base}&input=text&text=${mode}` : base
  },
  supportsModes,
}
