# Adega SaaS — Backend Multi-Tenant

Sistema de delivery para Adegas/Bombonieres com suporte a múltiplas empresas (SaaS).

---

## Estrutura do Projeto

```
adega-backend/
├── server.js              # Servidor Express + conexão MongoDB
├── models.js              # Schemas Mongoose (todos com empresaId)
├── empresas.config.js     # ⚙️ ARQUIVO DO CRIADOR — array de empresas autorizadas
├── middleware/
│   └── auth.js            # Autenticação por token + validação de empresa
├── routes/
│   └── index.js           # Todas as rotas da API (multi-tenant)
├── .env                   # Variáveis de ambiente (MONGODB_URI, PORT)
└── package.json
```

---

## O que foi alterado

| Arquivo | Alteração |
|---|---|
| `models.js` | Adicionado campo `empresaId` obrigatório em todos os schemas + índices compostos |
| `routes/index.js` | Todas as queries filtradas por `empresaId` — nenhuma consulta sem filtro |
| `middleware/auth.js` | **NOVO** — Autenticação por token, valida empresa, injeta `req.empresaId` |
| `empresas.config.js` | **NOVO** — Array interno de empresas (sem interface gráfica) |
| `server.js` | Adicionado `X-Empresa-Token` no CORS |

---

## Como configurar empresas

Edite o arquivo `empresas.config.js` e adicione uma entrada por empresa:

```js
{
  empresaId:  "adega-001",       // ID único interno
  nome:       "Adega do João",   // Nome exibido
  login:      "adega001",        // Login para o painel
  senha:      "adega001@2025",   // Senha do painel
  ativo:      true,              // false = bloqueia acesso
  vencimento: null,              // "2025-12-31" ou null = sem vencimento
  slug:       "adega-joao",      // URL da loja: /loja/adega-joao
}
```

**Para bloquear uma empresa:** `ativo: false`  
**Para definir vencimento:** `vencimento: "2025-12-31"`

---

## Passo a passo para subir o sistema

### 1. Copiar os arquivos

Substitua os arquivos da sua pasta `adega-backend` pelos arquivos deste zip:
- `server.js`
- `models.js`
- `routes/index.js`  ← pasta routes
- `middleware/auth.js`  ← pasta middleware (nova)
- `empresas.config.js`  ← raiz do projeto (novo)

> **Não altere o `.env`** — a conexão com o MongoDB continua a mesma.

### 2. Instalar dependências (se necessário)

```bash
cd adega-backend
npm install
```

### 3. Iniciar o servidor

```bash
npm start
# ou para desenvolvimento:
npm run dev
```

### 4. Verificar se está tudo OK (terminal)

```bash
# Verificar se o servidor sobe corretamente:
node server.js

# Deve aparecer:
# ✅ MongoDB conectado com sucesso!
# 🚀 Servidor rodando em http://localhost:3001
# 🏪 Multi-tenant ativo — isolamento por empresaId

# Testar a rota de status:
curl http://localhost:3001/

# Testar login de empresa:
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"login":"adega001","senha":"adega001@2025"}'

# Testar rota pública da loja:
curl http://localhost:3001/api/loja/adega-joao

# Testar rota protegida (use o token retornado no login):
TOKEN=$(node -e "console.log(Buffer.from('adega001:adega001@2025').toString('base64'))")
curl http://localhost:3001/api/produtos \
  -H "X-Empresa-Token: $TOKEN"
```

---

## Como o Frontend deve se conectar

### 1. Login

```js
const res = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'adega001', senha: 'adega001@2025' })
});
const { data } = await res.json();
// data.token   → guardar no localStorage
// data.slug    → rota da loja pública
```

### 2. Requisições autenticadas (painel admin)

```js
const token = localStorage.getItem('token');

const res = await fetch('/api/produtos', {
  headers: { 'X-Empresa-Token': token }
});
```

### 3. Loja pública (sem autenticação)

```js
// Carrega produtos/categorias/config de uma empresa pelo slug
const res = await fetch('/api/loja/adega-joao');
```

---

## Rotas disponíveis

### Pública (sem token)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/login` | Login da empresa, retorna token |
| GET | `/api/loja/:slug` | Dados públicos da loja (produtos, categorias, config) |

### Autenticadas (requer `X-Empresa-Token`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/produtos` | Listar produtos da empresa |
| POST | `/api/produtos` | Criar produto |
| PUT | `/api/produtos/:id` | Editar produto |
| DELETE | `/api/produtos/:id` | Excluir produto |
| PATCH | `/api/produtos/:id/pausar` | Pausar/ativar produto |
| GET | `/api/categorias` | Listar categorias |
| POST | `/api/categorias` | Criar categoria |
| PUT | `/api/categorias/:id` | Editar categoria |
| DELETE | `/api/categorias/:id` | Excluir categoria |
| PATCH | `/api/categorias/:id/pausar` | Pausar/ativar categoria |
| GET | `/api/complementos` | Listar complementos |
| POST | `/api/complementos` | Criar complemento |
| PUT | `/api/complementos/:id` | Editar complemento |
| DELETE | `/api/complementos/:id` | Excluir complemento |
| PATCH | `/api/complementos/:id/pausar` | Pausar/ativar complemento |
| GET | `/api/pedidos` | Listar pedidos |
| POST | `/api/pedidos` | Criar pedido (desconta estoque automaticamente) |
| PUT | `/api/pedidos/:id/status` | Atualizar status do pedido |
| DELETE | `/api/pedidos/:id` | Excluir pedido (repõe estoque) |
| GET | `/api/config` | Configurações da loja |
| POST | `/api/config` | Salvar configurações |
| GET | `/api/dashboard` | Dados do dashboard (faturamento, pedidos, estoque) |

---

## Garantias de segurança

- ✅ Nenhuma query executada sem `empresaId`
- ✅ Criação de registro sempre inclui `empresaId` da sessão
- ✅ Update/Delete sempre filtra por `empresaId` — empresa não afeta dados de outra
- ✅ Empresa bloqueada (`ativo: false`) não acessa painel nem API
- ✅ Empresa vencida não acessa painel nem API
- ✅ Senha não pode ser alterada pela rota `/api/config`
- ✅ Índices MongoDB compostos `{ empresaId, id }` para performance
