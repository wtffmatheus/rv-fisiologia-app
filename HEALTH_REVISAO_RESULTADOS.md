# Revisão dos resultados de Saúde

## Evidência da produção — 10/09/2026

Consultas somente leitura no Supabase:

- Os quatro treinos mais recentes (inícios 04:47, 04:48, 04:49 e 04:50 UTC) têm exatamente duas amostras: START e END. Nenhum tem leitura cardíaca. Não é possível preencher BPM/calorias a partir desses eventos.
- Num treino antigo de cerca de oito segundos, todas as 133 leituras de energia vinculadas foram registradas após o fim; somavam 12.971,35 kcal. O frontend somava essas leituras, embora excluísse parte das leituras cardíacas pós-treino.
- Em outra sessão, 105 das 145 leituras cardíacas associadas estavam fora do intervalo.
- 1.651/1.652 leituras cardíacas e todas as 236 leituras de energia têm measured_at a menos de dois segundos de received_at; nenhuma dessas leituras tem source_id ou metadata. Isso é forte indício de horários de envio usados como horários das amostras, mas não prova que toda leitura próxima da recepção esteja errada.
- Os HR armazenados examinados variam de 59 a 119 bpm. Isso não comprova correspondência com o mesmo instante do relógio. Há energia de até 5.373 kcal por leitura, cuja origem não pode ser reconstruída a partir dos campos existentes.
- A Edge Function live continua na v2 e o trigger live ainda contém divisão arbitrária por 10^14 e janela de associação de -10/+5 minutos. As correções do repositório ainda não estão em produção.

## Correções locais desta revisão

- Filtro único por início/fim, aplicado a BPM, calorias, passos, distância e gráfico. Usa measured_at, não received_at: uma amostra que chega atrasada continua válida se seu horário ORIGINAL pertence ao treino.
- O detalhe informa explicitamente quando só recebeu início/fim e nenhuma leitura válida. Não preenche resultados com zero, estimativas ou leituras de outro horário.
- Análise do período inclui leituras válidas associadas a sessões; antes elas eram excluídas indiscriminadamente.
- Amostras inválidas/duplicadas descartadas na carga recebem aviso visível.
- Migração ainda pendente de publicação deixa de associar dados dez minutos antes/cinco minutos depois do treino. Não altera o acionamento das automações.
- Normalizador converte kJ→kcal e cal→kcal apenas quando a unidade está explicitamente declarada; Cal continua kcal. Não divide números gigantes para adivinhar casas decimais.
- Endpoint local informa índice/motivo dos itens rejeitados e identifica timestamp original ausente. Nenhuma chave ou valor de saúde é incluído nesse diagnóstico.

## Validado

- Build TypeScript/Vite passou.
- Dez assertions de regressão passaram: intervalo, evento sem métricas, outra sessão, dados pré-treino, chegada atrasada, outlier, unidades, dedupe e timestamp ausente.
- Teste PostgreSQL isolado passou novamente: START/retry/associação/END/retry/substituição/stale.
- Verificação de sintaxe do endpoint e git diff --check passaram.

## Para a validação no telefone

1. Publicar conjuntamente o frontend e o backend revisados após conferir a compatibilidade dos payloads das automações. **Nesta revisão não houve deploy, migration live, limpeza de banco ou alteração nas automações que funcionam.**
2. Manter START/END. Eles comprovam o gatilho, não a coleta de Health.
3. A coleta precisa enviar metric, valor numérico, unidade e measured_at da amostra original, não “Data atual”. Conferir isso na ação de envio do atalho efetivamente instalado. Sem o horário original, não há dedupe/associação confiáveis.
4. Após o relógio disponibilizar leituras ao Saúde do iPhone, executar a coleta e verificar accepted/rejected e amostras recebidas. Testar somente START/END em poucos segundos não comprova a coleta de métricas.
5. Repetir a coleta não deve multiplicar calorias/passos. Comparar o MESMO intervalo e calorias ativas (não o total que inclui repouso) com o Watch.

Os dados históricos sem origem/horário confiável não foram apagados nem “corrigidos” com multiplicadores. O problema de coleta no atalho instalado continua dependendo da validação do payload no aparelho; o código React não consegue buscar HealthKit nem recuperar amostras que nunca chegaram.
