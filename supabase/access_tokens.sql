-- ==============================================================================
-- Access Tokens Table for Gated Access System
-- Run this in your Supabase SQL Editor
-- ==============================================================================

create table if not exists public.access_tokens (
    id uuid primary key default uuid_generate_v4(),
    code text unique not null,
    label text default 'Trader Access',
    is_active boolean default true,
    max_uses integer default 10,
    used_count integer default 0,
    expires_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    created_by text default 'ADMIN'
);

-- Seed Initial Access Tokens
insert into public.access_tokens (code, label, is_active, max_uses, used_count)
values 
  ('ALGO-MASTER-777', 'Master Admin Token', true, 9999, 0),
  ('VIP-ACCESS-2026', 'VIP Trader Pass', true, 50, 0)
on conflict (code) do nothing;
