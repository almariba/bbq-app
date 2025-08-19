# BBQ Manager — MVP (Supabase + HTML/JS)
Este paquete contiene un MVP funcional:
- *Pantallas*: crear/entrar evento (código), Menú (contadores), Tareas, Gastos, Resumen.
- *Persistencia*: Supabase (Postgres) vía `@supabase/supabase-js` en el navegador.
- *Estado*: `localStorage` guarda tu `event` y `me`.

## Uso
1) Ejecuta `db_mvp.sql` en DBeaver o en el editor SQL de Supabase.
2) Copia estos archivos a la raíz de tu repo (junto a `config.js`).
3) `git add . && git commit -m "mvp" && git push` → Vercel desplegará.
4) Abre la URL, crea un evento, comparte el código y que la gente entre con su nickname.

## Seguridad
Las políticas RLS están **abiertas** para facilitar el MVP. Cualquiera con el código puede editar.
Después podemos:
- Activar **autenticación anónima** (sin email) y:
- Políticas RLS que sólo permitan modificar filas del usuario/evento.
