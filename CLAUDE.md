# Guía para Claude

Lee primero `AGENTS.md` y `README.md`.

Trabaja en una rama `claude/<tarea>`. Antes de modificar código, resume en el PR:

1. Qué problema humano resuelve el cambio.
2. Cómo se mantiene simple para una persona con poca experiencia digital.
3. Qué datos toca y cómo protege la privacidad.
4. Qué pruebas validan el resultado.

La referencia visual es el dashboard original de Prospería: verde profundo, fondo cálido, tarjetas claras y navegación predecible. Moderniza sin aumentar la carga cognitiva.

No cambies el modelo de datos, autenticación, políticas RLS ni la función de OpenAI sin una explicación explícita de seguridad y compatibilidad. No agregues frameworks o dependencias si el mismo resultado puede lograrse de manera clara con la base existente.

Antes de terminar ejecuta:

```bash
npm test
npm run build
```

Incluye en el PR una captura de escritorio y otra de móvil cuando cambies la interfaz.
