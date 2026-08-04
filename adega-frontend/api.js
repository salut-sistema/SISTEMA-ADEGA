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
const API_SISTEMA = { async somConfig() { return apiFetch("GET","/som-config",null,true); } };

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

// API Senha Master — valida a senha master centralizada no backend (empresaConfig.js)
// Nunca compara a senha localmente: o valor real nunca fica exposto no frontend.
const API_SENHA_MASTER = {
  async validar(senha) { return apiFetch("POST", "/senha-master/validar", { senha }); },
};

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

// ── Sino + som de notificação de pedido novo ──────────────────
// Enquanto existir pelo menos 1 pedido "não visto" pelo admin, o sino 🔔
// pisca no card do pedido (Pedidos Recebidos) E o som repete em loop.
// Assim que o admin clica no sino ou em qualquer parte do card daquele
// pedido, ele é marcado como "visto": o sino some e, se não sobrar
// nenhum outro pedido pendente, o som para.
window.PEDIDOS_NAO_VISTOS = new Set();
let _somLoopInterval = null;

let _audioCtx = null;

// Os navegadores bloqueiam áudio automático até o usuário interagir com a
// página (clicar, tocar na tela, etc). Como o som de notificação toca
// sozinho quando chega um pedido novo (sem nenhum clique do admin), ele
// pode ficar mudo. Para evitar isso, "destravamos" o áudio assim que o
// admin clicar em qualquer lugar da página pela primeira vez — depois
// disso o som toca normalmente, mesmo sem novo clique.
function _destravarAudioNotificacao() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
  } catch (e) { /* navegador sem suporte a Web Audio — ignora */ }
  document.removeEventListener("click", _destravarAudioNotificacao);
  document.removeEventListener("touchstart", _destravarAudioNotificacao);
}
document.addEventListener("click", _destravarAudioNotificacao);
document.addEventListener("touchstart", _destravarAudioNotificacao);

// Toca uma nota simples (usada pelos presets "classico" e "alerta")
function _tocarNotaSimples(tipoOnda, freq, inicio, duracao, volumePico) {
  const osc  = _audioCtx.createOscillator();
  const gain = _audioCtx.createGain();
  osc.type = tipoOnda;
  osc.frequency.value = freq;
  const fim = inicio + duracao;
  gain.gain.setValueAtTime(0.0001, inicio);
  gain.gain.exponentialRampToValueAtTime(volumePico, inicio + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, fim);
  osc.connect(gain).connect(_audioCtx.destination);
  osc.start(inicio);
  osc.stop(fim);
}

// ── PRESETS DE SOM ──────────────────────────────────────────
// Cada preset é uma função que agenda as notas a partir de "now".
// A opção ativa é escolhida pelo backend, em empresasConfig.js
// (SOM_NOTIFICACAO_PEDIDO) — não precisa mexer em nada aqui.
const _SONS_NOTIFICACAO = {
  // "classico" — som original do sistema: duas notas curtas em onda
  // senoidal (mais suave/discreto), estilo "dim-dom".
  classico(now) {
    [880, 660].forEach((freq, i) => {
      const inicio = now + i * 0.18;
      _tocarNotaSimples("sine", freq, inicio, 0.16, 0.35);
    });
  },

  // "campainha" — campainha mais brilhante/alta, com harmônico extra
  // (onda triangular), estilo "tin-don".
  campainha(now) {
    const notas = [{ freq: 1046, inicio: 0.00 }, { freq: 784, inicio: 0.16 }];
    notas.forEach(nota => {
      const inicio = now + nota.inicio;
      _tocarNotaSimples("triangle", nota.freq,     inicio, 0.32, 0.7);
      _tocarNotaSimples("triangle", nota.freq * 2, inicio, 0.32, 0.22); // harmônico
    });
  },

  // "alerta" — três bipes curtos e retos (onda quadrada), mais chamativo.
  alerta(now) {
    [0, 0.14, 0.28].forEach(t => {
      _tocarNotaSimples("square", 740, now + t, 0.09, 0.25);
    });
  },
};

