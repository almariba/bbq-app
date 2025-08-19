# BBQ Manager — MVP completo unificado
Incluye: Menú, Tareas (con realizadores múltiples), Gastos/Balance y Resumen.

## Pasos
1) Ejecuta `db_full.sql` en Supabase (DBeaver o editor SQL). Es idempotente.
2) Sube `index.html`, `styles.css`, `app.js`, `app_dialog_patch.js`, `config.js` a tu repo.
3) `git push` y prueba en tu URL (crear evento, compartir código).

## Notas
- RLS abiertas por simplicidad. Endureceremos después (auth anónima + políticas por usuario/evento).
- El diálogo de tareas arranca oculto y puede cerrarse clicando el fondo.
