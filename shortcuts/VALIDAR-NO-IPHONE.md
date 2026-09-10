# RV Saúde — candidato para validação, NÃO versão oficial

**Não aplique as instruções de quatro modos deste documento ao link iCloud `4a2347dfb1c945bf89873284c3e6ceeb`.** O arquivo desse link foi inspecionado e continua sendo somente análise, embora se chame `RV - Sincronizar Saúde`. Para ele, siga [Atalho atual e automações](ATALHO-ATUAL-E-AUTOMACOES.md) e preserve os POSTs START/END anteriores. Esta página descreve apenas o candidato local não assinado.

## Antes de transferir

O arquivo `RV-Saude-v1-NAO-ASSINADO.shortcut` foi gerado e verificado estruturalmente. **Não foi executado no iOS, não está assinado e não é uma entrega instalável validada.** Trocar a extensão ou reutilizar a assinatura do atalho antigo não resolve isso.

Em um Mac com Atalhos, copie esta pasta e execute `zsh ASSINAR-NO-MAC.command`. O comando oficial envia a cópia SEM chave pessoal à Apple para assinatura. Depois envie `RV-Saude-v1-ASSINADO.shortcut` ao iPhone por AirDrop/Arquivos. Sem acesso a um Mac, a assinatura continua pendente; não exclua o atalho antigo.

## O que foi implementado na fonte

- Um atalho, nome de instalação desejado **RV Saúde**. Se o iPhone usar o nome do arquivo, renomeie para esse nome.
- Sem entrada: menu com Analisar, Iniciar, Sincronizar e Finalizar.
- Entrada de automação: `analysis`, `start`, `sync`, `end`, em minúsculas, sem abrir menu.
- Código solicitado na configuração/importação, guardado na primeira ação Texto. Sem leitura automática do clipboard ou arquivo de token em cada execução. Se a pergunta de importação não aparecer, cole o código somente nessa primeira ação Texto; nunca edite headers/JSON.
- Análise: até sete dias de HR, repouso, HRV, passos e energia. Sync/End: últimas 24h de HR, passos e energia; sem consultas opcionais de HRV/repouso nessas rotinas.
- POSTs em lotes de até 200 amostras por métrica, em vez de uma requisição por leitura. Não exige aumentar as permissões de compartilhamento em massa globalmente.
- Extração de Value → cálculo numérico +0 → campo JSON numérico; Unit original e Start Date original formatado ISO 8601. Nenhuma divisão arbitrária de valores gigantes. **Só o teste no iPhone confirma se a conversão de Quantity ficou correta.**
- Estado de sessão em `Shortcuts/RV-Workout-State.txt`, sem token nesse arquivo. Início conserva identidade para retry; fechamento só marca estado local fechado após confirmação do servidor.
- Finalizar tenta reenviar a janela recente ANTES de enviar workout_end. Pode ser repetido após erro de rede. Amostras anteriores ao treino são associadas pelo backend segundo seus timestamps; não são automaticamente todas contabilizadas nesse treino.
- Sucesso exige `ok` do endpoint. Falha interrompe antes do fechamento local; nenhum alerta afirma que tudo foi sincronizado incondicionalmente.

## Teste curto, nesta ordem

1. Guarde o atalho antigo e desative temporariamente as automações antigas: **não rode dois START/END em paralelo**. Comece pelo iPhone desbloqueado, não pelo Watch.
2. Importe, configure uma chave do RV e execute **Analisar**. Autorize somente o endpoint do seu Supabase e as categorias de Saúde usadas. Se o iOS oferecer “Permitir sempre”, escolha apenas para os acessos necessários. Permissões obrigatórias não são removíveis pelo arquivo.
3. Confirme no RV que não aparecem valores gigantes. Rode Analisar novamente: totais não devem multiplicar. Sem leitura de repouso, não deve surgir repouso inventado.
4. Execute **Iniciar**. Confira uma sessão ativa. Execute Iniciar novamente: não deve criar outro treino.
5. Aguarde leituras de Saúde e execute **Sincronizar**. Compare último BPM/timestamp com Saúde. Ausência de HRV/repouso não deve interferir no treino.
6. Execute **Finalizar**. Confira sessão concluída no histórico. Repita: deve informar que não há treino local aberto, sem criar outro.
7. Só depois configure as automações abaixo. Se um teste falhar, pare; mande print da ação vermelha e da mensagem, **ocultando o código rvh_**. Não informe que está validado apenas porque importou.

## Personal Automations — sem POST manual

- Exercício Apple Watch → Foi iniciado → Executar imediatamente.
- Ação **Texto** com `start` → **Executar Atalho** RV Saúde, usando esse Texto como entrada.
- Outra automação: Exercício Apple Watch → Está terminado → Texto `end` → Executar Atalho RV Saúde, com o Texto como entrada.
- Rode cada automação pelo botão ▶ antes de testar o gatilho do Watch.
- Para sync manual: menu do RV Saúde → Sincronizar; não inventar gatilho periódico de segundos.
- Se o gatilho não disparar, execute Iniciar/Finalizar manualmente no iPhone. O arquivo não conserta o sistema de automações do iOS. Execução direta no Watch NÃO foi validada.

## Limites que precisam ficar claros

- A importação dos parâmetros novos de menu/lista/batch/condição booleana precisa ser testada no aparelho; validação plist não prova que o editor Apple os aceita.
- Lotes podem ser aceitos parcialmente pelo backend; `ok` sozinho não prova que todas as leituras foram aceitas. Compare dados no RV e respostas accepted/rejected antes de produção.
- Reenvio não baixa nova permissão, mas a privacidade é controlada pelo iOS. Leitura de Saúde, internet e arquivo de estado podem pedir autorização inicial. Não desative proteções globais para tentar “fazer funcionar”.
- Estado local não é uma transação do servidor; não executar simultaneamente em vários dispositivos. Se o servidor iniciar e a conexão cair, repetir START conserva a identidade persistida. Se a automação não chegou a rodar, não haverá START para reconciliar.
- Sync/End abrangem 24h, não uma reconciliação ilimitada. Treinos abandonados/longos e dados que chegarem do Watch depois do END requerem validação adicional e retry de sync antes de considerar o histórico final.
- A produção ainda usa o backend anterior: endurecimentos locais do checkup não foram publicados. Dados antigos corrompidos continuam exigindo tratamento; esta fonte não os limpa.
- Após inserir sua chave, **não compartilhe/exporte essa cópia**; ela passa a conter um segredo e pode sincronizar pelo iCloud. Revogue a chave no RV se compartilhar sem querer.
- O app aponta para o link de análise informado em 10/09/2026, não para este candidato. Os quatro modos continuam desativados para esse link.

## Fontes Apple

- Assinatura oficial: https://support.apple.com/en-ca/guide/shortcuts-mac/-apd455c82f02/mac
- Privacidade: https://support.apple.com/guide/shortcuts/adjust-privacy-settings-apd961a4fc65/ios

Gerar novamente: `python shortcuts/build_rv_shortcut.py caminho/para/atalho-original.shortcut`. Base utilizada: plist real do link iCloud informado pelo usuário, não assinatura reaproveitada.
