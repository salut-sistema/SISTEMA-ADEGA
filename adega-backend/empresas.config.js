// ============================================================
// empresas.config.js — ARQUIVO INTERNO DO CRIADOR DO SISTEMA
// Gerenciado apenas pelo desenvolvedor, sem interface gráfica.
// Adicione, remova ou bloqueie empresas aqui.
// ============================================================

const EMPRESAS = [

   {
    empresaId:  "kleber-001",
    nome:       "kleber ",
    login:      "kleber",
    senha:      "kleber",
    ativo:      true,                       // false = acesso bloqueado
    vencimento: null,                       // "2025-12-31" ou null = sem vencimento
    slug:       "kleber-adega",        // link exclusivo: /loja/bomboniere-maria
  },
  // ── EMPRESA 1 ─────────────────────────────────────────────
  {
    empresaId:  "adega-001",
    nome:       "Adega do João",
    login:      "adega001",
    senha:      "adega001@2025",
    ativo:      true,                       // false = acesso bloqueado
    vencimento: "2026-06-27",                       // "2025-12-31" ou null = sem vencimento
    slug:       "adega-joao",              // link exclusivo: /loja/adega-joao
  },

  // ── EMPRESA 2 ─────────────────────────────────────────────
  {
    empresaId:  "casadobroto-001",
    nome:       "casadobrotopizaria",
    login:      "broto",
    senha:      "broto1234",
    ativo:      true,
    vencimento: null,
    slug:       "pizzariacasadobroto",        // link exclusivo: /loja/bomboniere-maria
  },
    {
    empresaId:  "ma-1",
    nome:       "marcia",
    login:      "marcia",
    senha:      "marcia1234",
    ativo:      true,
    vencimento: null,
    slug:       "pointmorena",        // link exclusivo: /loja/bomboniere-maria
  },

  
  // ── TEMPLATE PARA NOVA EMPRESA (copie e preencha) ─────────
  // {
  //   empresaId:  "nova-001",
  //   nome:       "Nome da Loja",
  //   login:      "novaempresa",
  //   senha:      "senha@2025",
  //   ativo:      true,
  //   vencimento: null,
  //   slug:       "nome-da-loja",
  // },
];

module.exports = EMPRESAS;

/* 
Tenho tudo que preciso. Agora vou criar o api.js completamente refeito com multi-tenant, e adaptar o admin.html para ter login por empresa (login + senha), mantendo tudo que já funciona.Executou um comando, criou um arquivoExecutou um comando, criou um arquivoAgora o admin.html — só preciso alterar o formulário de login para ter campo de usuário além da senha:Executou um comando, editou um arquivoExecutou um comando, editou um arquivoAgora o index.html — preciso adaptar para carregar pelo slug da URL:Executou 4 comandos, editou um arquivo, leu um arquivoExecutou 4 comandos, editou um arquivo, leu um arquivoAgora veio tudo junto. Aqui está o resumo do que foi feito e o passo a passo:

O que foi alterado no frontend
api.js — completamente refeito para multi-tenant:

Criado o objeto AUTH que salva o token da empresa no sessionStorage
Todas as requisições autenticadas enviam o header X-Empresa-Token automaticamente
Novo API_AUTH.login(login, senha) que chama o backend e salva o token
fazerLogin() agora faz login pela API, não mais compara com senha local
fazerLogout() limpa o token da sessão
Loja pública carrega pelo slug da URL (/loja/adega-joao ou ?slug=adega-joao)

admin.html — adicionado campo de usuário no formulário de login (antes só tinha senha)
index.html — removido o link "Admin" da loja pública

Estrutura do zip
sistema-saas-completo/
├── adega-backend/       ← sobe no servidor (Railway/Render/VPS)
│   ├── server.js
│   ├── models.js
│   ├── empresas.config.js  ← aqui você adiciona empresas
│   ├── middleware/auth.js
│   ├── routes/index.js
│   └── .env
└── adega-frontend/      ← sobe no GitHub Pages ou Netlify
    ├── index.html
    ├── admin.html
    ├── api.js           ← alterado
    ├── app.js
    └── style.css

Passo a passo para testar localmente
1. Suba o backend: cd adega-backend && npm install && node server.js
2. Abra o admin.html no navegador — vai aparecer o formulário com Usuário e Senha
3. Use as credenciais da primeira empresa cadastrada no empresas.config.js:

Usuário: adega001
Senha: adega001@2025

4. Para acessar a loja pública de uma empresa: abra index.html?slug=adega-joao
5. Quando hospedar online, altere a linha no topo do api.js:
jsconst API_BASE = "https://SUA-URL-DO-BACKEND.com/api"; */