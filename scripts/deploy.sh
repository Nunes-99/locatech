#!/usr/bin/env bash
#
# Deploy do LocaTech numa VM (Oracle/AWS EC2/Hetzner/etc).
#
# Pré-requisitos na VM:
#   - Docker + Docker Compose
#   - Git clone deste repo em /home/<user>/locatech
#   - .env.production preenchido (NEXTAUTH_*, DATABASE_URL, CRON_SECRET, etc)
#   - POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB em .env (raiz)
#
# Uso (do PC local, com SSH configurado):
#   bash scripts/deploy.sh <user@host>
#
# Comportamento (sequencial pra não estourar memória em VMs pequenas):
#   1. SSH na VM e git pull origin master
#   2. docker compose build (cada serviço sequencial)
#   3. docker compose up -d
#   4. Mostra status final

set -euo pipefail

SSH_TARGET="${1:-}"
if [[ -z "$SSH_TARGET" ]]; then
  echo "Uso: bash scripts/deploy.sh <user@host>"
  echo "  ex: bash scripts/deploy.sh ubuntu@locatech.com.br"
  exit 1
fi

REMOTE_DIR="${REMOTE_DIR:-/home/${SSH_TARGET%@*}/locatech}"

ssh_run() {
  ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=60 "$SSH_TARGET" "$@"
}

echo "==> [1/5] Atualizando código na VM..."
ssh_run "cd $REMOTE_DIR && git pull origin master"

echo "==> [2/5] Build dos containers (sequencial)..."
ssh_run "cd $REMOTE_DIR && docker compose build postgres"
ssh_run "cd $REMOTE_DIR && docker compose build app"
ssh_run "cd $REMOTE_DIR && docker compose build nginx"

echo "==> [3/5] Subindo stack..."
ssh_run "cd $REMOTE_DIR && docker compose up -d"

echo "==> [4/5] Aguardando app ficar saudável..."
for i in {1..30}; do
  if ssh_run "curl -sf http://localhost:3000/api/health > /dev/null 2>&1"; then
    echo "    ✓ App respondendo"
    break
  fi
  sleep 2
done

echo "==> [5/5] Status final:"
ssh_run "cd $REMOTE_DIR && docker compose ps"

echo ""
echo "Deploy concluído. Próximos passos:"
echo "  - Verificar logs: ssh $SSH_TARGET 'cd $REMOTE_DIR && docker compose logs --tail=50 app'"
echo "  - Configurar HTTPS: ver nginx/nginx.conf e rodar certbot"
