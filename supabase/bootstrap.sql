-- Minimum needed to let the first person sign up: a house account, and an
-- invite code it owns. Run this in the Supabase SQL editor.
-- (supabase/seed.sql does this too, plus the 88 venues — either is fine.)

insert into public.profiles (id, username, display_name, onboarded, is_seed)
values ('00000000-0000-4000-a000-000000000001', 'curated', 'Curated', false, true)
on conflict do nothing;

insert into public.invite_codes (code, owner_id)
values ('CURATED1', '00000000-0000-4000-a000-000000000001')
on conflict do nothing;
