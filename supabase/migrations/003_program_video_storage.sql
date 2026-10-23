-- Public playback assets, but only admins can upload, replace, or delete them.
-- Run once in Supabase SQL Editor after migration 001.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vte-program-videos',
  'vte-program-videos',
  true,
  262144000,
  array['video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vte_program_videos_public_read" on storage.objects;
create policy "vte_program_videos_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'vte-program-videos');

drop policy if exists "vte_program_videos_admin_insert" on storage.objects;
create policy "vte_program_videos_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'vte-program-videos' and public.is_admin());

drop policy if exists "vte_program_videos_admin_update" on storage.objects;
create policy "vte_program_videos_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'vte-program-videos' and public.is_admin())
with check (bucket_id = 'vte-program-videos' and public.is_admin());

drop policy if exists "vte_program_videos_admin_delete" on storage.objects;
create policy "vte_program_videos_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'vte-program-videos' and public.is_admin());
