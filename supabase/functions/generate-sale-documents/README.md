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

1. Levantar stack local de Supabase:

   ```bash
   supabase start
   ```

2. Servir la función:

   ```bash
   supabase functions serve generate-sale-documents
   ```

3. Invocar con `curl`:

   ```bash
   curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
     -H 'Authorization: Bearer <JWT>' \
     -H 'Content-Type: application/json' \
     -d '{"saleId":"00000000-0000-0000-0000-000000000000"}'
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

## Alcance de este baseline

- No implementa generación, edición ni firma de PDFs.
- No realiza deploy automático ni incluye pasos de despliegue.
- Solo valida wiring inicial para una Edge Function compilable.
