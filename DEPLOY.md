# 🚀 Guia Completo de Deploy — Adega SaaS

Siga este guia na ordem para publicar o sistema na internet.
Plataformas utilizadas: **Render** (backend) + **Vercel** (frontend) + **MongoDB Atlas** (banco de dados).

---

## Antes de começar

Você vai precisar criar contas gratuitas em:
- https://github.com — para hospedar o código
- https://render.com — para hospedar o backend
- https://vercel.com — para hospedar o frontend
- O MongoDB Atlas já está configurado e funcionando ✅

---

## PASSO 1 — Preparar o repositório no GitHub

1. Acesse https://github.com e faça login
2. Clique em **"New repository"**
3. Dê um nome (ex: `adega-saas`)
4. Marque como **Private** (para não expor suas credenciais)
5. Clique em **"Create repository"**

Agora abra o terminal na pasta do projeto e rode:

```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/adega-saas.git
git push -u origin main
```

> ⚠️ Substitua `SEU-USUARIO` pelo seu usuário do GitHub

---

## PASSO 2 — Criar o arquivo .gitignore

Antes de subir o código, crie um arquivo `.gitignore` na raiz do projeto para não expor senhas:

```
# Arquivo .gitignore — impede envio de arquivos sensíveis
adega-backend/.env
adega-backend/node_modules/
node_modules/
```

---

## PASSO 3 — Deploy do Backend no Render

1. Acesse https://render.com e faça login com GitHub
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu repositório GitHub (`adega-saas`)
4. Configure assim:
   - **Name:** `adega-backend` (ou o nome que preferir)
   - **Root Directory:** `adega-backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Role até **"Environment Variables"** e adicione:

   | Chave | Valor |
   |---|---|
   | `MONGODB_URI` | Cole a string do seu MongoDB Atlas |
   | `FRONTEND_URL` | Deixe `*` por enquanto (atualize depois) |

   > A string do MongoDB está no arquivo `.env` local

6. Clique em **"Create Web Service"**
7. Aguarde o deploy (2-5 minutos)
8. **Copie a URL gerada** — será algo como: `https://adega-backend.onrender.com`

---

## PASSO 4 — Atualizar a URL do backend no Frontend

Agora que você tem a URL do Render, abra o arquivo:

```
adega-frontend/api.js
```

Localize estas linhas (no início do arquivo):

```javascript
// ⚠️ ALTERE AQUI ao fazer deploy
const API_BASE = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
  ? "http://127.0.0.1:3001/api"                    // ← desenvolvimento local (não altere)
  : "https://SEU-BACKEND.onrender.com/api";         // ← ⚠️ ALTERE AQUI ao fazer deploy
```

Substitua `SEU-BACKEND.onrender.com` pela URL real do Render:

```javascript
  : "https://adega-backend.onrender.com/api";  // ← URL real do Render
```

Salve o arquivo e faça um novo commit:

```bash
git add adega-frontend/api.js
git commit -m "atualiza URL do backend para producao"
git push
```

---

## PASSO 5 — Deploy do Frontend na Vercel

1. Acesse https://vercel.com e faça login com GitHub
2. Clique em **"New Project"**
3. Importe o repositório `adega-saas`
4. Configure assim:
   - **Root Directory:** `adega-frontend`
   - **Framework Preset:** `Other`
   - Deixe Build Command e Output Directory em branco
5. Clique em **"Deploy"**
6. Aguarde o deploy (1-2 minutos)
7. **Copie a URL gerada** — será algo como: `https://minha-adega.vercel.app`

---

## PASSO 6 — Atualizar o CORS no Backend

Agora que o frontend está no ar, volte ao Render e atualize a variável de ambiente:

1. Acesse o painel do Render → seu serviço backend
2. Clique em **"Environment"**
3. Edite a variável `FRONTEND_URL`:

   ```
   FRONTEND_URL=https://minha-adega.vercel.app
   ```

   > Substitua pela URL real da sua Vercel

4. Clique em **"Save Changes"** — o Render reinicia automaticamente

---

## PASSO 7 — Verificar se está tudo funcionando

Abra no navegador:

```
https://SEU-BACKEND.onrender.com/
```

Deve aparecer:
```json
{
  "status": "online",
  "mongodb": "conectado"
}
```

Depois acesse o painel admin:
```
https://minha-adega.vercel.app/admin.html
```

Faça login com as credenciais do `empresas.config.js` e verifique se os dados carregam.

---

## PASSO 8 — Link da loja para os clientes

Após o deploy, o link de cada loja será:

```
https://minha-adega.vercel.app/index.html?slug=SLUG-DA-EMPRESA
```

Exemplo:
```
https://minha-adega.vercel.app/index.html?slug=kleber-adega
```

Esse link também aparece automaticamente no topo do dashboard de cada empresa ao fazer login.

---

## Adicionando nova empresa após o deploy

1. Abra o arquivo `adega-backend/empresas.config.js`
2. Adicione a nova empresa seguindo o padrão existente
3. Faça commit e push:
   ```bash
   git add adega-backend/empresas.config.js
   git commit -m "adiciona empresa: Nome da Empresa"
   git push
   ```
4. O Render detecta o push e reinicia automaticamente em ~1 minuto
5. A nova empresa já consegue fazer login

---

## Bloqueando ou removendo uma empresa

Abra `adega-backend/empresas.config.js` e:

- Para **bloquear temporariamente:** `ativo: false`
- Para **definir vencimento:** `vencimento: "2025-12-31"`
- Para **remover:** delete o bloco da empresa

Depois faça commit e push normalmente.

---

## Resumo dos arquivos que precisam ser alterados para o deploy

| Arquivo | O que alterar | Quando |
|---|---|---|
| `adega-frontend/api.js` | URL do backend (linha 12) | Após criar o serviço no Render |
| `adega-backend/.env` | `FRONTEND_URL` | Após publicar na Vercel |
| `adega-backend/empresas.config.js` | Adicionar/remover empresas | Sempre que necessário |

---

## Problemas comuns

**Backend não conecta no MongoDB:**
- Verifique se o IP `0.0.0.0/0` está liberado no MongoDB Atlas (Network Access)

**Frontend não consegue chamar a API (erro de CORS):**
- Verifique se `FRONTEND_URL` no Render está com a URL exata da Vercel
- Certifique-se que não tem barra `/` no final da URL

**Render "dorme" após inatividade (plano gratuito):**
- No plano gratuito o Render desliga o serviço após 15 minutos sem uso
- A primeira requisição pode demorar 30-60 segundos para "acordar"
- Para evitar isso, contrate o plano pago ou use um serviço de ping (ex: UptimeRobot)
