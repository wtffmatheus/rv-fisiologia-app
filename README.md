# RV Fisiologia App

Primeira base funcional com login, cadastro, aprovação manual e dois perfis.

## Passos
1. Instale Node.js 20.19+ ou 22.12+.
2. Abra a pasta no VS Code.
3. Rode `npm install`.
4. Crie um projeto no Supabase.
5. No SQL Editor do Supabase, rode `supabase/schema.sql`.
6. Copie `.env.example` para `.env.local` e preencha URL e Publishable Key do Supabase.
7. Coloque a logo oficial em `public/logo-rv.png`.
8. Opcional: coloque uma foto em `public/hero-gym.jpg`.
9. Rode `npm run dev`.
10. Crie sua conta pelo próprio site.
11. No Supabase > Authentication > Users, copie seu UUID.
12. No SQL Editor rode:
   `update public.profiles set role='admin', status='active' where id='SEU-UUID';`
13. Saia e entre novamente. Seu painel admin aparecerá.

Próxima etapa: criação de programas, Semana 1/Semana 2, 14 aulas, exercícios, vídeos e aviso por e-mail para novo cadastro.
