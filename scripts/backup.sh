#!/usr/bin/env bash
#
# Backup do PostgreSQL do LocaTech.
#
# Comportamento:
#   1. Roda pg_dump com formato custom (-Fc) — comprimido e portável
#   2. Salva em $BACKUP_DIR/locatech-YYYY-MM-DD-HHMMSS.dump
#   3. Aplica retenção local: mantém apenas os $LOCAL_RETENTION_DAYS últimos
#   4. (Opcional) Se $BACKUP_S3_BUCKET definido, faz upload via aws cli e
#      aplica retenção remota via lifecycle policy do bucket (configurar manual)
#
# Variáveis:
#   DATABASE_URL          — string de conexão completa (obrigatório)
#   BACKUP_DIR            — onde salvar local (default: ./backups)
#   LOCAL_RETENTION_DAYS  — quantos dias manter local (default: 7)
#   BACKUP_S3_BUCKET      — opcional; se setado, faz upload via `aws s3 cp`
#   BACKUP_S3_PREFIX      — opcional; default: "locatech/"
#
# Uso:
#   bash scripts/backup.sh
#
# Cron sugerido (3:30 AM diário):
#   30 3 * * * cd /home/ubuntu/locatech && bash scripts/backup.sh >> /var/log/locatech-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-7}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-locatech/}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL não definida"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
FILENAME="locatech-${TIMESTAMP}.dump"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

echo "[$(date -Iseconds)] Iniciando backup..."

# pg_dump com formato custom (compressão + restore seletivo possível)
pg_dump "$DATABASE_URL" -Fc -f "$FILEPATH"

SIZE=$(du -h "$FILEPATH" | cut -f1)
echo "[$(date -Iseconds)] Backup local concluído: $FILEPATH ($SIZE)"

# Upload S3 opcional
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  if command -v aws &> /dev/null; then
    echo "[$(date -Iseconds)] Enviando pra s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}${FILENAME}"
    aws s3 cp "$FILEPATH" "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}${FILENAME}" --no-progress
    echo "[$(date -Iseconds)] Upload concluído"
  else
    echo "[$(date -Iseconds)] WARN: BACKUP_S3_BUCKET setado mas aws CLI não está instalada"
  fi
fi

# Retenção local
DELETED=$(find "$BACKUP_DIR" -name "locatech-*.dump" -mtime "+${LOCAL_RETENTION_DAYS}" -delete -print | wc -l || true)
echo "[$(date -Iseconds)] Retenção: $DELETED arquivo(s) antigos removidos"

echo "[$(date -Iseconds)] Backup OK"
