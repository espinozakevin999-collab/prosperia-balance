# Reglas compartidas para agentes

## Misión

Prospería democratiza herramientas financieras para microemprendimientos. La audiencia incluye personas con educación primaria, baja alfabetización digital, teléfonos económicos y conexiones lentas.

## Reglas de producto

- Mantener la pantalla principal enfocada en: entró, salió y quedó.
- Usar español cotidiano. Preferir “dinero que entró” sobre “ingresos acumulados” y “lo que quedó” sobre “flujo neto”.
- Una acción primaria por tarea. Los detalles avanzados deben aparecer de forma progresiva.
- No usar únicamente color, iconos o gráficas para comunicar una cifra.
- Las funciones financieras esenciales deben funcionar sin IA y sin autenticación.
- La IA recibe resúmenes mínimos; nunca correo, notas libres ni claves.
- No exponer claves secretas en el cliente. Solo las variables `VITE_SUPABASE_*` pueden llegar al navegador.
- Toda tabla de usuario debe tener Row Level Security y políticas por `auth.uid()`.

## Forma de trabajar

- Crear ramas con prefijo `codex/` o `claude/`; no trabajar directamente en `main`.
- Mantener cambios pequeños y revisables. Explicar decisiones de UX en el pull request.
- Ejecutar `npm test` y `npm run build` antes de pedir revisión.
- Agregar pruebas para cálculos, importaciones y reglas de negocio nuevas.
- Probar a 360 px de ancho y con navegación por teclado.
- No eliminar ni reescribir trabajo de otro agente sin explicarlo en el PR.

## Criterio de terminado

Una función está terminada cuando una persona puede descubrirla, usarla, corregir un error y entender el resultado sin instrucciones externas; además, las pruebas y la compilación pasan.
