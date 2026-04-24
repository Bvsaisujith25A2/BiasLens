-- BiasLens Supabase schema (MVP)

create table if not exists public.users (
    id text primary key,
    email text not null,
    name text not null,
    role text not null check (role in ('admin', 'researcher')),
    organization text,
    created_at timestamptz not null default now()
);

create table if not exists public.analyses (
    id text primary key,
    user_id text not null references public.users(id) on delete cascade,
    name text not null,
    dataset_name text not null,
    s3_object_uri text not null,
    status text not null check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    progress integer,
    current_step text,
    error_message text,
    analysis_options jsonb,
    results jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists idx_analyses_user_id on public.analyses(user_id);
create index if not exists idx_analyses_status on public.analyses(status);
create index if not exists idx_analyses_created_at on public.analyses(created_at desc);
