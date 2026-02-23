# generate-sale-documents (baseline)

Edge Function baseline para docgen de venta con un probe de runtime.

## Qué valida esta baseline

La función:
- Acepta `POST`.
- Lee el archivo `./templates/PAQUETE TRASPASO.pdf`.
- Responde JSON con `template_bytes` (cantidad de bytes leídos).

No implementa todavía lógica de Supabase ni rellenado de PDF.

## Opción A (recomendada): probar vía Supabase Functions

1. Levanta el stack local:

```bash
supabase start
```

2. Sirve la función (sin verificar JWT para la prueba local):

```bash
supabase functions serve generate-sale-documents --no-verify-jwt
```

> `supabase functions serve` se ejecuta en foreground. Déjalo corriendo en esa terminal.

3. En otra terminal, prueba el endpoint:

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Respuesta esperada: `HTTP/1.1 200` con JSON que incluye `ok: true` y `template_bytes`.

## Opción B (fallback): ejecutar directo con Deno

Si en tu entorno `supabase functions serve` exige `supabase start` y no puedes levantarlo por puertos o Docker, puedes validar el runtime directo:

```bash
cd supabase/functions/generate-sale-documents
deno run --allow-net --allow-read --allow-env index.ts
```

En otra terminal:

```bash
curl -i -X POST 'http://127.0.0.1:8000' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## Nota sobre JWT

En `supabase/config.toml`, la función puede mantenerse con `verify_jwt=true`.
En ese modo también se puede invocar usando JWT-based keys (`anon` o `service_role`).

## Troubleshooting rápido

- **404 en `/functions/v1/generate-sale-documents`**:
  - Verifica que `supabase functions serve generate-sale-documents --no-verify-jwt` siga corriendo.
  - Ejecuta el `curl` en otra terminal (no en la misma donde está `serve`).
- **405 Method Not Allowed**:
  - La función solo acepta `POST`.
