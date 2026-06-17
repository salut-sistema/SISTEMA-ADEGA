// ============================================================
//  api.js — Cliente HTTP Multi-Tenant (SaaS)
//  Carregado ANTES do app.js
// ============================================================

const API_BASE = "http://127.0.0.1:3001/api";

// ── Token da Empresa ─────────────────────────────────────────
const AUTH = {
  salvar(token, empresaId, nome, slug) {
    sessionStorage.setItem("empresa_token", token);
    sessionStorage.setItem("empresa_id",    empresaId);
    sessionStorage.setItem("empresa_nome",  nome);
    sessionStorage.setItem("empresa_slug",  slug);
  },
  token()     { return sessionStorage.getItem("empresa_token"); },
  empresaId() { return sessionStorage.getItem("empresa_id"); },
  nome()      { return sessionStorage.getItem("empresa_nome"); },
  slug()      { return sessionStorage.getItem("empresa_slug"); },
  logado()    { return !!this.token(); },
  limpar() {
    ["empresa_token","empresa_id","empresa_nome","empresa_slug"]
      .forEach(k => sessionStorage.removeItem(k));
  },
};

// ── Fetch genérico ───────────────────────────────────────────
async function apiFetch(method, endpoint, body = null, publico = false) {
  const headers = { "Content-Type": "application/json" };
  if (!publico && AUTH.logado()) headers["X-Empresa-Token"] = AUTH.token();
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${API_BASE}${endpoint}`, opts);
  const json = await res.json();
  if (!json.sucesso) throw new Error(json.erro || "Erro na API");
  return json.data;
}

// ── APIs ─────────────────────────────────────────────────────
const API_AUTH       = { async login(l,s)    { return apiFetch("POST","/login",{login:l,senha:s},true); } };
const API_LOJA       = { async carregar(slug) { return apiFetch("GET",`/loja/${slug}`,null,true); } };
const API_PRODUTOS   = {
  async listar()       { return apiFetch("GET",   "/produtos"); },
  async criar(d)       { return apiFetch("POST",  "/produtos", d); },
  async editar(id,d)   { return apiFetch("PUT",   `/produtos/${id}`, d); },
  async excluir(id)    { return apiFetch("DELETE",`/produtos/${id}`); },
  async pausar(id)     { return apiFetch("PATCH", `/produtos/${id}/pausar`); },
};
const API_CATEGORIAS = {
  async listar()       { return apiFetch("GET",   "/categorias"); },
  async criar(d)       { return apiFetch("POST",  "/categorias", d); },
  async editar(id,d)   { return apiFetch("PUT",   `/categorias/${id}`, d); },
  async excluir(id)    { return apiFetch("DELETE",`/categorias/${id}`); },
  async pausar(id)     { return apiFetch("PATCH", `/categorias/${id}/pausar`); },
};
const API_COMPLEMENTOS = {
  async listar()       { return apiFetch("GET",   "/complementos"); },
  async criar(d)       { return apiFetch("POST",  "/complementos", d); },
  async editar(id,d)   { return apiFetch("PUT",   `/complementos/${id}`, d); },
  async excluir(id)    { return apiFetch("DELETE",`/complementos/${id}`); },
  async pausar(id)     { return apiFetch("PATCH", `/complementos/${id}/pausar`); },
};
const API_PEDIDOS = {
  async listar()              { return apiFetch("GET",   "/pedidos"); },
  async criar(d)              { return apiFetch("POST",  "/pedidos", d); },
  async atualizarStatus(id,s) { return apiFetch("PUT",   `/pedidos/${id}/status`,{status:s}); },
  async excluir(id)           { return apiFetch("DELETE",`/pedidos/${id}`); },
};
const API_CONFIG    = {
  async carregar()  { return apiFetch("GET", "/config"); },
  async salvar(d)   { return apiFetch("POST","/config", d); },
};
const API_DASHBOARD = { async carregar() { return apiFetch("GET","/dashboard"); } };

// ── Aplica config do banco no CONFIG do app ──────────────────
function _aplicarConfig(config) {
  if (!config || !Object.keys(config).length) return;
  if (config.loja)          CONFIG.loja          = { ...CONFIG.loja,          ...config.loja };
  if (config.contato)       CONFIG.contato       = { ...CONFIG.contato,       ...config.contato };
  if (config.funcionamento) CONFIG.funcionamento = { ...CONFIG.funcionamento, ...config.funcionamento };
  if (config.delivery)      CONFIG.delivery      = { ...CONFIG.delivery,      ...config.delivery };
  if (config.senha)         CONFIG.senha         = { ...CONFIG.senha,         ...config.senha };
  if (config.pagamento)     CONFIG.pagamento     = { ...CONFIG.pagamento,     ...config.pagamento };
}

// ── Mostra link da loja no topo do dashboard ─────────────────
function _mostrarLinkLoja() {
  const slug = AUTH.slug();
  if (!slug) return;

  // Monta URL da loja com base na URL atual
  const base = window.location.origin + window.location.pathname.replace("admin.html","");
  const linkLoja = `${base}index.html?slug=${slug}`;

  // Remove se já existir
  document.getElementById("link-loja-banner")?.remove();

  const banner = document.createElement("div");
  banner.id = "link-loja-banner";
  banner.style.cssText = `
    background: var(--surface, #1A1030);
    border: 1px solid var(--primary, #5B2D8E);
    border-radius: 12px;
    padding: 14px 20px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  `;
  banner.innerHTML = `
    <div>
      <div style="font-size:13px;color:var(--text-muted,#aaa);margin-bottom:4px;">🔗 Link da sua loja (envie para seus clientes)</div>
      <div style="font-size:14px;font-weight:600;word-break:break-all;" id="link-loja-texto">${linkLoja}</div>
    </div>
    <button onclick="navigator.clipboard.writeText('${linkLoja}').then(()=>MODAL.toast('Link copiado! 📋'))"
      style="background:var(--primary,#5B2D8E);color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;white-space:nowrap;">
      📋 Copiar Link
    </button>
  `;

  // Insere no topo do dashboard
  const dashboard = document.getElementById("sec-dashboard");
  if (dashboard) {
    const titulo = dashboard.querySelector("h2");
    if (titulo) titulo.after(banner);
    else dashboard.prepend(banner);
  }
}

// ── Intercepta STORAGE para salvar no MongoDB ────────────────
function _patchStorage() {
  // Salvar no MongoDB em vez do localStorage
  STORAGE.salvarProdutos     = async () => {};
  STORAGE.salvarCategorias   = async () => {};
  STORAGE.salvarComplementos = async () => {};
  STORAGE.salvarPedidos      = async () => {};
  STORAGE.salvarConfig = async () => {
    try {
      await API_CONFIG.salvar({
        loja: CONFIG.loja, contato: CONFIG.contato,
        funcionamento: CONFIG.funcionamento, delivery: CONFIG.delivery,
        pagamento: CONFIG.pagamento,
      });
      MODAL.toast("Configurações salvas! ✅");
    } catch(e) { console.error("Erro ao salvar config:", e.message); }
  };

  // Patch PRODUTOS
  const _pc = PRODUTOS.criar.bind(PRODUTOS);
  const _pe = PRODUTOS.editar.bind(PRODUTOS);
  const _px = PRODUTOS.excluir.bind(PRODUTOS);
  const _pp = PRODUTOS.pausar.bind(PRODUTOS);
  PRODUTOS.criar   = async (d)    => { const p = _pc(d);  try { await API_PRODUTOS.criar(p); }    catch(e){console.error(e.message);} return p; };
  PRODUTOS.editar  = async (id,d) => { _pe(id,d);          try { await API_PRODUTOS.editar(id,d); } catch(e){console.error(e.message);} };
  PRODUTOS.excluir = async (id)   => { _px(id);            try { await API_PRODUTOS.excluir(id); }  catch(e){console.error(e.message);} };
  PRODUTOS.pausar  = async (id)   => { _pp(id);            try { await API_PRODUTOS.pausar(id); }   catch(e){console.error(e.message);} };

  // Patch CATEGORIAS
  const _cc = CATEGORIAS.criar.bind(CATEGORIAS);
  const _ce = CATEGORIAS.editar.bind(CATEGORIAS);
  const _cx = CATEGORIAS.excluir.bind(CATEGORIAS);
  const _cp = CATEGORIAS.pausar.bind(CATEGORIAS);
  CATEGORIAS.criar   = async (d)    => { const c = _cc(d);  try { await API_CATEGORIAS.criar(c); }    catch(e){console.error(e.message);} return c; };
  CATEGORIAS.editar  = async (id,d) => { _ce(id,d);          try { await API_CATEGORIAS.editar(id,d); } catch(e){console.error(e.message);} };
  CATEGORIAS.excluir = async (id)   => { _cx(id);            try { await API_CATEGORIAS.excluir(id); }  catch(e){console.error(e.message);} };
  CATEGORIAS.pausar  = async (id)   => { _cp(id);            try { await API_CATEGORIAS.pausar(id); }   catch(e){console.error(e.message);} };

  // Patch COMPLEMENTOS
  const _oc = COMPLEMENTOS.criar.bind(COMPLEMENTOS);
  const _oe = COMPLEMENTOS.editar.bind(COMPLEMENTOS);
  const _ox = COMPLEMENTOS.excluir.bind(COMPLEMENTOS);
  const _op = COMPLEMENTOS.pausar.bind(COMPLEMENTOS);
  COMPLEMENTOS.criar   = async (d)    => { const c = _oc(d);  try { await API_COMPLEMENTOS.criar(c); }    catch(e){console.error(e.message);} return c; };
  COMPLEMENTOS.editar  = async (id,d) => { _oe(id,d);          try { await API_COMPLEMENTOS.editar(id,d); } catch(e){console.error(e.message);} };
  COMPLEMENTOS.excluir = async (id)   => { _ox(id);            try { await API_COMPLEMENTOS.excluir(id); }  catch(e){console.error(e.message);} };
  COMPLEMENTOS.pausar  = async (id)   => { _op(id);            try { await API_COMPLEMENTOS.pausar(id); }   catch(e){console.error(e.message);} };

  // Patch WPP.enviar — salva pedido no MongoDB
  const _wpp = WPP.enviar.bind(WPP);
  WPP.enviar = async (cliente, tipoEntrega, formaPagamento, endereco) => {
    _wpp(cliente, tipoEntrega, formaPagamento, endereco);
    const taxa  = tipoEntrega === "entrega" ? (CONFIG.delivery.taxaEntrega || 0) : 0;
    const pedido = {
      id: UTIL.id(),
      status: "pendente",
      tipoEntrega, formaPagamento,
      endereco: endereco || "",
      total: CARRINHO.total() + taxa,
      subtotal: CARRINHO.total(),
      taxaEntrega: taxa,
      data: new Date().toISOString(),
      cliente,
      itens: STATE.get("carrinho"),
    };
    try { await API_PEDIDOS.criar(pedido); } catch(e) { console.error(e.message); }
  };
}

// ── Carrega dados do painel após login ───────────────────────
async function _carregarDadosAdmin() {
  try {
    const [produtos, categorias, complementos, pedidos, config] = await Promise.all([
      API_PRODUTOS.listar(),
      API_CATEGORIAS.listar(),
      API_COMPLEMENTOS.listar(),
      API_PEDIDOS.listar(),
      API_CONFIG.carregar(),
    ]);
    STATE.set("produtos",     produtos     || []);
    STATE.set("categorias",   categorias   || []);
    STATE.set("complementos", complementos || []);
    STATE.set("pedidos",      pedidos      || []);
    _aplicarConfig(config);
    UTIL.aplicarCores();
    renderizarAdmin();
    mostrarSecao("sec-dashboard");
    if (typeof TABS !== "undefined") TABS.initAll();
    _mostrarLinkLoja();
    MODAL.toast("Bem-vindo ao painel! 👋");
    console.log("✅ Dados carregados do MongoDB!");
  } catch(e) {
    console.error("❌ Erro ao carregar dados:", e.message);
    MODAL.erro("Erro ao conectar com o servidor. Verifique se o backend está rodando.");
  }
}

// ── LOGIN MULTI-TENANT ───────────────────────────────────────
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
    AUTH.salvar(dados.token, dados.empresaId, dados.nome, dados.slug);
    STATE.set("adminLogado", true);
    document.getElementById("login-overlay")?.classList.remove("active");
    if (erroEl) erroEl.style.display = "none";
    const nomeEl = document.getElementById("adm-loja-nome");
    if (nomeEl) nomeEl.textContent = dados.nome;
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

// ── LOGOUT ───────────────────────────────────────────────────
function fazerLogout() {
  AUTH.limpar();
  STATE.set("adminLogado", false);
  document.getElementById("login-overlay")?.classList.add("active");
  const s = document.getElementById("login-senha");
  const u = document.getElementById("login-usuario");
  if (s) s.value = "";
  if (u) u.value = "";
  const erroEl = document.getElementById("login-erro");
  if (erroEl) erroEl.style.display = "none";
  document.getElementById("link-loja-banner")?.remove();
}
window.fazerLogout = fazerLogout;

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const isAdmin = document.body.classList.contains("pagina-admin");

  if (isAdmin) {
    _patchStorage();

    // Sessão ativa — entra direto sem pedir login
    if (AUTH.logado()) {
      STATE.set("adminLogado", true);
      document.getElementById("login-overlay")?.classList.remove("active");
      const nomeEl = document.getElementById("adm-loja-nome");
      if (nomeEl) nomeEl.textContent = AUTH.nome() || "Painel Admin";
      await _carregarDadosAdmin();
    }
    return;
  }

  // ── LOJA PÚBLICA ────────────────────────────────────────────
  const match  = window.location.pathname.match(/\/loja\/([^/?#]+)/);
  const params = new URLSearchParams(window.location.search);
  const slug   = match?.[1] || params.get("slug") || AUTH.slug();

  // Mostra botão "⚙️ Admin" se o admin estiver logado na sessão
  if (AUTH.logado()) {
    const btnAdmin = document.getElementById("btn-voltar-admin");
    if (btnAdmin) btnAdmin.style.display = "inline-flex";
  }

  if (slug) {
    try {
      const loja = await API_LOJA.carregar(slug);
      STATE.set("produtos",     loja.produtos   || []);
      STATE.set("categorias",   loja.categorias || []);
      STATE.set("complementos", []);
      STATE.set("pedidos",      []);
      _aplicarConfig(loja.config);
      UTIL.aplicarCores();
      if (typeof renderizarCatalogo === "function") renderizarCatalogo();
      const opcEntrega  = document.getElementById("opc-entrega");
      const opcRetirada = document.getElementById("opc-retirada");
      if (!CONFIG.delivery.entregaAtiva  && opcEntrega)  opcEntrega.style.display  = "none";
      if (!CONFIG.delivery.retiradaAtiva && opcRetirada) opcRetirada.style.display = "none";
    } catch(e) {
      console.error("Erro ao carregar loja:", e.message);
    }
  }
});
