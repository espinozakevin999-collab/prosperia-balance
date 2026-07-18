# Prospería Balance

**Tu dinero, sin enredos.** Prospería es una aplicación financiera accesible para microemprendimientos y negocios familiares. Está diseñada para personas con poca experiencia digital o financiera: palabras cotidianas, acciones grandes y explicaciones concretas.

## Lo que ya funciona

- Dashboard mensual con dinero que entró, salió y quedó.
- Registro, edición, búsqueda, filtros y eliminación de movimientos.
- Separación entre gastos del negocio y gastos de casa.
- Categorías, límite mensual y análisis financiero determinista.
- Importación y exportación CSV.
- Modo demostración y uso local sin cuenta.
- Inicio de sesión por enlace de correo y sincronización con Supabase.
- Análisis opcional con GPT-5.6, con respuesta local si la API no está disponible.
- Diseño adaptable, navegación móvil e interfaz instalable como PWA.

## Filosofía del producto

1. La persona debe registrar una venta o un gasto sin leer un manual.
2. La pantalla principal responde: ¿cuánto entró?, ¿cuánto salió? y ¿cuánto quedó?
3. Las funciones avanzadas no deben estorbar a quien solo necesita lo básico.
4. Los cálculos principales funcionan sin IA, cuenta ni suscripción.
5. La IA explica y orienta; no sustituye asesoría profesional ni toma decisiones por la persona.

## Ejecutar en local

Requisitos: Node.js 20 o posterior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sin variables de entorno, la aplicación abre en modo local y guarda los datos en el navegador.

## Conectar Supabase

1. Abre tu proyecto de Supabase y entra a **SQL Editor**.
2. Copia y ejecuta [`supabase/schema.sql`](supabase/schema.sql).
3. En **Project Settings → API**, copia la URL del proyecto y la clave publicable.
4. Configura localmente:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

5. En **Authentication → URL Configuration**, agrega la URL pública de la aplicación como `Site URL` y `Redirect URL`.

Nunca coloques la clave `service_role`, la contraseña de la base de datos o `OPENAI_API_KEY` en variables que comiencen con `VITE_`.

## Activar GPT-5.6

La función `/api/analyze` está preparada para un despliegue compatible con funciones de Vercel. Agrega estos secretos en el proveedor de hosting:

```env
OPENAI_API_KEY=tu_clave_de_proyecto
OPENAI_MODEL=gpt-5.6-terra
```

El navegador envía únicamente cifras agregadas y categorías. El correo, las notas y la descripción individual de cada movimiento no se envían al modelo. Si la API no está configurada o falla, la aplicación usa recomendaciones locales.

## Pruebas y compilación

```bash
npm test
npm run build
```

## Desplegar en Vercel

1. Importa este repositorio en Vercel.
2. Conserva el framework detectado como **Vite**.
3. Agrega las cuatro variables de entorno descritas arriba.
4. Despliega y agrega la URL final en la configuración de autenticación de Supabase.

## Colaboración

Codex y Claude comparten las reglas de [`AGENTS.md`](AGENTS.md). Las indicaciones específicas para Claude están en [`CLAUDE.md`](CLAUDE.md). Las contribuciones deben realizarse en una rama y entrar mediante pull request.

## Licencia

[MIT](LICENSE) © 2026 Kevin Espinoza y colaboradores.