// Nome do preset ativo — vem do backend (empresasConfig.js). "classico"
// é o padrão até a configuração real chegar do servidor.
let _somAtivoPreset = "classico";

async function _tocarSomNotificacaoPedido() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") await _audioCtx.resume();

    const tocar = _SONS_NOTIFICACAO[_somAtivoPreset] || _SONS_NOTIFICACAO.classico;
    tocar(_audioCtx.currentTime);
  } catch (e) {
    console.warn("Não foi possível tocar o som de notificação:", e);
  }
}

// Liga o loop do som (se ainda não estiver ligado) — repete a cada 3s
// enquanto houver pedido(s) não visto(s), de forma contínua e no mesmo volume.
function _iniciarLoopSomNotificacao() {
  if (_somLoopInterval) return; // já está rodando
  _tocarSomNotificacaoPedido(); // toca imediatamente a primeira vez
  _somLoopInterval = setInterval(() => {
    if (window.PEDIDOS_NAO_VISTOS.size === 0) {
      clearInterval(_somLoopInterval);
      _somLoopInterval = null;
      return;
    }
    _tocarSomNotificacaoPedido();
  }, 3000);
}

// Chamada quando o admin clica no sino 🔔 ou no card do pedido.
// Remove o pedido da lista de "não vistos" e para o som se não sobrar mais nenhum.
function marcarPedidoVisto(id) {
  if (!window.PEDIDOS_NAO_VISTOS.has(id)) return;
  window.PEDIDOS_NAO_VISTOS.delete(id);
  if (window.PEDIDOS_NAO_VISTOS.size === 0 && _somLoopInterval) {
    clearInterval(_somLoopInterval);
    _somLoopInterval = null;
  }
  if (typeof renderizarAdmPedidos === "function") renderizarAdmPedidos();
}
window.marcarPedidoVisto = marcarPedidoVisto;

