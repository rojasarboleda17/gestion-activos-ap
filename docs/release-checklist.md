# Release Checklist

Este checklist es **bloqueante** para cerrar un deploy.

## 1) Calidad de frontend

- [ ] `npm run lint`
- [ ] `npm run build`

## 2) Gate SQL post-deploy (obligatorio)

- [ ] Ejecutar `npm run release:sql-gate` sobre la base de datos del entorno desplegado (`DATABASE_URL` apuntando al entorno objetivo).
- [ ] Guardar evidencia del resultado en el PR/release notes.
- [ ] Confirmar resultado final: `0` checks en `FAIL`.

## Criterio de bloqueo

Si cualquier check de `supabase/checks/post_deploy_audit.sql` devuelve `FAIL`, el deploy queda **abierto** y no se puede cerrar hasta corregir y re-ejecutar el gate con resultado limpio.
