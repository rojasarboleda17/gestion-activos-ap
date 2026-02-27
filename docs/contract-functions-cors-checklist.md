# Contract Edge Functions CORS Checklist

## A) Deploy

```bash
supabase functions deploy enqueue-contract
supabase functions deploy get-contract-url2
```

## B) Test preflight (expect `200` + `Access-Control-Allow-Origin`)

```bash
curl -i -X OPTIONS "$SUPABASE_URL/functions/v1/enqueue-contract" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,apikey,content-type"
```

```bash
curl -i -X OPTIONS "$SUPABASE_URL/functions/v1/get-contract-url2" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,apikey,content-type"
```

## C) Test real (with valid JWT)

- POST `enqueue-contract` and expect `deal_document_id`.
- POST `get-contract-url2` and expect `url` (if `done`) or `409` (if pending/processing).

## D) Final browser/PWA acceptance

- In browser/PWA, **Generar contrato** must not throw `Failed to fetch`.
- In DevTools > Network:
  - OPTIONS `200` + POST `200/409` for both functions.
  - No CORS blocked requests.
