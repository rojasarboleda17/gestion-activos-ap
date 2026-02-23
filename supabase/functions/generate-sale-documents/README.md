# generate-sale-documents

Edge Function para obtener el contrato de payload de documentos de venta (sin generar PDFs todavía).

## Ejecutar local

```bash
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

## Ejemplos curl

### 401 (sin auth)

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Content-Type: application/json' \
  -d '{"sale_id":"9fd4f7de-d8f4-4ec7-92db-0329ca63fdf0"}'
```

### 400 (sale_id inválido)

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"sale_id":"123"}'
```

### 409 (sale no elegible / no activa)

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"sale_id":"9fd4f7de-d8f4-4ec7-92db-0329ca63fdf0"}'
```

### 200 (ok)

```bash
curl -i -X POST 'http://127.0.0.1:54321/functions/v1/generate-sale-documents' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"sale_id":"9fd4f7de-d8f4-4ec7-92db-0329ca63fdf0","docs":["contrato_compraventa","mandato"]}'
```
