-- Hora oficial de PostgreSQL para sincronizar el estado EPG entre espectadores.
-- Ejecutar una vez después de la migración 001.
create or replace function public.broadcast_server_time()
returns timestamptz
language sql
volatile
security invoker
set search_path = pg_catalog
as $$
  select clock_timestamp();
$$;

grant execute on function public.broadcast_server_time() to anon, authenticated;
