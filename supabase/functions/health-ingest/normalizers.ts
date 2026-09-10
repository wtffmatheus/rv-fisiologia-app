export const metricRules: Record<string, { unit: string; min: number; max: number }> = {
  heart_rate: { unit: 'bpm', min: 20, max: 300 },
  resting_heart_rate: { unit: 'bpm', min: 20, max: 300 },
  heart_rate_variability: { unit: 'ms', min: 0, max: 1000 },
  respiratory_rate: { unit: 'breaths/min', min: 1, max: 100 },
  oxygen_saturation: { unit: '%', min: 1, max: 100 },
  steps: { unit: 'steps', min: 0, max: 100000 },
  active_energy: { unit: 'kcal', min: 0, max: 10000 },
  distance: { unit: 'km', min: 0, max: 1000 },
  workout_start: { unit: 'event', min: 0, max: 720 },
  workout_end: { unit: 'event', min: 0, max: 720 },
}

export function normalizeSample(input: Record<string, unknown>, now = Date.now()) {
  const metric = String(input.metric || input.type || '').trim().toLowerCase()
  const rule = metricRules[metric]
  if (!rule) return null
  const source = String(input.source || 'apple_health').trim().toLowerCase()
  if (!/^[a-z0-9_-]{2,40}$/.test(source)) return null
  if (typeof input.value !== 'number' && typeof input.value !== 'string') return null
  if (typeof input.value === 'string' && !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(input.value.trim())) return null
  let value = Number(input.value)
  let unit = String(input.unit || '').trim()
  if (rule.unit === 'event' && ['count', 'min', 'minutes'].includes(unit)) unit = 'event'
  if (rule.unit === 'bpm' && ['count/min', 'contagem/min'].includes(unit)) unit = 'bpm'
  if (metric === 'steps' && unit === 'count') unit = 'steps'
  if (metric === 'active_energy' && unit === 'Cal') unit = 'kcal'
  if (metric === 'distance' && unit === 'm') { value /= 1000; unit = 'km' }
  if (metric === 'oxygen_saturation' && unit === 'fraction') { value *= 100; unit = '%' }
  if (unit !== rule.unit || !Number.isFinite(value) || value < rule.min || value > rule.max) return null
  const timestamp = String(input.measured_at || '')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) return null
  const measured = Date.parse(timestamp)
  if (!Number.isFinite(measured) || measured > now + 600000 || measured < now - 180 * 86400000) return null
  const sourceId = String(input.source_id || '').trim()
  if (sourceId.length > 160) return null
  return { source, metric, value, unit, measured_at: new Date(measured).toISOString(), source_id: sourceId }
}

export function sampleIdentity(student: string, sample: NonNullable<ReturnType<typeof normalizeSample>>) {
  return `${student}|${sample.source_id || `${sample.source}|${sample.metric}|${sample.value}|${sample.unit}|${sample.measured_at}`}`
}

export function cleanSamples<T extends { student_id: string; source: string; metric: string; value: number; unit: string; measured_at: string; raw_payload?: { source_id?: string | null } }>(samples: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const row of samples) {
    const normalized = normalizeSample({ ...row, source_id: row.raw_payload?.source_id })
    if (!normalized) continue
    const key = sampleIdentity(row.student_id, normalized)
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ ...row, ...normalized })
  }
  return result
}
