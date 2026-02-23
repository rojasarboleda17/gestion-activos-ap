# generate-sale-documents (baseline)

Edge Function baseline para docgen de venta con un probe de lectura del template.

## Servir localmente

```bash
supabase functions serve generate-sale-documents --no-verify-jwt
```

## Probar sin auth

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## Nota sobre JWT

En `supabase/config.toml`, la función puede mantenerse con `verify_jwt=true`.
En ese modo también se puede invocar usando JWT-based keys (`anon` o `service_role`).
