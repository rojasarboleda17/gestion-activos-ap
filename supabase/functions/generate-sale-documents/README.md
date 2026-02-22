# generate-sale-documents (baseline)

Edge Function baseline para documentación de venta **sin lógica de generación de PDF**.

## Estructura

- `index.ts`: skeleton compilable con `Deno.serve`.
- `deno.json`: configuración por función (imports + strict mode).
- `templates/`: directorio para plantilla local `PAQUETE TRASPASO.pdf` (no versionada).

## Invocación

Endpoint esperado en local (Supabase CLI):

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"saleId":"<uuid>"}'
```

Respuesta actual (baseline):

- HTTP `200` para `POST` con payload JSON de estado.
- HTTP `405` para métodos distintos a `POST`.


## Plantilla PDF local

Para pruebas locales, copia manualmente la plantilla al directorio `templates/`:

```bash
cp "PAQUETE TRASPASO.pdf" "supabase/functions/generate-sale-documents/templates/PAQUETE TRASPASO.pdf"
```

> En este baseline no se versionan binarios dentro de `supabase/functions/**` para evitar rechazos en flujos de extracción/diff.

## Prueba local (sin deploy)

1. Levantar Supabase local:

   ```bash
   supabase start
   ```

2. Servir la función:

   ```bash
   supabase functions serve generate-sale-documents --no-verify-jwt
   ```

3. Probar con `curl`:

   ```bash
   curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
     -H 'Content-Type: application/json' \
     -d '{"saleId":"00000000-0000-0000-0000-000000000000"}'
   ```

> Nota: este baseline no genera ni modifica PDFs todavía.
