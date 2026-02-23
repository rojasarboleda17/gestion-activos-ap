# generate-sale-documents (baseline)

Edge Function baseline para docgen de venta **sin lógica de generación de PDF**.

## Estructura

- `index.ts`: skeleton compilable con `Deno.serve`.
- `deno.json`: configuración por función (recomendada en Supabase Edge Functions).
- `templates/PAQUETE TRASPASO.pdf`: plantilla base copiada desde la raíz del repositorio.

## Cómo invocar

Endpoint local (Supabase CLI):

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"saleId":"<uuid>"}'
```

Comportamiento actual del baseline:

- HTTP `200` para `POST`, con payload JSON informativo.
- HTTP `405` para métodos distintos a `POST`.
- HTTP `200` para preflight `OPTIONS`.

## Cómo probar local (sin deploy)


1. Servir la función:

   ```bash
   supabase functions serve generate-sale-documents --no-verify-jwt
   ```

2. Invocar con `curl`:

   ```bash
   curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
      -H 'Content-Type: application/json' \
      -d '{"sale_id":"00000000-0000-0000-0000-000000000000"}'
   ```

> Nota: este baseline no genera ni modifica PDFs todavía.

## Troubleshooting local

Si `supabase start` falla con un error como:

```
Bind for 0.0.0.0:54322 failed: port is already allocated
```

puedes resolverlo con alguna de estas opciones:

1. Detener el proyecto local que ya está usando puertos de Supabase:

   ```bash
   supabase stop --project-id <project-id>
   ```

2. Cambiar el puerto de base de datos en `supabase/config.toml` (sección `[db]`) para evitar el conflicto y volver a ejecutar `supabase start`.

3. Verificar qué proceso ocupa el puerto antes de reiniciar:

   ```bash
   lsof -i :54322
   ```

> `supabase functions serve generate-sale-documents` requiere que `supabase start` esté ejecutándose correctamente.


## ¿Qué hago ahora? (paso a paso)

Si estás en el mismo caso del error de puerto, ejecuta esto en orden:

1. Identifica si ya hay un proyecto de Supabase corriendo y detenlo:

   ```bash
   supabase stop --project-id <project-id>
   ```

2. Verifica si el puerto `54322` sigue ocupado:

   ```bash
   lsof -i :54322
   ```

3. Intenta levantar el stack otra vez:

   ```bash
   supabase start
   ```

4. Si vuelve a fallar por el mismo puerto, cambia el puerto de DB en `supabase/config.toml` (`[db]`) y repite `supabase start`.

5. Cuando `supabase start` quede arriba, recién ahí sirve la función:

   ```bash
   supabase functions serve generate-sale-documents
   ```

6. Prueba el endpoint:

   ```bash
   curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
     -H 'Authorization: Bearer <JWT>' \
     -H 'Content-Type: application/json' \
     -d '{"saleId":"00000000-0000-0000-0000-000000000000"}'
   ```

## Alcance de este baseline

- No implementa generación, edición ni firma de PDFs.
- No realiza deploy automático ni incluye pasos de despliegue.
- Solo valida wiring inicial para una Edge Function compilable.
