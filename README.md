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
- Diseño adaptable, navegación móvil y acceso desde la pantalla de inicio en navegadores compatibles. La primera carga requiere conexión.

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
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

El navegador envía únicamente cifras agregadas y categorías. El correo, las notas y la descripción individual de cada movimiento no se envían al modelo. La función valida la sesión de Supabase y limita solicitudes antes de consumir la API. Si la API no está configurada o falla, la aplicación usa recomendaciones locales.

## OpenAI Build Week: Codex + GPT-5.6

Prospería Balance fue desarrollada durante OpenAI Build Week con Codex como agente principal de ingeniería:

- convirtió el prototipo inicial en una aplicación Vite funcional y adaptable;
- implementó cálculos, persistencia local, autenticación, sincronización y políticas RLS;
- agregó pruebas, documentación, revisión de accesibilidad y refuerzos de seguridad;
- ayudó a mantener las decisiones de producto alineadas con lenguaje sencillo y teléfonos económicos.

GPT-5.6 Terra se usa en [`api/analyze.js`](api/analyze.js) mediante Responses API para transformar un resumen financiero mínimo en una observación y una acción concreta en español cotidiano. Se eligió Terra por su equilibrio entre capacidad y costo. La IA es opcional: los cálculos y recomendaciones esenciales siguen funcionando localmente, sin cuenta ni API.

Decisión clave: el modelo nunca recibe correo, notas libres ni movimientos individuales. Solo recibe totales del mes, número de movimientos y categorías agregadas; la solicitud usa `store: false`.

## Probar como juez

1. Abre la [demo pública](https://prosperia-balance.vercel.app/).
2. Revisa los datos de ejemplo o pulsa **Empezar con mis datos**.
3. Registra una venta y un gasto; el resumen se actualiza inmediatamente.
4. La aplicación funciona sin credenciales. Para sincronización y análisis con IA, crea una cuenta mediante el enlace enviado por correo.

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
