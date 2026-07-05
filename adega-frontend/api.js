// ============================================================
//  api.js — Cliente HTTP Multi-Tenant (SaaS)
//  Deve ser carregado ANTES do app.js nos dois HTMLs
// ============================================================

// ============================================================
// 🚀 PASSO 1 — DEPLOY: ALTERE A URL DO BACKEND AQUI
// ============================================================
// Em desenvolvimento (local): deixe como está, funciona automático.
// Em produção (Render): substitua "SEU-BACKEND" pela URL real do Render.
//
// Como obter a URL do Render:
//   1. Acesse https://render.com e faça login
//   2. Clique no seu serviço backend
//   3. Copie a URL que aparece no topo (ex: https://adega-api.onrender.com)
//   4. Cole aqui substituindo "SEU-BACKEND.onrender.com"
//
// Exemplo final:
//   : "https://adega-api.onrender.com/api";
// ============================================================
const API_BASE = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
  ? "http://127.0.0.1:3001/api"                    // ← desenvolvimento local (não altere)
  : "https://sistema-adega-onzv.onrender.com/api";         // ← ⚠️ ALTERE AQUI ao fazer deploy

// ── Gerenciamento de sessão da empresa ───────────────────────
const AUTH = {
  salvar(token, empresaId, nome, slug, vencimento) {
    sessionStorage.setItem("empresa_token", token);
    sessionStorage.setItem("empresa_id",    empresaId);
    sessionStorage.setItem("empresa_nome",  nome);
    sessionStorage.setItem("empresa_slug",  slug);
    // "vencimento" alimenta o card "Aviso de Assinatura" do menu lateral (ver assinatura.js)
    if (vencimento) sessionStorage.setItem("empresa_vencimento", vencimento);
    else sessionStorage.removeItem("empresa_vencimento");
  },
  token()      { return sessionStorage.getItem("empresa_token"); },
  empresaId()  { return sessionStorage.getItem("empresa_id"); },
  nome()       { return sessionStorage.getItem("empresa_nome"); },
  slug()       { return sessionStorage.getItem("empresa_slug"); },
  vencimento() { return sessionStorage.getItem("empresa_vencimento"); },
  logado()     { return !!this.token(); },
  limpar()     { ["empresa_token","empresa_id","empresa_nome","empresa_slug","empresa_vencimento"].forEach(k => sessionStorage.removeItem(k)); },
};

