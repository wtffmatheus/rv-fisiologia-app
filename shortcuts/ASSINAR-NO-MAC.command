#!/bin/zsh
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v shortcuts >/dev/null 2>&1; then
  printf '%s\n' 'A ferramenta shortcuts do macOS é necessária.'
  exit 1
fi
if grep -Eq 'rvh_[a-f0-9]{48}' RV-Saude-v1-NAO-ASSINADO.shortcut; then
  printf '%s\n' 'Não assine/compartilhe uma cópia que contém código pessoal. Use o arquivo original sem chave.'
  exit 1
fi
shortcuts sign --mode anyone --input RV-Saude-v1-NAO-ASSINADO.shortcut --output RV-Saude-v1-ASSINADO.shortcut
printf '%s\n' 'Envie RV-Saude-v1-ASSINADO.shortcut ao iPhone. Ainda precisa ser validado no aparelho.'
