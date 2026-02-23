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
