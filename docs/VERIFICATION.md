# Informe de comprobaciones

Este informe se actualiza con las comprobaciones ejecutadas antes de empaquetar.

## Locales

- `npm install`: no superada en este entorno. npm no pudo verificar el certificado TLS del registro (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) al solicitar `@supabase/supabase-js`. Se mantuvo la validación TLS activa y no se descargaron paquetes.
- `npm run lint`: no ejecutable porque ESLint no llegó a instalarse.
- `npm test`: no ejecutable porque Vitest no llegó a instalarse.
- `npm run build`: no ejecutable porque Vite no llegó a instalarse.
- Comprobación directa de `src/lib/schedule.js`: superada con Node 24.6.0. Verificó programa actual/siguiente, solape y estado `live` de un evento.
- Resolución estática de imports locales y revisión de archivos: se ejecuta antes de empaquetar.

## Cobertura incluida

- Cálculo de programa actual y siguiente, intervalos y solapes por canal.
- Estados temporales de eventos y construcción de embeds de YouTube.
- Estados de sesión y protecciones de ruta administrativa con mocks unitarios puros.
- Transición insertar/eliminar de favoritos por clave estable.
- Políticas RLS, restricciones y permisos de columna en la migración SQL.

## Externas pendientes

No se han verificado contra Supabase ni contra YouTube antes de proporcionar credenciales, fuentes de emisión y autorización del propietario. La aplicación comunica de forma explícita la falta de configuración y no simula operaciones remotas exitosas.

## Empaquetado

- `vte-media.zip`: creado y abierto correctamente el 23/10/2026.
- Estructura: carpeta raíz `vte-media/`, 29 entradas verificadas.
- Confirmados: `package.json`, aplicación React, migración SQL, README, `.env.example` y `vercel.json`.
- Excluidos: `node_modules`, compilación, `.env`, cachés y credenciales.
