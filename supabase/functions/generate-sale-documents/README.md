# generate-sale-documents

Edge Function para obtener el contrato de payload de documentos de venta (sin generar PDFs todavía).

## Ejecutar local

```bash
supabase start
supabase functions serve generate-sale-documents --no-verify-jwt
```

> En deploy, la función corre con `verify_jwt=true`.

## Request

`POST /functions/v1/generate-sale-documents`

Body JSON:

```json
{
  "sale_id": "9fd4f7de-d8f4-4ec7-92db-0329ca63fdf0",
  "docs": ["contrato_compraventa", "mandato", "traspaso"]
}
```

- `sale_id`: requerido, UUID v4.
- `docs`: opcional, subset de `contrato_compraventa`, `mandato`, `traspaso`.
- si `docs` no viene, la función usa los 3 por defecto.

## Importante para pruebas

La función **siempre valida JWT** dentro del código (`Authorization: Bearer <JWT>`), aunque la sirvas con `--no-verify-jwt`.

- `--no-verify-jwt` desactiva la verificación en el gateway de Supabase Functions.
- Pero esta función hace `supabase.auth.getUser(token)` y si el token es placeholder (`<JWT_VALIDO>`) devolverá `401`.

## Obtener JWT válido (local)

Necesitas un token real de `access_token` para que pasen los casos `400/409/200`.

1) Crea usuario (si no existe):

```bash
curl -s 'http://127.0.0.1:54321/auth/v1/signup' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"docgen_test@example.com","password":"Test123456!"}'
```

2) Inicia sesión y extrae `access_token`:

```bash
curl -s 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' \
  -H 'apikey: <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"docgen_test@example.com","password":"Test123456!"}'
```

En la respuesta JSON toma `access_token`.

## Consulta SQL sencilla para obtener `sale_id` de pruebas

En **Supabase Studio → SQL Editor**, ejecuta esta consulta para ver ventas y su elegibilidad según la RPC:

```sql
with payloads as (
  select
    s.id as sale_id,
    s.created_at,
    public.rpc_get_sale_documents_payload(s.id) as payload
  from public.sales s
)
select
  sale_id,
  (payload -> 'eligibility' ->> 'can_generate')::boolean as can_generate,
  payload -> 'eligibility' -> 'reasons' as reasons,
  created_at
from payloads
order by created_at desc
limit 20;
```

Interpretación rápida:
- `can_generate = true` → caso candidato para **200**.
- `can_generate = false` → caso candidato para **409**.
- `can_generate = null` → la RPC no está retornando `eligibility` para ese registro; en ese caso no podrás validar **409** hasta que esa regla exista en el payload.

## Ejemplos curl

### OPTIONS (preflight)

```bash
curl -i -X OPTIONS 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST'
```

Nota: detrás de Kong puede verse `200` (gateway) en lugar de `204` (handler), ambos válidos como preflight exitoso si vienen headers CORS.

### 401 (sin auth)

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Content-Type: application/json' \
  -d '{"sale_id":"9fd4f7de-d8f4-4ec7-92db-0329ca63fdf0"}'
```

### 400 (sale_id inválido, con JWT real)

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Authorization: Bearer <ACCESS_TOKEN_REAL>' \
  -H 'Content-Type: application/json' \
  -d '{"sale_id":"123"}'
```

### 409 (sale no elegible / no activa)

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Authorization: Bearer <ACCESS_TOKEN_REAL>' \
  -H 'Content-Type: application/json' \
  -d '{"sale_id":"9fd4f7de-d8f4-4ec7-92db-0329ca63fdf0"}'
```

### 200 (ok)

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Authorization: Bearer <ACCESS_TOKEN_REAL>' \
  -H 'Content-Type: application/json' \
  -d '{"sale_id":"9fd4f7de-d8f4-4ec7-92db-0329ca63fdf0","docs":["contrato_compraventa","mandato"]}'
```