function _iniciarPolling() {
  if (_pollingInterval) return;

  _pollingInterval = setInterval(async () => {
    try {
      const pedidos = await API_PEDIDOS.listar();
      const atual   = STATE.get("pedidos") || [];

      if (pedidos.length !== atual.length) {
        const novos = pedidos.length - atual.length;

        // Descobre quais pedidos são realmente novos (por id) para marcar
        // como "não vistos" — faz o sino piscar neles até o admin clicar.
        const idsAntigos = new Set(atual.map(p => p.id));
        pedidos.forEach(p => {
          if (!idsAntigos.has(p.id)) window.PEDIDOS_NAO_VISTOS.add(p.id);
        });

        STATE.set("pedidos", pedidos);

        // Sincroniza também produtos (para atualizar estoque e vendas)
        const [produtos, estoquesBases] = await Promise.all([
          API_PRODUTOS.listar(),
          API_ESTOQUE_BASE.listar(),
        ]);
        STATE.set("produtos",      produtos      || []);
        STATE.set("estoquesBases", estoquesBases || []);

        // Notificação (som em loop + aviso visual) e atualização da interface
        if (novos > 0) {
          MODAL.toast(`🔔 ${novos} novo(s) pedido(s) recebido(s)!`);
          _iniciarLoopSomNotificacao();
        }

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
  const btn        = document.getElementById("btn-login-entrar");

  const loginVal = loginInput?.value?.trim();
  const senhaVal = senhaInput?.value;

  if (!loginVal || !senhaVal) {
    if (erroEl) { erroEl.textContent = "❌ Preencha o usuário e a senha."; erroEl.style.display = "block"; }
    return;
  }

  // Trava o botão e mostra "Conectando..." — evita o admin ficar clicando
  // várias vezes achando que travou (comum durante o "acordar" do servidor).
  if (btn && !btn.disabled) {
    btn.disabled = true;
    btn.dataset.textoOriginal = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:girar 0.7s linear infinite;vertical-align:-2px;margin-right:8px;"></span>Conectando...`;
  }
  if (erroEl) erroEl.style.display = "none";

  try {
    const dados = await API_AUTH.login(loginVal, senhaVal);
    AUTH.salvar(dados.token, dados.empresaId, dados.nome, dados.slug, dados.vencimento);
    STATE.set("adminLogado", true);
    if (btn) btn.innerHTML = `<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:girar 0.7s linear infinite;vertical-align:-2px;margin-right:8px;"></span>Carregando painel...`;
    const nomeEl = document.getElementById("adm-loja-nome");
    if (nomeEl) nomeEl.textContent = dados.nome;
    // Atualiza o card "Aviso de Assinatura" do menu lateral (ver assinatura.js)
    window.AVISO_ASSINATURA?.atualizar();
    // Só esconde a tela de login/carregamento DEPOIS que os dados do painel
    // (produtos, pedidos, etc.) realmente chegarem — assim o admin nunca vê
    // o painel "vazio" por alguns segundos enquanto ainda está buscando tudo.
    await _carregarDadosAdmin();
    document.getElementById("login-overlay")?.classList.remove("active");
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
  } finally {
    // Restaura o botão (só faz sentido se o login falhou — em caso de
    // sucesso o overlay já foi escondido e o painel está carregado)
    if (btn && btn.disabled) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.textoOriginal || "🔓 Entrar";
    }
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

    // Busca qual som de notificação está configurado em empresasConfig.js
    // (SOM_NOTIFICACAO_PEDIDO) — não bloqueia o resto do carregamento.
    API_SISTEMA.somConfig()
      .then(cfg => { if (cfg?.som) _somAtivoPreset = cfg.som; })
      .catch(() => { /* mantém "classico" como padrão em caso de erro */ });

    // Se já possui sessão ativa, carrega o painel direto
    if (AUTH.logado()) {
      STATE.set("adminLogado", true);
      // Troca o conteúdo do overlay pra um estado de carregamento (sem
      // formulário de login, já que a sessão é válida) e só esconde depois
      // que os dados do painel realmente chegarem — evita mostrar o admin
      // vazio por alguns segundos (ex: servidor "acordando" no Render).
      const loginBox = document.querySelector(".login-box");
      if (loginBox) {
        loginBox.dataset.htmlOriginal = loginBox.innerHTML;
        loginBox.innerHTML = `
          <img src="assets/logo-sistema.png" alt="SALUT" class="login-logo-img">
          <span style="display:inline-block;width:34px;height:34px;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:girar 0.8s linear infinite;margin:14px 0;"></span>
          <p style="color:#fff;font-size:14px;margin:0;">Aguarde, carregando o painel...</p>`;
      }
      const nomeEl = document.getElementById("adm-loja-nome");
      if (nomeEl) nomeEl.textContent = AUTH.nome() || "Painel Admin";
      // Atualiza o card "Aviso de Assinatura" do menu lateral (ver assinatura.js)
      window.AVISO_ASSINATURA?.atualizar();
      await _carregarDadosAdmin();
      document.getElementById("login-overlay")?.classList.remove("active");
      if (loginBox && loginBox.dataset.htmlOriginal) loginBox.innerHTML = loginBox.dataset.htmlOriginal;
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
      STATE.set("lojaCarregada", true);
      document.getElementById("loja-loading-overlay")?.remove();
      document.body.classList.remove("loja-carregando");
      _aplicarConfig(loja.config);
      // Reaplica o footer/banner com os dados reais da empresa (nome, endereço, etc.)
      // agora que a config terminou de carregar — corrige o footer mostrando
      // sempre dados desatualizados/padrão quando a config demorava mais que o
      // preenchimento inicial da página.
      if (typeof window._sincronizarInfoLoja === "function") window._sincronizarInfoLoja();
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
      // Mesmo em erro, marca como "carregado" pra não deixar o spinner girando
      // pra sempre — mostra a mensagem padrão de "loja vazia" em vez disso.
      STATE.set("lojaCarregada", true);
      document.getElementById("loja-loading-overlay")?.remove();
      document.body.classList.remove("loja-carregando");
      if (typeof renderizarProdutos === "function") renderizarProdutos();
    }
  } else {
    // Sem slug identificado — não há como buscar a loja. Remove a tela de
    // carregamento para não deixar a página travada em branco.
    document.getElementById("loja-loading-overlay")?.remove();
    document.body.classList.remove("loja-carregando");
  }
});
