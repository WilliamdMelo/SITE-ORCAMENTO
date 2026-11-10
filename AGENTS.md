# Regras permanentes do projeto

## Escopo

- Projeto correto: `C:\Users\William Melo\Desktop\CODEX\Projetos\SITE ORCAMENTO`.
- Não usar a pasta homônima na Área de Trabalho como fonte do projeto.
- Preservar alterações locais não commitadas; nunca executar reset destrutivo,
  checkout destrutivo ou limpeza ampla sem autorização explícita.

## Regras de negócio

- Não alterar fórmulas, preços, taxas, arredondamentos, classificação de itens,
  regras de desconto/acréscimo, locação ou conteúdo comercial sem autorização.
- Mudanças de interface devem manter os mesmos fluxos, dados e exportações.
- O total da proposta deve permanecer verificável pela soma dos componentes.

## Coordenação multiagente

- O coordenador divide o trabalho em escopos pequenos e aprova implementações.
- Auditor, Designer UI/UX e Tester/QA trabalham em modo somente leitura por
  padrão; apenas o Desenvolvedor Sênior edita, e somente após aprovação.
- Agentes não editam simultaneamente os mesmos arquivos.
- Fluxo: auditoria → design (quando aplicável) → escopo aprovado → implementação
  → QA → revisão do auditor → relatório do coordenador.

## Segurança e dados

- Nunca versionar chaves privadas, tokens, senhas, service-role keys ou `.env`.
- Validar entradas externas e manter autorização no backend/Supabase, não apenas
  em controles de frontend.
- Mudanças em Supabase exigem revisão de RLS, políticas e verificação pós-mudança.

## Verificação e Git

- Executar verificações de sintaxe, testes relevantes e revisão de diff antes de
  considerar uma alteração concluída.
- Usar mensagens Conventional Commits em inglês.
- Não fazer push para remoto sem solicitação explícita do usuário.
- Registrar limitações de testes, exportações ou ambientes não verificados.
