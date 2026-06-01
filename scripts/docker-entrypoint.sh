#!/usr/bin/env bash
#
# Entrypoint do container — roda migrations Prisma antes de subir o Next.js.
# Isso garante que o schema esteja em sync quando o app começar a atender.
#
# Se a migration falhar, o container falha (fail fast — não queremos servir
# com schema desatualizado).

set -euo pipefail

echo "[entrypoint] Aplicando migrations Prisma..."
npx prisma migrate deploy

echo "[entrypoint] Migrations OK, iniciando Next.js..."
exec "$@"
