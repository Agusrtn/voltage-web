-- EJECUTAR SOLO DESDE EL SQL Editor DEL PROPIETARIO DEL PROYECTO SUPABASE.
-- 1) Registra primero la cuenta propietaria desde VTE MEDIA/Auth.
-- 2) En Authentication > Users copia el UUID verificado de esa cuenta.
-- 3) Sustituye ÚNICAMENTE el texto entre comillas por ese UUID. No inventes un UUID.
-- 4) Revisa el UUID antes de ejecutar. Este script no debe exponerse a usuarios finales.

insert into public.user_roles (user_id, role)
values ('PEGA-AQUI-EL-UUID-VERIFICADO-DEL-PROPIETARIO', 'admin')
on conflict (user_id) do update set role = excluded.role;
