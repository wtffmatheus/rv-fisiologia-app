type WorkoutWindow = {
  id: string
  started_at: string
  ended_at: string | null
}

type TimedSample = {
  workout_session_id: string | null
  measured_at: string
  metric: string
}

export function samplesDuringWorkout<T extends TimedSample>(samples: T[], session: WorkoutWindow, now = Date.now()): T[] {
  const start = Date.parse(session.started_at)
  const end = session.ended_at ? Date.parse(session.ended_at) : now
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
  return samples.filter(sample => {
    const measured = Date.parse(sample.measured_at)
    return sample.workout_session_id === session.id &&
      sample.metric !== 'workout_start' && sample.metric !== 'workout_end' &&
      measured >= start && measured <= end
  })
}