// ── Fetch genérico com tratamento de erro ────────────────────
async function apiFetch(method, endpoint, body = null, publico = false) {
  const headers = { "Content-Type": "application/json" };
  // Injeta token de autenticação nas rotas protegidas
  if (!publico && AUTH.logado()) headers["X-Empresa-Token"] = AUTH.token();
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${API_BASE}${endpoint}`, opts);
  const json = await res.json();
  if (!json.sucesso) throw new Error(json.erro || "Erro na API");
  return json.data;
}

// ── APIs disponíveis ─────────────────────────────────────────
const API_AUTH   = { async login(l,s) { return apiFetch("POST","/login",{login:l,senha:s},true); } };
const API_LOJA   = { async carregar(slug) { return apiFetch("GET",`/loja/${slug}`,null,true); } };

const API_PRODUTOS = {
  async listar()      { return apiFetch("GET",   "/produtos"); },
  async criar(d)      { return apiFetch("POST",  "/produtos", d); },
  async editar(id,d)  { return apiFetch("PUT",   `/produtos/${id}`, d); },
  async excluir(id)   { return apiFetch("DELETE",`/produtos/${id}`); },
  async pausar(id)    { return apiFetch("PATCH", `/produtos/${id}/pausar`); },
};

const API_CATEGORIAS = {
  async listar()      { return apiFetch("GET",   "/categorias"); },
  async criar(d)      { return apiFetch("POST",  "/categorias", d); },
  async editar(id,d)  { return apiFetch("PUT",   `/categorias/${id}`, d); },
  async excluir(id)   { return apiFetch("DELETE",`/categorias/${id}`); },
  async pausar(id)    { return apiFetch("PATCH", `/categorias/${id}/pausar`); },
};

const API_COMPLEMENTOS = {
  async listar()      { return apiFetch("GET",   "/complementos"); },
  async criar(d)      { return apiFetch("POST",  "/complementos", d); },
  async editar(id,d)  { return apiFetch("PUT",   `/complementos/${id}`, d); },
  async excluir(id)   { return apiFetch("DELETE",`/complementos/${id}`); },
  async pausar(id)    { return apiFetch("PATCH", `/complementos/${id}/pausar`); },
};

const API_PEDIDOS = {
  async listar()              { return apiFetch("GET",   "/pedidos"); },
  async criar(d)              { return apiFetch("POST",  "/pedidos", d); },
  // Pedido público: cliente envia sem precisar de token admin
  async criarPublico(slug,d)  { return apiFetch("POST",  `/pedidos/publico/${slug}`, d, true); },
  async atualizarStatus(id,s) { return apiFetch("PUT",   `/pedidos/${id}/status`,{status:s}); },
  async editar(id,d)          { return apiFetch("PUT",   `/pedidos/${id}`, d); },
  async excluir(id)           { return apiFetch("DELETE",`/pedidos/${id}`); },
};

const API_CONFIG    = {
  async carregar()  { return apiFetch("GET", "/config"); },
  async salvar(d)   { return apiFetch("POST","/config", d); },
};

const API_DASHBOARD = { async carregar() { return apiFetch("GET","/dashboard"); } };

// API Estoque-Base — controle de estoque por peso
const API_ESTOQUE_BASE = {
  async listar()                    { return apiFetch("GET",   "/estoque-base"); },
  async criar(d)                    { return apiFetch("POST",  "/estoque-base", d); },
  async editar(id,d)                { return apiFetch("PUT",   `/estoque-base/${id}`, d); },
  async excluir(id)                 { return apiFetch("DELETE",`/estoque-base/${id}`); },
  async movimentar(id, tipo, qtd, desc) {
    return apiFetch("PATCH", `/estoque-base/${id}/movimentar`, { tipo, quantidade: qtd, descricao: desc });
  },
};

// ============================================================
// SINCRONIZAÇÃO EM TEMPO REAL (Polling)
// ── O admin recebe novos pedidos automaticamente a cada 15s
// ── Sem necessidade de WebSocket, funciona em qualquer hospedagem
// ============================================================
let _pollingInterval = null;
let _ultimoPedidoData = null; // controla se há pedidos novos

function _iniciarPolling() {
  if (_pollingInterval) return;

  _pollingInterval = setInterval(async () => {
    try {
      const pedidos = await API_PEDIDOS.listar();
      const atual   = STATE.get("pedidos") || [];

      if (pedidos.length !== atual.length) {
        const novos = pedidos.length - atual.length;
        STATE.set("pedidos", pedidos);

        // Sincroniza também produtos (para atualizar estoque e vendas)
        const [produtos, estoquesBases] = await Promise.all([
          API_PRODUTOS.listar(),
          API_ESTOQUE_BASE.listar(),
        ]);
        STATE.set("produtos",      produtos      || []);
        STATE.set("estoquesBases", estoquesBases || []);

        // Notificação e atualização da interface
        if (novos > 0) MODAL.toast(`🔔 ${novos} novo(s) pedido(s) recebido(s)!`);

        if (typeof renderizarAdmin === "function") renderizarAdmin();
        if (typeof DASHBOARD !== "undefined")      DASHBOARD.atualizar();

        // Atualiza aba de pedidos se estiver visível
        const paneRecebidos = document.getElementById("tab-pedidos-recebidos");
        if (paneRecebidos?.classList.contains("ativo")) {
          if (typeof renderizarAdmPedidos === "function") renderizarAdmPedidos();
        }

        // Atualiza controle de estoque se estiver visível
        const paneEstoque = document.getElementById("tab-controle-estoque");
        if (paneEstoque?.classList.contains("ativo") && typeof renderizarControleEstoque === "function") {
          renderizarControleEstoque();
        }
      }
    } catch(e) {
      console.warn("[Polling] Erro:", e.message);
    }
  }, 12000); // verifica a cada 12 segundos
}

function _pararPolling() {
  if (_pollingInterval) { clearInterval(_pollingInterval); _pollingInterval = null; }
}

// ============================================================
// APPLY CONFIG — aplica configurações do banco no objeto CONFIG
// ============================================================
function _aplicarConfig(config) {
  if (!config || !Object.keys(config).length) return;
  if (config.loja)          CONFIG.loja          = { ...CONFIG.loja,          ...config.loja };
  if (config.contato)       CONFIG.contato       = { ...CONFIG.contato,       ...config.contato };
  if (config.funcionamento) CONFIG.funcionamento = { ...CONFIG.funcionamento, ...config.funcionamento };
  if (config.delivery)      CONFIG.delivery      = { ...CONFIG.delivery,      ...config.delivery };
  if (config.senha)         CONFIG.senha         = { ...CONFIG.senha,         ...config.senha };
  if (config.pagamento)     CONFIG.pagamento     = { ...CONFIG.pagamento,     ...config.pagamento };
}

// ============================================================
// LINK DA LOJA — exibe no topo do dashboard
// ============================================================
function _mostrarLinkLoja() {
  const slug = AUTH.slug();
  if (!slug) return;

  // Monta URL pública da loja baseada na URL atual
  const base     = window.location.origin + window.location.pathname.replace("admin.html","");
  const linkLoja = `${base}loja.html?slug=${slug}`;

  document.getElementById("link-loja-banner")?.remove();

  const banner = document.createElement("div");
  banner.id = "link-loja-banner";
  banner.style.cssText = `
    background:var(--surface,#1A1030);border:1px solid var(--primary,#5B2D8E);
    border-radius:12px;padding:14px 20px;margin-bottom:20px;
    display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;
  `;
  banner.innerHTML = `
    <div>
      <div style="font-size:13px;color:var(--text-muted,#aaa);margin-bottom:4px;">🔗 Link da sua loja — envie para seus clientes</div>
      <div style="font-size:14px;font-weight:600;word-break:break-all;">${linkLoja}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button onclick="navigator.clipboard.writeText('${linkLoja}').then(()=>MODAL.toast('Link copiado! 📋'))"
        style="background:var(--primary,#5B2D8E);color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;">
        📋 Copiar Link
      </button>
    </div>
  `;

  const dashboard = document.getElementById("sec-dashboard");
  if (dashboard) {
    const titulo = dashboard.querySelector("h2");
    if (titulo) titulo.after(banner);
    else dashboard.prepend(banner);
  }
}

// ============================================================
// PATCH NO STORAGE — intercepta para salvar no MongoDB
// ============================================================
function _patchStorage() {
  // Neutraliza saves locais — tudo vai para o MongoDB
  STORAGE.salvarProdutos     = async () => {};
  STORAGE.salvarCategorias   = async () => {};
  STORAGE.salvarComplementos = async () => {};
  STORAGE.salvarPedidos      = async () => {};

  // Config salva no banco ao chamar salvarConfig
  STORAGE.salvarConfig = async () => {
    try {
      await API_CONFIG.salvar({
        loja: CONFIG.loja, contato: CONFIG.contato,
        funcionamento: CONFIG.funcionamento, delivery: CONFIG.delivery,
        pagamento: CONFIG.pagamento,
      });
      // Aplica cores imediatamente após salvar
      if (typeof UTIL !== "undefined" && typeof UTIL.aplicarCores === "function") {
        UTIL.aplicarCores();
      }
      MODAL.toast("Configurações salvas! ✅");
    } catch(e) { console.error("Erro ao salvar config:", e.message); }
  };

  // ── Patch PRODUTOS ────────────────────────────────────────
  const _pc = PRODUTOS.criar.bind(PRODUTOS);
  const _pe = PRODUTOS.editar.bind(PRODUTOS);
  const _px = PRODUTOS.excluir.bind(PRODUTOS);
  const _pp = PRODUTOS.pausar.bind(PRODUTOS);
  PRODUTOS.criar   = async (d) => {
    const p = _pc(d);
    try {
      await API_PRODUTOS.criar({ ...p, ativo: true });
      const lista = await API_PRODUTOS.listar();
      if (lista) {
        STATE.set("produtos", lista);
        if (typeof renderizarAdmProdutos === "function") renderizarAdmProdutos();
      }
    } catch(e) {
      console.error("ERRO ao criar produto no backend:", e.message);
      MODAL.erro("Erro ao salvar produto: " + e.message);
    }
    return p;
  };
  PRODUTOS.editar  = async (id,d) => {
    _pe(id,d);
    try {
      await API_PRODUTOS.editar(id,d);
      const lista = await API_PRODUTOS.listar();
      if (lista) STATE.set("produtos", lista);
    } catch(e) {
      console.error("ERRO ao editar produto no backend:", e.message);
      MODAL.erro("Erro ao editar produto: " + e.message);
    }
  };
  PRODUTOS.excluir = async (id)   => { _px(id);            try { await API_PRODUTOS.excluir(id); }  catch(e){console.error(e.message);} };
  PRODUTOS.pausar  = async (id)   => { _pp(id);            try { await API_PRODUTOS.pausar(id); }   catch(e){console.error(e.message);} };

  // ── Patch CATEGORIAS ──────────────────────────────────────
  const _cc = CATEGORIAS.criar.bind(CATEGORIAS);
  const _ce = CATEGORIAS.editar.bind(CATEGORIAS);
  const _cx = CATEGORIAS.excluir.bind(CATEGORIAS);
  const _cp = CATEGORIAS.pausar.bind(CATEGORIAS);
  CATEGORIAS.criar   = async (d)    => { const c = _cc(d);  try { await API_CATEGORIAS.criar(c); }    catch(e){console.error(e.message);} return c; };
  CATEGORIAS.editar  = async (id,d) => { _ce(id,d);          try { await API_CATEGORIAS.editar(id,d); } catch(e){console.error(e.message);} };
  CATEGORIAS.excluir = async (id)   => { _cx(id);            try { await API_CATEGORIAS.excluir(id); }  catch(e){console.error(e.message);} };
  CATEGORIAS.pausar  = async (id)   => { _cp(id);            try { await API_CATEGORIAS.pausar(id); }   catch(e){console.error(e.message);} };

  // ── Patch COMPLEMENTOS ────────────────────────────────────
  const _oc = COMPLEMENTOS.criar.bind(COMPLEMENTOS);
  const _oe = COMPLEMENTOS.editar.bind(COMPLEMENTOS);
  const _ox = COMPLEMENTOS.excluir.bind(COMPLEMENTOS);
  const _op = COMPLEMENTOS.pausar.bind(COMPLEMENTOS);
  COMPLEMENTOS.criar   = async (d)    => { const c = _oc(d);  try { await API_COMPLEMENTOS.criar(c); }    catch(e){console.error(e.message);} return c; };
  COMPLEMENTOS.editar  = async (id,d) => { _oe(id,d);          try { await API_COMPLEMENTOS.editar(id,d); } catch(e){console.error(e.message);} };
  COMPLEMENTOS.excluir = async (id)   => { _ox(id);            try { await API_COMPLEMENTOS.excluir(id); }  catch(e){console.error(e.message);} };
  COMPLEMENTOS.pausar  = async (id)   => { _op(id);            try { await API_COMPLEMENTOS.pausar(id); }   catch(e){console.error(e.message);} };
}

// ============================================================
// CARREGA DADOS DO PAINEL (após login)
// ============================================================
async function _carregarDadosAdmin() {
  try {
    const [produtos, categorias, complementos, pedidos, config, estoquesBases] = await Promise.all([
      API_PRODUTOS.listar(),
      API_CATEGORIAS.listar(),
      API_COMPLEMENTOS.listar(),
      API_PEDIDOS.listar(),
      API_CONFIG.carregar(),
      API_ESTOQUE_BASE.listar(),
    ]);

    // Popula o estado global com dados do MongoDB
    STATE.set("produtos",      produtos      || []);
    STATE.set("categorias",    categorias    || []);
    STATE.set("complementos",  complementos  || []);
    STATE.set("pedidos",       pedidos       || []);
    STATE.set("estoquesBases", estoquesBases || []);

    _aplicarConfig(config);
    UTIL.aplicarCores();
    renderizarAdmin();
    mostrarSecao("sec-pedidos");
    if (typeof TABS !== "undefined") TABS.initAll();
    _mostrarLinkLoja();

    // Inicia polling para receber pedidos em tempo real
    _iniciarPolling();

    MODAL.toast("Bem-vindo ao painel! 👋");
    console.log("✅ Dados carregados do MongoDB!");
  } catch(e) {
    console.error("❌ Erro ao carregar dados:", e.message);
    MODAL.erro("Erro ao conectar com o servidor. Verifique se o backend está rodando.");
  }
}

// ============================================================
// LOGIN MULTI-TENANT
// ============================================================
async function fazerLogin() {
  const loginInput = document.getElementById("login-usuario");
  const senhaInput = document.getElementById("login-senha");
  const erroEl     = document.getElementById("login-erro");
  const box        = document.querySelector(".login-box");

  const loginVal = loginInput?.value?.trim();
  const senhaVal = senhaInput?.value;

  if (!loginVal || !senhaVal) {
    if (erroEl) { erroEl.textContent = "❌ Preencha o usuário e a senha."; erroEl.style.display = "block"; }
    return;
  }

  try {
    const dados = await API_AUTH.login(loginVal, senhaVal);
    AUTH.salvar(dados.token, dados.empresaId, dados.nome, dados.slug, dados.vencimento);
    STATE.set("adminLogado", true);
    document.getElementById("login-overlay")?.classList.remove("active");
    if (erroEl) erroEl.style.display = "none";
    const nomeEl = document.getElementById("adm-loja-nome");
    if (nomeEl) nomeEl.textContent = dados.nome;
    // Atualiza o card "Aviso de Assinatura" do menu lateral (ver assinatura.js)
    window.AVISO_ASSINATURA?.atualizar();
    await _carregarDadosAdmin();
  } catch(e) {
    if (erroEl) {
      erroEl.textContent = e.message.includes("bloqueada") || e.message.includes("expirado")
        ? "❌ Empresa bloqueada ou acesso expirado."
        : "❌ Login ou senha incorretos.";
      erroEl.style.display = "block";
    }
    senhaInput?.classList.add("input-erro");
    box?.classList.add("shake");
    setTimeout(() => box?.classList.remove("shake"), 400);
  }
}
window.fazerLogin = fazerLogin;

// ============================================================
// LOGOUT
// ============================================================
function fazerLogout() {
  _pararPolling(); // para o polling ao sair
  AUTH.limpar();
  STATE.set("adminLogado", false);
  document.getElementById("login-overlay")?.classList.add("active");
  ["login-senha","login-usuario"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const erroEl = document.getElementById("login-erro");
  if (erroEl) erroEl.style.display = "none";
  document.getElementById("link-loja-banner")?.remove();
  // Esconde o card "Aviso de Assinatura" ao sair (ver assinatura.js)
  const avisoEl = document.getElementById("aviso-assinatura");
  if (avisoEl) avisoEl.style.display = "none";
}
window.fazerLogout = fazerLogout;

// ============================================================
// INICIALIZAÇÃO — detecta se é painel admin ou loja pública
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
  const isAdmin = document.body.classList.contains("pagina-admin");

  // ── PAINEL ADMIN ──────────────────────────────────────────
  if (isAdmin) {
    _patchStorage(); // intercepta salvamentos para o MongoDB

    // Se já possui sessão ativa, carrega o painel direto
    if (AUTH.logado()) {
      STATE.set("adminLogado", true);
      document.getElementById("login-overlay")?.classList.remove("active");
      const nomeEl = document.getElementById("adm-loja-nome");
      if (nomeEl) nomeEl.textContent = AUTH.nome() || "Painel Admin";
      // Atualiza o card "Aviso de Assinatura" do menu lateral (ver assinatura.js)
      window.AVISO_ASSINATURA?.atualizar();
      await _carregarDadosAdmin();
    }
    return;
  }

  // ── LOJA PÚBLICA ──────────────────────────────────────────
  // Detecta o slug pela URL: /loja/SLUG ou ?slug=SLUG
  const match  = window.location.pathname.match(/\/loja\/([^/?#]+)/);
  const params = new URLSearchParams(window.location.search);
  const slug   = match?.[1] || params.get("slug") || AUTH.slug();
  window.LOJA_SLUG = slug; // usado por WPP.enviar (app.js) para identificar a empresa do pedido

  // Mostra botão "Voltar ao Admin" se o admin estiver logado
  if (AUTH.logado()) {
    const btnAdmin = document.getElementById("btn-voltar-admin");
    if (btnAdmin) btnAdmin.style.display = "inline-flex";
  }

  if (slug) {
    try {
      // Carrega dados públicos da loja pelo slug
      const loja = await API_LOJA.carregar(slug);
      STATE.set("produtos",     loja.produtos     || []);
      STATE.set("categorias",   loja.categorias   || []);
      STATE.set("complementos", loja.complementos || []);
      STATE.set("pedidos",      []);
      _aplicarConfig(loja.config);
      if (typeof UTIL !== "undefined") UTIL.aplicarCores();
      if (typeof renderizarCatalogo === "function") renderizarCatalogo();
      // Reaplicar cores após renderizar (garante que elementos dinâmicos recebam)
      setTimeout(() => { if (typeof UTIL !== "undefined") UTIL.aplicarCores(); }, 100);

      // Aplica configurações de entrega/retirada
      const opcEntrega  = document.getElementById("opc-entrega");
      const opcRetirada = document.getElementById("opc-retirada");
      if (!CONFIG.delivery.entregaAtiva  && opcEntrega)  opcEntrega.style.display  = "none";
      if (!CONFIG.delivery.retiradaAtiva && opcRetirada) opcRetirada.style.display = "none";
    } catch(e) {
      console.error("Erro ao carregar loja:", e.message);
    }
  }
});
