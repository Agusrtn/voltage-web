-- Compatibilidad conservando los favoritos de una tabla saved_videos anterior.
-- Ejecutar una vez desde Supabase > SQL Editor como propietario del proyecto.
-- Mantiene user_id, youtube_id, title, saved_at y created_at existentes.

begin;

alter table public.saved_videos
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists content_key text,
  add column if not exists thumbnail_url text not null default '',
  add column if not exists video_source text not null default '';

-- Conserva cada fila antigua y le asigna claves que la app puede leer.
update public.saved_videos
set id = gen_random_uuid()
where id is null;

update public.saved_videos
set content_key = 'youtube:' || youtube_id
where content_key is null or btrim(content_key) = '';

-- Si se habían generado IDs repetidos, da un ID nuevo solo a las filas
-- duplicadas; ningún favorito se elimina.
with duplicate_ids as (
  select ctid,
         row_number() over (partition by id order by created_at, ctid) as row_number
  from public.saved_videos
  where id is not null
)
update public.saved_videos as saved
set id = gen_random_uuid()
from duplicate_ids
where saved.ctid = duplicate_ids.ctid
  and duplicate_ids.row_number > 1;

alter table public.saved_videos
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column content_key set not null;

create unique index if not exists saved_videos_id_compat_uidx
  on public.saved_videos (id);

commit;
