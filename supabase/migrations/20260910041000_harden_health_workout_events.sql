create or replace function public.rv_assign_health_sample_workout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session_id uuid;
  v_workout_type text;
  v_planned smallint;
  v_event_at timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(new.student_id::text, 0));

  if new.metric in ('heart_rate', 'resting_heart_rate') and
     (new.value < 20 or new.value > 300) then
    return null;
  end if;
  if new.metric = 'active_energy' and
     (new.value < 0 or new.value > 10000) then
    return null;
  end if;

  if exists (
    select 1 from public.health_samples h where h.dedupe_key = new.dedupe_key
  ) then
    return new;
  end if;

  if new.metric = 'workout_start' then
    update public.workout_sessions
       set status = 'cancelled',
           ended_at = greatest(started_at, least(v_event_at - interval '1 second', started_at + interval '24 hours')),
           updated_at = now()
     where student_id = new.student_id
       and status = 'active';

    v_workout_type := coalesce(
      nullif(new.raw_payload ->> 'workout_type', ''),
      nullif(new.raw_payload #>> '{metadata,workout_type}', ''),
      'workout'
    );

    v_planned := case
      when new.value between 1 and 720 then round(new.value)::smallint
      else null
    end;

    insert into public.workout_sessions (
      student_id,
      source,
      workout_type,
      planned_duration_minutes,
      started_at,
      status,
      last_synced_at
    ) values (
      new.student_id,
      new.source,
      left(v_workout_type, 80),
      v_planned,
      v_event_at,
      'active',
      now()
    )
    returning id into v_session_id;

    new.workout_session_id := v_session_id;
    return new;
  end if;

  if new.metric = 'workout_end' then
    select s.id
      into v_session_id
      from public.workout_sessions s
     where s.student_id = new.student_id
       and s.status = 'active'
     order by s.started_at desc
     limit 1;

    if v_session_id is not null then
      new.workout_session_id := v_session_id;
    end if;

    return new;
  end if;

  select s.id
    into v_session_id
    from public.workout_sessions s
   where s.student_id = new.student_id
     and new.measured_at >= s.started_at - interval '10 minutes'
     and new.measured_at <= case
       when s.status = 'active' then s.started_at + interval '24 hours'
       else coalesce(s.ended_at, s.started_at) + interval '5 minutes'
     end
     and s.status in ('active', 'completed')
   order by
     case when s.status = 'active' then 0 else 1 end,
     s.started_at desc
   limit 1;

  if v_session_id is not null then
    new.workout_session_id := v_session_id;
  end if;

  return new;
end;
$function$;

create or replace function public.rv_finish_health_sample_workout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.workout_session_id is null then
    return new;
  end if;

  if new.metric = 'workout_end' then
    update public.workout_sessions
       set status = case when now() - started_at > interval '24 hours' then 'cancelled' else 'completed' end,
           ended_at = greatest(started_at, least(now(), started_at + interval '24 hours')),
           last_synced_at = now(),
           updated_at = now()
     where id = new.workout_session_id
       and student_id = new.student_id;
  else
    update public.workout_sessions
       set last_synced_at = now(),
           updated_at = now()
     where id = new.workout_session_id
       and student_id = new.student_id;
  end if;

  return new;
end;
$function$;
