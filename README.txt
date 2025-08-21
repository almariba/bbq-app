# El Charco Puto
Incluye: Menú, Tareas (con realizadores múltiples), Gastos/Balance y Resumen.

## Novedad: solo el creador puede crear barbacoas (PIN)
- En `config.js` define `ADMIN_PIN` con un valor secreto que solo tú conozcas.
- En la tarjeta **Crear nueva barbacoa** se pide ese PIN. Si no coincide, no se crea el evento.
> Nota: este control es **básico** (frontend). Para seguridad fuerte, conviene activar autenticación y políticas RLS.

## Pasos
1) Ejecuta `db_full.sql` en Supabase (DBeaver o editor SQL). Es idempotente.
2) Sube `index.html`, `styles.css`, `app.js`, `app_dialog_patch.js`, `config.js` a tu repo.
3) `git push` y prueba en tu URL (crear evento, compartir código).

## Notas
- RLS abiertas por simplicidad. Endureceremos después (auth anónima + políticas por usuario/evento).
- El diálogo de tareas arranca oculto y puede cerrarse clicando el fondo.
