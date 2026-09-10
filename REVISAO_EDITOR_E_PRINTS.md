# Revisão do editor e dos prints — 10/09/2026

## Retorno inesperado da personal

Foi reproduzida localmente uma perda de rascunho compatível com a reclamação, sem acessar a conta da personal ou alterar atividades reais:

- `App.tsx` recarregava o perfil em cada evento de autenticação. Mesmo com perfil válido do mesmo usuário, substituía toda a área por uma tela de carregamento. Isso desmontava o editor; ao voltar, sua navegação interna e seus campos eram reiniciados.
- A consulta de perfil continua existindo, mas uma atualização em segundo plano não desmonta mais a área já autenticada. Logout, troca de usuário e perfil bloqueado não recebem essa exceção. Falha na consulta continua com o comportamento de erro anterior; a correção não é uma garantia contra perda de dados ao ficar offline ou fechar o app.
- O editor trocava de componente ao cruzar 820 px, perdendo o estado local. Agora escolhe móvel/desktop ao abrir e mantém essa escolha até sair da área. Redimensionar não substitui o formulário.
- O atualizador adiava o reload apenas enquanto um campo estivesse focado. Agora também adia enquanto a área do editor estiver montada, inclusive ao abrir o seletor de vídeo ou tirar o foco do campo.
- O service worker forçava navegação de todas as janelas ao ativar uma versão. Essa navegação coletiva foi removida. O atualizador da página continua podendo atualizar fora da edição.

### Verificação

Teste de navegador com `App` e `AdminContentEntry` reais, sessão e formulário simulados:

1. Condição antiga: `SIGNED_IN` do mesmo usuário apagou o rascunho — reproduzido.
2. Condição corrigida: rascunho preservado em `SIGNED_IN`, `TOKEN_REFRESHED` e redimensionamento de 390 para 1000 px.
3. Perfil bloqueado e logout ainda retiram a área administrativa.
4. Teste isolado: editor aberto bloqueia atualização mesmo sem input focado; ativação do worker não navega abas.
5. Build TypeScript/Vite e `git diff --check` passaram.

Não foi reproduzida a sequência exata no aparelho da personal, nem feito um upload real de atividade/vídeo. Nenhuma alteração desta rodada foi publicada. Rascunhos perdidos antes da correção não foram recuperados.

Referência: [eventos de autenticação do Supabase](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).

## O que os novos prints do atalho comprovam

- São telas do editor de **RV - Sincronizar Saúde**, não telas das duas automações pessoais de início/fim. Continuam sem comprovar a configuração dos gatilhos do Watch.
- BPM, repouso, passos e energia estão filtrados por **Data de Início é hoje**. HRV está nos **últimos 7 dias**. Portanto, não é correto esperar que essa execução reenvie sete dias de todas as categorias. Os números `Unit/Number` internos do plist anterior não bastavam para interpretar a condição de data; os rótulos exibidos no iPhone esclarecem a diferença.
- HRV mostra **Unidade: Nenhuma** na consulta. Isso sozinho não prova erro: é necessário verificar a unidade efetivamente retornada por “Obter Unidade” e enviada ao endpoint. O backend espera `ms` para HRV.
- Energia ativa mostra unidade **cal**, enquanto o RV apresenta **kcal**. É preciso conferir o par valor/unidade no JSON real. Não basta trocar o texto da unidade: `cal` e `kcal` diferem por 1000. O normalizador local converte `cal` explicitamente; a versão antiga em produção ainda precisa de atualização/validação.
- A ação “Obter Data de Início” está presente, mas os prints não mostram os campos expandidos de cada POST. Ainda não comprovam que `measured_at` recebe essa data formatada, que `value` é numérico e que o header usa a chave correta.
- A coleta continua sequencial, com um envio por amostra e energia no final. Interrupção/erro no bloco de BPM pode impedir as categorias seguintes; não foi confirmado se isso ocorreu no aparelho.
- A mensagem final de análise enviada é estática, não comprova a aceitação de cada leitura.

### Próxima validação no telefone

1. Se a intenção é analisar sete dias, usar o mesmo filtro **está nos últimos 7 dias** nas cinco consultas. Se a intenção é somente hoje, comparar somente esse dia e não esperar recuperar treinos anteriores.
2. Conferir uma ação **Obter conteúdo de URL** expandida: POST, header com chave ocultada, JSON `metric`, `value`, `unit`, `measured_at`. `measured_at` deve apontar para a data original da amostra formatada em ISO 8601.
3. Conferir uma leitura real de energia e sua unidade no Saúde e no JSON antes de comparar com as calorias ativas do Fitness. Não usar o total com repouso como comparação.
4. Para o acionamento automático, ainda são necessários os prints de **Atalhos → Automação → Exercício Apple Watch**, início e fim, ocultando a chave.
