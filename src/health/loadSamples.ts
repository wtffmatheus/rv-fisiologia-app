import { supabase } from '../lib/supabase'

export async function loadHealthSamples(studentId: string, sessionIds: string[], signal: AbortSignal) {
  const rows: Record<string, unknown>[] = []
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const ids = sessionIds.filter(id => /^[a-f0-9-]{36}$/i.test(id))
  for (let offset = 0; offset < 50000; offset += 500) {
    let query = supabase.from('health_samples')
      .select('id,student_id,workout_session_id,source,metric,value,unit,measured_at,received_at,raw_payload')
      .eq('student_id', studentId)
      .order('measured_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + 499)
      .abortSignal(signal)
    query = ids.length
      ? query.or(`measured_at.gte.${since},workout_session_id.in.(${ids.join(',')})`)
      : query.gte('measured_at', since)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 500) return rows
  }
  throw new Error('health_sample_limit')
}
