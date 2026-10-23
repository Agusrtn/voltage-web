-- Canales iniciales VOLTAGE. Seguro para ejecutar más de una vez.
-- Los enlaces de YouTube asociados se muestran en la app; para insertar vídeo
-- en el reproductor se debe añadir la URL de un vídeo/directo, no la del canal.

insert into public.channels (name, description, is_active, display_order)
select seed.name, seed.description, true, seed.display_order
from (values
  ('VTE1', 'Canales de YouTube: https://www.youtube.com/@voltagerbx · https://www.youtube.com/@RTN_Events', 1),
  ('VTE MUSIC', 'Canales de YouTube: https://www.youtube.com/@rtnmusicrbx · https://www.youtube.com/@badvyx', 2)
) as seed(name, description, display_order)
where not exists (
  select 1
  from public.channels existing
  where lower(existing.name) = lower(seed.name)
);
