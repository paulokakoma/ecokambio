create table if not exists public.ecoflix_events (
    id bigserial primary key,
    audience text not null check (audience in ('admin', 'user', 'phone', 'all')),
    target_phone text null,
    type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    read_at timestamptz null
);

create index if not exists idx_ecoflix_events_admin_poll
    on public.ecoflix_events (id)
    where audience in ('admin', 'all');

create index if not exists idx_ecoflix_events_target_phone_poll
    on public.ecoflix_events (target_phone, id)
    where target_phone is not null;

create index if not exists idx_ecoflix_events_created_at
    on public.ecoflix_events (created_at);

-- Optional cleanup, suitable for a scheduled job:
-- delete from public.ecoflix_events where created_at < now() - interval '15 days';
