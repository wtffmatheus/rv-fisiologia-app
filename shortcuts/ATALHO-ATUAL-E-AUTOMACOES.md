# Atalho atual e automações — 10/09/2026

## Link conferido

- Instalação: https://www.icloud.com/shortcuts/4a2347dfb1c945bf89873284c3e6ceeb
- Nome no iCloud: **RV - Sincronizar Saúde**. O botão de análise do RV agora usa esse nome, não `RV-ANALISE-ENXUTO-ASSINADO`. Confira se o iPhone não acrescentou um sufixo ao importar uma cópia.
- Inspeção do arquivo publicado: 69 ações; cinco consultas de Saúde; nenhum envio `workout_start`/`workout_end`; nenhuma leitura de entrada do atalho. Enviar o texto `start`, `sync` ou `end` NÃO transforma essa versão em uma integração de quatro modos.
- Coleta prevista: frequência cardíaca, frequência em repouso, HRV/SDNN, passos e energia ativa. Não consulta distância, frequência respiratória nem oxigenação.
- O link no RV foi substituído. Isso não modifica o arquivo publicado no iCloud nem as automações instaladas no telefone.

## Restaurar o início e o fim pelo Watch

As automações pessoais são separadas do atalho compartilhado. Não apague as que já funcionavam e não substitua seus POSTs por uma chamada ao atalho de análise.

1. No **iPhone**, abra **Atalhos → Automação** e edite a automação antiga de início.
2. Confirme **Exercício Apple Watch → Qualquer Exercício → Início**. Deixe ativa e em **Executar imediatamente**; se aparecer **Perguntar Antes de Executar**, desative essa confirmação.
3. Preserve a ação que fazia POST para `health-ingest` com `workout_start` e a chave válida. Não é suficiente executar `RV - Sincronizar Saúde` com entrada `start`.
4. Na automação separada de fim, confirme **Exercício Apple Watch → Qualquer Exercício → Fim**, execução imediata e preserve o POST `workout_end`. Não use uma única automação de início/fim enviando sempre o mesmo evento.
5. Teste cada automação com ▶ no iPhone desbloqueado. Depois faça um único treino no Watch. Não inicie também manualmente pelo RV/outra automação: houve dois STARTs separados por aproximadamente dez segundos no teste das 16:55.
6. Se ▶ funciona mas o Watch não dispara, precisamos do print do gatilho, tipo de exercício e configuração de execução. Se ▶ falha, precisamos da ação com erro/resposta do POST. Oculte toda chave `rvh_`.

Se as automações antigas foram apagadas, envie os prints do estado atual antes de reconstruí-las. Não reutilize a receita `Texto start/end → Executar RV Saúde` do candidato não assinado com este link de análise.

Para tentar coleta automática ao terminar, primeiro valide START/END isoladamente. Depois, na automação de fim, mantenha o POST `workout_end` como primeira operação e acrescente **Executar Atalho → RV - Sincronizar Saúde**, sem entrada. Isso é uma tentativa de coleta, não uma garantia de que o Watch já entregou todas as leituras. Não coloque a coleta antes do END: uma permissão/erro na coleta não deve impedir o encerramento. Se faltarem dados, repita a análise quando as leituras estiverem no Saúde do iPhone. Não use loops de espera para simular streaming.

## O que os três prints mostram

- Às 16:53, o último treino exibido é o teste de **01:50**, com dez segundos e sem BPM; não é evidência de um treino novo iniciado às 16:53.
- O cartão mostra **35.564 kcal**: corresponde ao arredondamento da soma de 236 amostras antigas (`35.563,92`), não às calorias de um único treino.
- O aviso de seis amostras descartadas não significa seis categorias ausentes. Trata-se de registros inválidos/repetidos.
- A consulta somente leitura posterior aos prints encontrou um treino concluído às 16:57 com 88 leituras vinculadas. Isso não comprova que os horários originais estejam corretos: os registros recentes continuam praticamente coincidentes com a recepção.
- Após 16h, chegaram 124 leituras de BPM e eventos; a última energia e os últimos passos continuam de **01:45**. Nenhum HRV, frequência respiratória, oxigenação ou distância foi encontrado na janela consultada. Portanto, o horário geral mais recente da análise não comprova atualização de todas as métricas.

## Por que a coleta pode estar incompleta

O atalho faz um POST por amostra, primeiro para todos os BPM selecionados e só depois para repouso, HRV, passos e energia. Os prints posteriores do editor esclareceram que BPM, repouso, passos e energia usam **hoje**, enquanto HRV usa **últimos sete dias**. Uma execução longa, interrompida ou com erro nessa primeira parte pode não alcançar as demais. É uma hipótese compatível com a sequência recebida, não uma confirmação do erro no iPhone.

O arquivo referencia `Start Date → Formatar Data ISO 8601 → measured_at`, mas o banco ainda registra horários quase iguais aos de envio. É necessário conferir o valor efetivo dessa variável no iPhone: o backend antigo aceita timestamp ausente e usa o momento da requisição. Não substitua a data da amostra por Data Atual e não remova separadores decimais para converter quantidades. A diferença de filtros foi confirmada pelos prints; veja `../REVISAO_EDITOR_E_PRINTS.md` para a análise atualizada.

A mensagem final “Análise enviada” não verifica a resposta de cada POST. Sem `ok`/`saved` válidos, não comprova que a coleta inteira foi salva. Para investigar, inspecione localmente uma amostra e a resposta correspondente, ocultando a chave; não compartilhe exportações de Saúde completas.

## Alterações e validação desta rodada

- Link e nome atualizados no código e em `.env.example`; nenhum modo inexistente foi ativado. O link também aparece em **Gerenciar conexão**, para quem já conectou.
- A análise mostra campos sem leituras, identifica categorias não coletadas por esse atalho e mostra o horário mais recente de cada métrica. Receber BPM não marca a integração inteira como pronta.
- Treinos sem BPM/calorias recebem aviso de relatório parcial. Não foram inventadas leituras nem apagados registros antigos.
- Build TypeScript/Vite, 11 verificações da configuração e teste de interface com dados simulados passaram. Conferidos: oito cartões, categorias ausentes/não coletadas, relatório parcial, links, instruções e ausência de transbordamento horizontal em 320/390/1280 px. Nenhum erro de execução na página de teste. Captura local em `output/validation/shortcut-ui-mobile.png`.
- Sem deploy, alterações no banco, troca de chave ou edição remota das automações nesta rodada. A consulta ao Supabase confirma que a ingestão continua na v2 e a migração de endurecimento local ainda não foi aplicada. A interface mostrada nos prints já contém mensagens da revisão local anterior; frontend e backend estão em estágios diferentes.
- A validação no aparelho e os prints das duas automações continuam necessários. Atualizar/publicar o frontend não instala automações no iPhone.

## Referências Apple

- [Acionadores de evento: início/fim e tipo de exercício](https://support.apple.com/pt-br/guide/shortcuts/apd932ff833f/ios).
- [Ativar a execução automática](https://support.apple.com/pt-br/guide/shortcuts/apd602971e63/ios).
- [Execução de atalhos por nome e entrada](https://support.apple.com/pt-br/guide/shortcuts/apd624386f42/ios).
