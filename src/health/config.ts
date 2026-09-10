const currentInstallUrl = 'https://www.icloud.com/shortcuts/4a2347dfb1c945bf89873284c3e6ceeb'
const name = String(import.meta.env.VITE_HEALTH_SHORTCUT_NAME || 'RV - Sincronizar Saúde').trim()
const installUrl = String(import.meta.env.VITE_HEALTH_SHORTCUT_URL || currentInstallUrl).trim()
const supportsModes = installUrl !== currentInstallUrl && import.meta.env.VITE_HEALTH_SHORTCUT_SUPPORTS_MODES === 'true'

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
  collectedMetrics: installUrl === currentInstallUrl
    ? ['heart_rate', 'resting_heart_rate', 'heart_rate_variability', 'steps', 'active_energy']
    : undefined,
}
