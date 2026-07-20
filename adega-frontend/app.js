// ============================================================
//  SISTEMA DELIVERY — app.js v2.0
//  Estado centralizado, tabs, exclusão de pedidos com estorno
// ============================================================

const CONFIG = {
  loja: {
    nome: "Açaí & Cia",
    slogan: "Adega, tabacaria e muito mais!",
    logo: "🍇",
    logoUrl: "",
    banner: "",
    bannerTexto: "Açaí com frutas selecionadas e muito mais!",
    corPrimaria: "#9e0505",
    corSecundaria: "#ab851c",
    corFundo: "#870505",
    corSuperficie: "#550c0c",
    corTexto: "#F0EAF8",
  },
  contato: {
    whatsapp: "5511959175925",
    whatsappAdm: "5511999999999",
    endereco: "Rua das Flores, 123 — Centro",
    cidade: "São Paulo — SP",
    instagram: "@acaicia",
    facebook: "acaicia",
    tiktok: "@acaicia",
  },
  funcionamento: {
    horarios: [
      { dia: "Segunda a Sexta", hora: "08:00 – 22:00" },
      { dia: "Sábado", hora: "08:00 – 23:00" },
      { dia: "Domingo", hora: "09:00 – 21:00" },
    ],
    aberto: true,
    mensagemFechado: "Estamos fechados no momento. Volte em breve!",
  },
  delivery: {
    taxaEntrega: 5.00,
    pedidoMinimo: 15.00,
    tempoEstimado: "30–50 min",
    entregaAtiva: true,
    retiradaAtiva: true,
  },
  senha: {
    // Legado: mantido apenas por compatibilidade com o cache local (localStorage).
    // A validação real da senha master agora é feita no backend, a partir de
    // adega-backend/empresaConfig.js — nada fica fixo/hardcoded aqui.
    admin: "",
    confirmacoes: "",

  },
  pagamento: {
    formas: ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito"],
    pixChave: "acaicia@pix.com",
  },
};

const ENUMS = {
  STATUS_PEDIDO: {
    PENDENTE: "pendente",
    CONFIRMADO: "confirmado",
    PREPARANDO: "preparando",
    SAIU: "saiu_entrega",
    ENTREGUE: "entregue",
    CANCELADO: "cancelado",
  },
  TIPO_ENTREGA: { ENTREGA: "entrega", RETIRADA: "retirada" },
  MSGS: {
    PRODUTO_SALVO: "Produto salvo com sucesso!",
    PRODUTO_EXCLUIDO: "Produto excluído com sucesso!",
    CATEGORIA_SALVA: "Categoria salva com sucesso!",
    COMPLEMENTO_SALVO: "Complemento salvo com sucesso!",
    CONFIG_SALVA: "Configurações salvas com sucesso!",
    SENHA_ERRADA: "Senha incorreta. Tente novamente.",
    PEDIDO_ENVIADO: "Pedido enviado com sucesso!",
    CARRINHO_VAZIO: "Seu carrinho está vazio.",
    CAMPO_OBRIGATORIO: "Preencha todos os campos obrigatórios.",
    CONFIRMAR_EXCLUSAO: "Tem certeza que deseja excluir?",
    SEM_PRODUTOS: "Nenhum produto encontrado.",
    PEDIDO_EXCLUIDO: "Pedido excluído e estoque revertido!",
  },
  FRASES_CATEGORIAS: {
    acai: "🍇 Cremoso, gelado e irresistível!",
    sorvete: "🍦 Uma colherada de felicidade em cada sabor!",
    cafe: "☕ O aroma que desperta, o sabor que conquista!",
    suco: "🍹 Natureza em cada gole!",
    fruta: "🍎 Da natureza para você — frescor garantido!",
    verdura: "🥬 Da horta para sua mesa!",
    legume: "🥕 Cor, sabor e nutrição em cada detalhe!",
    lanche: "🥪 Rápido, gostoso e feito com carinho!",
    doce: "🍰 Para adoçar o seu dia!",
    bebida: "🥤 Refrescante do jeito que você gosta!",
    complemento: "✨ Personalize do seu jeito!",
    default: "🌟 Qualidade e sabor em cada detalhe!",
  },
};

// ============================================================
// ESTADO CENTRALIZADO COM SISTEMA REATIVO
// ============================================================
const STATE = {
  _data: {
    carrinho: [],
    produtos: [],
    categorias: [],
    complementos: [],
    pedidos: [],
    adminLogado: false,
    categoriaFiltro: "todos",
    buscaTermo: "",
  },
  _listeners: {},

  get(key) { return this._data[key]; },
  set(key, value) {
    this._data[key] = value;
    this._notify(key, value);
    this._notify("*", { key, value });
  },
  update(key, fn) {
    const val = fn(this._data[key]);
    this.set(key, val);
    return val;
  },
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => { this._listeners[event] = this._listeners[event].filter(f => f !== fn); };
  },
  _notify(event, value) {
    (this._listeners[event] || []).forEach(fn => fn(value));
  },
};

// ============================================================
// STORAGE
// ============================================================
const STORAGE = {
  KEYS: {
    PRODUTOS: "sdv_produtos",
    CATEGORIAS: "sdv_categorias",
    COMPLEMENTOS: "sdv_complementos",
    PEDIDOS: "sdv_pedidos",
    CONFIG: "sdv_config",
    CARRINHO: "sdv_carrinho",
  },
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
  carregarTudo() {
    STATE.set("produtos", this.get(this.KEYS.PRODUTOS) || []);
    STATE.set("categorias", this.get(this.KEYS.CATEGORIAS) || []);
    STATE.set("complementos", this.get(this.KEYS.COMPLEMENTOS) || []);
    STATE.set("pedidos", this.get(this.KEYS.PEDIDOS) || []);
    STATE.set("carrinho", this.get(this.KEYS.CARRINHO) || []);
    const cfgSalva = this.get(this.KEYS.CONFIG);
    if (cfgSalva) {
      CONFIG.loja = { ...CONFIG.loja, ...cfgSalva.loja };
      CONFIG.contato = { ...CONFIG.contato, ...cfgSalva.contato };
      CONFIG.funcionamento = { ...CONFIG.funcionamento, ...cfgSalva.funcionamento };
      CONFIG.delivery = { ...CONFIG.delivery, ...cfgSalva.delivery };
      CONFIG.senha = { ...CONFIG.senha, ...cfgSalva.senha };
    }
  },
  salvarProdutos() { this.set(this.KEYS.PRODUTOS, STATE.get("produtos")); },
  salvarCategorias() { this.set(this.KEYS.CATEGORIAS, STATE.get("categorias")); },
  salvarComplementos() { this.set(this.KEYS.COMPLEMENTOS, STATE.get("complementos")); },
  salvarPedidos() { this.set(this.KEYS.PEDIDOS, STATE.get("pedidos")); },
  salvarCarrinho() { this.set(this.KEYS.CARRINHO, STATE.get("carrinho")); },
  salvarConfig() {
    this.set(this.KEYS.CONFIG, {
      loja: CONFIG.loja, contato: CONFIG.contato,
      funcionamento: CONFIG.funcionamento, delivery: CONFIG.delivery, senha: CONFIG.senha
    });
  },
};

// ============================================================
// UTILITÁRIOS
// ============================================================
const UTIL = {
  id() { return Date.now().toString(36) + Math.random().toString(36).substr(2); },
  formatarMoeda(v) { return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); },
  formatarData(d) {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  },
  hoje() { return new Date().toISOString().slice(0, 10); },
  mesAtual() { return new Date().toISOString().slice(0, 7); },
  anoAtual() { return new Date().getFullYear().toString(); },
  slugify(str) {
    return str.toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  },
  gerarFraseCategoria(nome) {
    const slug = UTIL.slugify(nome);
    for (const chave in ENUMS.FRASES_CATEGORIAS) {
      if (slug.includes(chave)) return ENUMS.FRASES_CATEGORIAS[chave];
    }
    return ENUMS.FRASES_CATEGORIAS.default;
  },
  sanitize(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  },
  async verificarSenha(senha) {
    if (!senha) return false;
    // Deixa erros de conexão/servidor "vazarem" para quem chamou (MODAL),
    // que sabe diferenciar isso de uma senha simplesmente incorreta.
    const resposta = await API_SENHA_MASTER.validar(senha);
    return !!(resposta && resposta.valida);
  },
  aplicarCores() {
    const r  = document.documentElement.style;
    const tx = CONFIG.loja.corTexto      || "#F0EAF8";
    r.setProperty("--primary",    CONFIG.loja.corPrimaria   || "#5B2D8E");
    r.setProperty("--secondary",  CONFIG.loja.corSecundaria || "#8B5CF6");
    r.setProperty("--background", CONFIG.loja.corFundo      || "#0D0820");
    r.setProperty("--surface",    CONFIG.loja.corSuperficie || "#1A1030");
    r.setProperty("--text",       tx);
    // Injeta estilo global para cobrir 100% dos textos
    let st = document.getElementById("__cores");
    if (!st) { st = document.createElement("style"); st.id = "__cores"; document.head.appendChild(st); }
    st.textContent = `
      body, body * { color: inherit !important; }
      body { color: ${tx} !important; }
      .badge-danger  { color: #fff !important; background:#e55 !important; }
      .badge-warning { color: #f59797 !important; }
      .badge-success { color: #fff !important; background:#2ecc71 !important; }
      .btn-primary   { color: #fff !important; }
      .btn-danger    { color: #fff !important; }
      a.btn, button.btn { color: #fff !important; }
      input:not([type=color]), textarea, select { color: ${tx} !important; }
    `;
  },
};

// ============================================================
// MODAL SYSTEM
// ============================================================
const MODAL = {
  mostrar(tipo, titulo, mensagem, onConfirm = null, placeholder = "", onCancel = null) {
    document.getElementById("modal-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.className = "modal-overlay";
    const icones = { sucesso: "✅", erro: "❌", confirmacao: "⚠️", info: "ℹ️", senha: "🔐" };
    const cores = { sucesso: "var(--success)", erro: "var(--danger)", confirmacao: "var(--warning)", info: "var(--primary)", senha: "var(--primary)" };
    const isConfirm = tipo === "confirmacao" || tipo === "senha";
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-icon" style="color:${cores[tipo]||cores.info}">${icones[tipo]||"ℹ️"}</div>
        <h3 class="modal-titulo">${titulo}</h3>
        <p class="modal-msg">${mensagem}</p>
        ${tipo === "senha" ? `<input type="password" id="modal-senha-input" class="modal-input" placeholder="${placeholder || 'Digite a senha'}" autocomplete="off">` : ""}
        <div class="modal-btns">
          ${isConfirm ? `<button class="btn btn-outline" id="modal-cancel-btn">Cancelar</button>` : ""}
          <button class="btn ${tipo==='erro'?'btn-danger':tipo==='sucesso'?'btn-success':'btn-primary'}" id="modal-confirm-btn">
            ${tipo === "senha" ? "Confirmar" : isConfirm ? "Confirmar" : "OK"}
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("active"), 10);
    const btn = document.getElementById("modal-confirm-btn");
    const cancelBtn = document.getElementById("modal-cancel-btn");
    if (cancelBtn) cancelBtn.onclick = () => { MODAL.fechar(); if (onCancel) onCancel(); };
    if (tipo === "senha") {
      btn.onclick = async () => {
        const inputEl = document.getElementById("modal-senha-input");
        const msgEl = overlay.querySelector(".modal-msg");
        const val = inputEl?.value;
        btn.disabled = true;
        try {
          // Validação assíncrona: consulta a senha master centralizada no backend
          const valida = await UTIL.verificarSenha(val);
          if (valida) { MODAL.fechar(); if (onConfirm) onConfirm(); }
          else { inputEl?.classList.add("input-erro"); MODAL.shake(); }
        } catch (e) {
          // Erro de conexão/servidor (ex: backend fora do ar ou desatualizado) —
          // mostra mensagem distinta para não confundir com "senha errada"
          console.error("Erro ao validar senha master:", e.message);
          inputEl?.classList.add("input-erro");
          MODAL.shake();
          if (msgEl) msgEl.innerHTML = `⚠️ Não foi possível validar a senha (erro de conexão com o servidor). Verifique se o backend está no ar e tente novamente.`;
        } finally {
          btn.disabled = false;
        }
      };
      document.getElementById("modal-senha-input")?.addEventListener("keydown", e => { if (e.key === "Enter") btn.click(); });
      setTimeout(() => document.getElementById("modal-senha-input")?.focus(), 100);
    } else if (isConfirm) {
      btn.onclick = () => { MODAL.fechar(); if (onConfirm) onConfirm(); };
    } else {
      btn.onclick = () => { MODAL.fechar(); if (onConfirm) onConfirm(); };
      setTimeout(() => MODAL.fechar(), 3000);
    }
    overlay.addEventListener("click", e => {
      if (e.target === overlay && tipo !== "senha") { MODAL.fechar(); if (onCancel) onCancel(); }
    });
  },
  fechar() {
    const o = document.getElementById("modal-overlay");
    if (o) { o.classList.remove("active"); setTimeout(() => o.remove(), 300); }
  },
  shake() {
    const b = document.querySelector(".modal-box");
    b?.classList.add("shake");
    setTimeout(() => b?.classList.remove("shake"), 400);
  },
  sucesso(msg) { this.mostrar("sucesso", "Sucesso!", msg); },
  erro(msg) { this.mostrar("erro", "Ops!", msg); },
  confirmar(msg, cb) { this.mostrar("confirmacao", "Confirmar ação", msg, cb); },
  pedirSenha(titulo, cb, onCancel = null) { this.mostrar("senha", titulo, "Digite a senha para continuar:", cb, "", onCancel); },
  abrir(html) {
    document.getElementById("modal-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" style="max-width:600px;width:95%;max-height:85vh;overflow-y:auto;">${html}</div>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("active"), 10);
    overlay.addEventListener("click", e => { if (e.target === overlay) MODAL.fechar(); });
  },
  toast(msg, tipo = "sucesso") {
    document.querySelectorAll(".toast").forEach(t => t.remove());
    const t = document.createElement("div");
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2800);
  },
};

// ============================================================
// SISTEMA DE TABS (Admin)
// ============================================================
const TABS = {
  init(secaoId) {
    const secao = document.getElementById(secaoId);
    if (!secao) return;
    const tabBtns = secao.querySelectorAll(".tab-btn");
    const tabPanes = secao.querySelectorAll(".tab-pane");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove("ativo"));
        tabPanes.forEach(p => p.classList.remove("ativo"));
        btn.classList.add("ativo");
        secao.querySelector(`#${target}`)?.classList.add("ativo");
        // Hook para renderizar conteúdo quando aba é aberta
        const event = new CustomEvent("tabchange", { detail: { tab: target, secao: secaoId } });
        document.dispatchEvent(event);
      });
    });
    // Ativar primeira aba por padrão
    if (tabBtns.length > 0) {
      tabBtns[0].click();
    }
  },
  initAll() {
    document.querySelectorAll(".adm-secao").forEach(sec => {
      if (sec.querySelector(".tab-btn")) this.init(sec.id);
    });
  },
  ir(secaoId, tabId) {
    mostrarSecao(secaoId);
    const secao = document.getElementById(secaoId);
    if (!secao) return;
    const btn = secao.querySelector(`[data-tab="${tabId}"]`);
    if (btn) btn.click();
  },
};

// ============================================================
// CARRINHO
// ============================================================
const CARRINHO = {
  adicionar(produto, quantidade, tamanho, complementosSelecionados, observacao) {
    const item = {
      id: UTIL.id(),
      produtoId: produto.id,
      nome: produto.nome,
      preco: parseFloat(produto.preco) || 0,
      imagem: produto.imagem,
      quantidade: parseInt(quantidade) || 1,
      tamanho: tamanho || "",
      complementos: complementosSelecionados || [],
      observacao: observacao || "",
      // Para Estoque-Base: usa o tamanho selecionado (ex: "400ML") se disponível,
      // senão usa a unidade base do produto (ex: "kg", "L")
      unidade: tamanho || produto.unidade || "un",
    };
    STATE.update("carrinho", c => [...c, item]);
    STORAGE.salvarCarrinho();
    MODAL.toast("Item adicionado ao carrinho! 🛒");
  },
  remover(id) {
    STATE.update("carrinho", c => c.filter(i => i.id !== id));
    STORAGE.salvarCarrinho();
  },
  alterarQtd(id, delta) {
    STATE.update("carrinho", c => c.map(i =>
      i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i
    ));
    STORAGE.salvarCarrinho();
  },
  limpar() {
    STATE.set("carrinho", []);
    STORAGE.salvarCarrinho();
  },
  total() {
    return STATE.get("carrinho").reduce((s, i) => {
      const compPreco = i.complementos.reduce((cs, c) => cs + (c.preco || 0), 0);
      return s + (i.preco + compPreco) * i.quantidade;
    }, 0);
  },
  atualizarUI() {
    const badge = document.getElementById("carrinho-badge");
    const count = STATE.get("carrinho").reduce((s, i) => s + i.quantidade, 0);
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "flex" : "none";
    }
    if (document.getElementById("carrinho-itens")) this.renderizarCarrinho();
  },
  renderizarCarrinho() {
    const container = document.getElementById("carrinho-itens");
    if (!container) return;
    const carrinho = STATE.get("carrinho");
    if (carrinho.length === 0) {
      container.innerHTML = `<div class="carrinho-vazio"><span>🛒</span><p>${ENUMS.MSGS.CARRINHO_VAZIO}</p></div>`;
    } else {
      container.innerHTML = carrinho.map(item => {
        const compPreco = item.complementos.reduce((s, c) => s + (c.preco || 0), 0);
        const subtotal = (item.preco + compPreco) * item.quantidade;
        return `<div class="carrinho-item" data-id="${item.id}">
          <div class="ci-img">${item.imagem
            ? `<img src="${UTIL.sanitize(item.imagem)}" alt="">`
            : `<span class="ci-emoji">🛒</span>`}</div>
          <div class="ci-info">
            <strong>${UTIL.sanitize(item.nome)}</strong>
            ${item.tamanho ? `<small>Tamanho: ${item.tamanho}</small>` : ""}
            ${item.complementos.length ? `<small>+ ${item.complementos.map(c => c.nome).join(", ")}</small>` : ""}
            ${item.observacao ? `<small class="ci-obs">📝 ${UTIL.sanitize(item.observacao)}</small>` : ""}
            <span class="ci-preco">${UTIL.formatarMoeda(subtotal)}</span>
          </div>
          <div class="ci-qtd">
            <button onclick="CARRINHO.alterarQtd('${item.id}',-1)">−</button>
            <span>${item.quantidade}</span>
            <button onclick="CARRINHO.alterarQtd('${item.id}',1)">+</button>
          </div>
          <button class="ci-del" onclick="CARRINHO.remover('${item.id}')">✕</button>
        </div>`;
      }).join("");
    }
    this._atualizarTotais();
  },
  _atualizarTotais() {
    const subtotal = this.total();
    const tipoEntrega = document.querySelector('input[name="tipo-entrega"]:checked')?.value || ENUMS.TIPO_ENTREGA.RETIRADA;
    const taxaCadastrada = CONFIG.delivery.taxaEntrega || 0;
    const isEntrega = tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA && CONFIG.delivery.entregaAtiva;
    // Só cobra e exibe a taxa quando o tipo selecionado é Entrega.
    // Na Retirada, a linha mostra "Retirada" + "Grátis", nunca o valor da taxa.
    const taxaCobrada = isEntrega ? taxaCadastrada : 0;
    const total = subtotal + taxaCobrada;
    const elSub   = document.getElementById("carrinho-subtotal");
    const elTaxa  = document.getElementById("carrinho-taxa");
    const elLabel = document.getElementById("carrinho-taxa-label");
    const elTotal = document.getElementById("carrinho-total");
    if (elSub) elSub.textContent = UTIL.formatarMoeda(subtotal);
    if (elLabel) elLabel.textContent = isEntrega ? "Entrega" : "Retirada";
    if (elTaxa) elTaxa.textContent = isEntrega
      ? (taxaCadastrada > 0 ? UTIL.formatarMoeda(taxaCadastrada) : "Grátis")
      : "Grátis";
    if (elTotal) elTotal.textContent = UTIL.formatarMoeda(total);
  },
};

// Reatividade: carrinho
STATE.on("carrinho", () => CARRINHO.atualizarUI());

// ============================================================
// ENVIO DE PEDIDO (Loja do Cliente)
// ── Antes abria o WhatsApp com uma mensagem editável antes do envio,
//    o que podia gerar divergência entre o que ficava registrado no
//    sistema e o que era efetivamente enviado ao estabelecimento.
//    Agora o pedido vai direto para o sistema (mesma rota pública
//    API_PEDIDOS.criarPublico já usada), sem abrir o WhatsApp.
//    Mantido o nome "WPP" apenas para não quebrar referências
//    existentes (ex.: chamada em bindCarrinhoFinalizacao).
// ============================================================
const WPP = {
  async enviar(cliente, tipoEntrega, formaPagamento, endereco) {
    const carrinho = STATE.get("carrinho");
    if (carrinho.length === 0) { MODAL.erro(ENUMS.MSGS.CARRINHO_VAZIO); return; }
    if (!cliente.nome || !cliente.telefone) { MODAL.erro(ENUMS.MSGS.CAMPO_OBRIGATORIO); return; }

    const subtotal = CARRINHO.total();
    const taxa = tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA && CONFIG.delivery.entregaAtiva
      ? CONFIG.delivery.taxaEntrega : 0;

    const pedido = {
      id: UTIL.id(),
      data: new Date().toISOString(),
      cliente,
      itens: [...carrinho],
      tipoEntrega,
      formaPagamento,
      endereco,
      subtotal,
      taxaEntrega: taxa,
      total: subtotal + taxa,
      status: ENUMS.STATUS_PEDIDO.PENDENTE,
    };

    try {
      // Rota pública — não precisa de token de admin. O slug identifica
      // exclusivamente a empresa dona do link, garantindo que o pedido
      // chegue à empresa correta (multi-tenant).
      if (window.LOJA_SLUG && typeof API_PEDIDOS !== "undefined") {
        await API_PEDIDOS.criarPublico(window.LOJA_SLUG, pedido);
      } else {
        // Fallback local — usado só quando a loja é aberta sem slug/backend
        // (ex.: teste local do arquivo). Mesmo formato de pedido.
        STATE.update("pedidos", p => [...p, pedido]);
        STORAGE.salvarPedidos();
      }
    } catch (e) {
      console.error("Erro ao enviar pedido:", e.message);
      MODAL.erro("Não foi possível enviar seu pedido. Tente novamente.");
      return;
    }

    CARRINHO.limpar();
    MODAL.sucesso(ENUMS.MSGS.PEDIDO_ENVIADO);
    fecharCarrinho();
  },
};


// ============================================================
// PRODUTOS
// ============================================================
const PRODUTOS = {
  criar(dados) {
    const p = { id: UTIL.id(), ativo: true, dataCriacao: new Date().toISOString(), vendas: 0, ...dados };
    STATE.update("produtos", list => [...list, p]);
    STORAGE.salvarProdutos();
    return p;
  },
  editar(id, dados) {
    STATE.update("produtos", list => list.map(p => p.id === id ? { ...p, ...dados } : p));
    STORAGE.salvarProdutos();
    return true;
  },
  excluir(id) {
    STATE.update("produtos", list => list.filter(p => p.id !== id));
    STORAGE.salvarProdutos();
  },
  pausar(id) {
    STATE.update("produtos", list => list.map(p => p.id === id ? { ...p, ativo: !p.ativo } : p));
    STORAGE.salvarProdutos();
  },
  filtrar(termo, categoria) {
    return STATE.get("produtos").filter(p => {
      const matchCat = !categoria || categoria === "todos" || p.categoria === categoria;
      const matchTermo = !termo || p.nome.toLowerCase().includes(termo.toLowerCase()) ||
        (p.descricao || "").toLowerCase().includes(termo.toLowerCase());
      return matchCat && matchTermo;
    });
  },
  comEstoqueBaixo(limite = 5) {
    const estoquesBases = STATE.get("estoquesBases") || [];
    return STATE.get("produtos").filter(p => {
      // Produto com Estoque-Base: verifica quantidade do base (limite: 1 kg/L)
      if (p.usaEstoqueBase && p.estoqueBaseId) {
        const base = estoquesBases.find(e => e.id === p.estoqueBaseId);
        return base && base.quantidade <= 1;
      }
      // Produto por unidade: comportamento original inalterado
      return p.estoque !== "" && p.estoque !== undefined &&
             Number(p.estoque) <= limite && Number(p.estoque) >= 0;
    });
  },
  vencendo() {
    const hoje = UTIL.hoje();
    return STATE.get("produtos").filter(p => p.validade && p.validade <= hoje);
  },
  maisPedidos() {
    return [...STATE.get("produtos")].sort((a, b) => (b.vendas || 0) - (a.vendas || 0)).slice(0, 5);
  },
};

// ============================================================
// CATEGORIAS
// ============================================================
const CATEGORIAS = {
  criar(dados) {
    const c = { id: UTIL.id(), ativo: true, ordem: STATE.get("categorias").length, ...dados };
    if (!c.frase) c.frase = UTIL.gerarFraseCategoria(c.nome);
    STATE.update("categorias", list => [...list, c]);
    STORAGE.salvarCategorias();
    return c;
  },
  editar(id, dados) {
    STATE.update("categorias", list => list.map(c => c.id === id ? { ...c, ...dados } : c));
    STORAGE.salvarCategorias();
    return true;
  },
  excluir(id) {
    STATE.update("categorias", list => list.filter(c => c.id !== id));
    STORAGE.salvarCategorias();
  },
  pausar(id) {
    STATE.update("categorias", list => list.map(c => c.id === id ? { ...c, ativo: !c.ativo } : c));
    STORAGE.salvarCategorias();
  },
  reordenar(ids) {
    const categorias = STATE.get("categorias");
    ids.forEach((id, i) => {
      const c = categorias.find(x => x.id === id);
      if (c) c.ordem = i;
    });
    categorias.sort((a, b) => a.ordem - b.ordem);
    STATE.set("categorias", [...categorias]);
    STORAGE.salvarCategorias();
  },
  ativas() {
    return STATE.get("categorias").filter(c => c.ativo).sort((a, b) => a.ordem - b.ordem);
  },
};

// ============================================================
// COMPLEMENTOS
// ============================================================
const COMPLEMENTOS = {
  criar(dados) {
    const c = { id: UTIL.id(), ativo: true, ...dados };
    STATE.update("complementos", list => [...list, c]);
    STORAGE.salvarComplementos();
    return c;
  },
  editar(id, dados) {
    STATE.update("complementos", list => list.map(c => c.id === id ? { ...c, ...dados } : c));
    STORAGE.salvarComplementos();
    return true;
  },
  excluir(id) {
    STATE.update("complementos", list => list.filter(c => c.id !== id));
    STORAGE.salvarComplementos();
  },
  pausar(id) {
    STATE.update("complementos", list => list.map(c => c.id === id ? { ...c, ativo: !c.ativo } : c));
    STORAGE.salvarComplementos();
  },
  ativos() { return STATE.get("complementos").filter(c => c.ativo); },
};

// ============================================================
// PEDIDOS — com exclusão e estorno
// ============================================================
const PEDIDOS = {
  excluir(id) {
    const pedidos = STATE.get("pedidos");
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) return;

    // Estornar estoque dos produtos
    const produtos = [...STATE.get("produtos")];
    const complementos = [...STATE.get("complementos")];

    (pedido.itens || []).forEach(item => {
      const prod = produtos.find(p => p.id === item.produtoId);
      if (prod) {
        if (prod.estoque !== undefined && prod.estoque !== null && prod.estoque !== "") {
          prod.estoque = (prod.estoque || 0) + item.quantidade;
        }
        prod.vendas = Math.max(0, (prod.vendas || 0) - item.quantidade);
      }
      // Estornar complementos
      (item.complementos || []).forEach(c => {
        const comp = complementos.find(x => x.id === c.id);
        if (comp && comp.estoque !== undefined && comp.estoque !== "") {
          comp.estoque = (comp.estoque || 0) + item.quantidade;
        }
      });
    });

    // Remover pedido
    STATE.update("pedidos", list => list.filter(p => p.id !== id));
    STATE.set("produtos", produtos);
    STATE.set("complementos", complementos);

    STORAGE.salvarPedidos();
    STORAGE.salvarProdutos();
    STORAGE.salvarComplementos();
  },
};

// ============================================================
// DASHBOARD
// ============================================================
const DASHBOARD = {
  faturamentoDia() {
    const hoje = UTIL.hoje();
    return STATE.get("pedidos")
      .filter(p => p.data?.startsWith(hoje) && p.status !== ENUMS.STATUS_PEDIDO.CANCELADO && !p.excluido)
      .reduce((s, p) => s + (p.total || 0), 0);
  },
  faturamentoMes() {
    const mes = UTIL.mesAtual();
    return STATE.get("pedidos")
      .filter(p => p.data?.startsWith(mes) && p.status !== ENUMS.STATUS_PEDIDO.CANCELADO && !p.excluido)
      .reduce((s, p) => s + (p.total || 0), 0);
  },
  faturamentoAno() {
    const ano = UTIL.anoAtual();
    return STATE.get("pedidos")
      .filter(p => p.data?.startsWith(ano) && p.status !== ENUMS.STATUS_PEDIDO.CANCELADO && !p.excluido)
      .reduce((s, p) => s + (p.total || 0), 0);
  },
  totalPedidos() { return STATE.get("pedidos").filter(p => !p.excluido).length; },
  atualizar() {
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s("fat-dia", UTIL.formatarMoeda(this.faturamentoDia()));
    s("fat-mes", UTIL.formatarMoeda(this.faturamentoMes()));
    s("fat-ano", UTIL.formatarMoeda(this.faturamentoAno()));
    s("tot-pedidos", this.totalPedidos());
    this.renderizarAlertas();
    this.renderizarMaisPedidos();
    this.renderizarResumoEstoque();
  },
  renderizarAlertas() {
    const el = document.getElementById("lista-estoque-baixo");
    if (!el) return;

    const lista         = PRODUTOS.comEstoqueBaixo(5);
    const estoquesBases = STATE.get("estoquesBases") || [];

    // Produtos por unidade com estoque baixo
    const alertasUnidade = lista.filter(p => !p.usaEstoqueBase);

    // Produtos por peso com estoque-base baixo
    const alertasPeso = lista.filter(p => p.usaEstoqueBase && p.estoqueBaseId);

    // Estoques-base baixos sem produto duplicado na lista
    const basesAlerta = estoquesBases.filter(base =>
      base.quantidade <= 1 && !lista.some(p => p.estoqueBaseId === base.id)
    );

    // Monta HTML do card estoque baixo
    const itensHtml = [
      ...alertasUnidade.map(p => `
        <div class="alerta-item">
          <span>⚠️ ${UTIL.sanitize(p.nome)}</span>
          <span class="badge-danger">${p.estoque} ${p.unidade || "un"}</span>
        </div>`),
      ...alertasPeso.map(p => {
        const base = estoquesBases.find(e => e.id === p.estoqueBaseId);
        return `<div class="alerta-item">
          <span>⚠️ ${UTIL.sanitize(p.nome)} <small>(Base: ${base?.nome || "?"})</small></span>
          <span class="badge-danger">${base ? base.quantidade.toFixed(2) + " " + base.unidade : "baixo"}</span>
        </div>`;
      }),
      ...basesAlerta.map(base => `
        <div class="alerta-item">
          <span>⚖️ ${UTIL.sanitize(base.nome)} (Estoque-Base)</span>
          <span class="badge-danger">${base.quantidade.toFixed(2)} ${base.unidade}</span>
        </div>`),
    ];

    el.innerHTML = itensHtml.length
      ? itensHtml.join("")
      : `<p class="sem-dados">Nenhum alerta de estoque.</p>`;

    // ── Contagem total de alertas ─────────────────────────────
    // Contabiliza: unidade + peso + bases sem produto = total real
    const totalUnidade = alertasUnidade.length;
    const totalBase    = alertasPeso.length + basesAlerta.length;
    const totalAlertas = itensHtml.length; // total correto

    // ── Remove badge do menu lateral (não queremos lá) ────────
    const navEstoque = document.querySelector('[data-sec="sec-complementos"]');
    if (navEstoque) {
      const badgeAntigo = navEstoque.querySelector(".nav-badge");
      if (badgeAntigo) badgeAntigo.remove();
    }

    // ── Badge na aba interna "Controle de Estoque" ───────────
    // Mostra contagem de produtos por unidade com estoque baixo
    const btnControle = document.querySelector('[data-tab="tab-controle-estoque"]');
    if (btnControle) {
      let b = btnControle.querySelector(".tab-badge");
      if (!b) {
        b = document.createElement("span");
        b.className = "tab-badge";
        b.style.cssText = "background:#e55;color:#fff;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:5px;font-weight:700;";
        btnControle.appendChild(b);
      }
      b.textContent   = totalUnidade > 0 ? totalUnidade : "";
      b.style.display = totalUnidade > 0 ? "inline" : "none";
    }

    // ── Badge na aba interna "Estoque-Base" ──────────────────
    // Mostra contagem de estoques-base baixos
    const btnBase = document.querySelector('[data-tab="tab-estoque-base"]');
    if (btnBase) {
      let b = btnBase.querySelector(".tab-badge");
      if (!b) {
        b = document.createElement("span");
        b.className = "tab-badge";
        b.style.cssText = "background:#e55;color:#fff;border-radius:10px;font-size:10px;padding:1px 6px;margin-left:5px;font-weight:700;";
        btnBase.appendChild(b);
      }
      b.textContent   = totalBase > 0 ? totalBase : "";
      b.style.display = totalBase > 0 ? "inline" : "none";
    }

    // ── Atualiza o card "Estoque Baixo" no dashboard ─────────
    // Mostra a contagem total correta (unidade + base)
    const cardEstoque = document.getElementById("dash-resumo-estoque");
    if (cardEstoque) {
      const total = STATE.get("produtos").length;
      cardEstoque.innerHTML = `
        <div class="dash-stat" style="cursor:pointer;" onclick="mostrarSecao('sec-produtos');TABS.ir('sec-produtos','tab-produtos-lista')" title="Ver produtos cadastrados">
          <span>${total}</span><small>Total Produtos</small>
        </div>
        <div class="dash-stat" style="cursor:pointer;" onclick="mostrarSecao('sec-complementos');TABS.ir('sec-complementos','tab-controle-estoque')" title="Ver estoque">
          <span style="color:var(--warning)">${totalAlertas}</span>
          <small>Estoque Baixo</small>
        </div>`;
    }

    const venc = document.getElementById("lista-vencendo");
    if (venc) {
      const lv = PRODUTOS.vencendo();
      venc.innerHTML = lv.length
        ? lv.map(p => `<div class="alerta-item">
            <span>⏰ ${UTIL.sanitize(p.nome)}</span>
            <span class="badge-warning">${p.validade}</span>
          </div>`).join("")
        : `<p class="sem-dados">Nenhum produto vencendo.</p>`;
    }
  },
  renderizarMaisPedidos() {
    const el = document.getElementById("lista-mais-pedidos");
    if (!el) return;
    const lista = PRODUTOS.maisPedidos().filter(p => p.vendas > 0);
    el.innerHTML = lista.length
      ? lista.map((p, i) => `<div class="rank-item">
          <span class="rank-num">${i + 1}°</span>
          <span>${UTIL.sanitize(p.nome)}</span>
          <span class="badge-primary">${p.vendas}x</span>
        </div>`).join("")
      : `<p class="sem-dados">Nenhuma venda ainda.</p>`;
  },
  renderizarResumoEstoque() {
    const el = document.getElementById("dash-resumo-estoque");
    if (!el) return;
    const total = STATE.get("produtos").length;
    const baixo = PRODUTOS.comEstoqueBaixo(5).length;
    el.innerHTML = `
      <div class="dash-stat" style="cursor:pointer;" onclick="mostrarSecao('sec-produtos');TABS.ir('sec-produtos','tab-produtos-lista')" title="Ver produtos cadastrados">
        <span>${total}</span><small>Total Produtos</small>
      </div>
      <div class="dash-stat" style="cursor:pointer;" onclick="mostrarSecao('sec-complementos');TABS.ir('sec-complementos','tab-controle-estoque')" title="Ver estoque">
        <span style="color:var(--warning)">${baixo}</span><small>Estoque Baixo</small>
      </div>
    `;
  },
};

// Reatividade automática do dashboard
STATE.on("pedidos", () => {
  if (document.getElementById("sec-dashboard")?.classList.contains("ativo")) {
    DASHBOARD.atualizar();
  }
  // Atualizar aba de pedidos se estiver visível
  const pane = document.getElementById("tab-pedidos-recebidos");
  if (pane?.classList.contains("ativo")) renderizarAdmPedidos();
});

STATE.on("produtos", () => {
  if (document.getElementById("sec-dashboard")?.classList.contains("ativo")) {
    DASHBOARD.atualizar();
  }
});

// ============================================================
// DADOS INICIAIS DE DEMONSTRAÇÃO
// ============================================================
function carregarDadosDemo() {
  // Desativado — dados vêm do MongoDB via api.js
  // Só carrega demo se não houver conexão com o backend
  if (typeof AUTH !== "undefined") return;
  if (STATE.get("categorias").length > 0) return;
  const cats = [
    { nome: "Açaí", emoji: "🍇", cor: "#7B2FBE" },
    { nome: "Sorvete", emoji: "🍦", cor: "#E91E8C" },
    { nome: "Cafeteria", emoji: "☕", cor: "#6D4C41" },
    { nome: "Frutas", emoji: "🍎", cor: "#E53935" },
    { nome: "Sucos", emoji: "🍹", cor: "#FB8C00" },
    { nome: "Essências", emoji: "💨", cor: "#616b62" },
  ];
  cats.forEach(c => CATEGORIAS.criar(c));
  const comps = [
    { nome: "Nutella", preco: 3.00, estoque: 50 },
    { nome: "Granola", preco: 1.50, estoque: 100 },
    { nome: "Leite em Pó", preco: 1.00, estoque: 80 },
    { nome: "Morango", preco: 2.00, estoque: 60 },
    { nome: "Paçoca", preco: 1.50, estoque: 70 },
    { nome: "Banana", preco: 1.00, estoque: 90 },
    { nome: "Mel", preco: 2.50, estoque: 40 },
  ];
  comps.forEach(c => COMPLEMENTOS.criar(c));

  const categorias = STATE.get("categorias");
  const prods = [
    { nome: "Açaí Tradicional", descricao: "Açaí cremoso batido na hora", categoria: categorias[0]?.id, preco: 18.00, unidade: "un", tamanhos: ["300ml", "500ml", "700ml"], estoque: 100, imagem: "", temComplementos: true },
    { nome: "Açaí Premium", descricao: "Açaí com frutas e complementos especiais", categoria: categorias[0]?.id, preco: 25.00, unidade: "un", tamanhos: ["400ml", "700ml", "1L"], estoque: 80, imagem: "", temComplementos: true },
    { nome: "Sorvete Napolitano", descricao: "Creme, chocolate e morango", categoria: categorias[1]?.id, preco: 12.00, unidade: "un", tamanhos: ["P", "M", "G"], estoque: 50, imagem: "", temComplementos: false },
    { nome: "Café Especial", descricao: "Grãos selecionados, sabor intenso", categoria: categorias[2]?.id, preco: 8.00, unidade: "un", tamanhos: [], estoque: 200, imagem: "", temComplementos: false },
    { nome: "Maçã Fuji", descricao: "Maçã importada super doce", categoria: categorias[3]?.id, preco: 4.50, unidade: "kg", tamanhos: [], estoque: 30, imagem: "", temComplementos: false },
    { nome: "Suco de Laranja", descricao: "100% natural, espremido na hora", categoria: categorias[4]?.id, preco: 10.00, unidade: "un", tamanhos: ["300ml", "500ml"], estoque: 60, imagem: "", temComplementos: false },
    { nome: "onix banana", descricao: "Fresca, sem agrotóxicos", categoria: categorias[5]?.id, preco: 3.50, unidade: "un", tamanhos: [], estoque: 40, imagem: "", temComplementos: false },
    { nome: "Suco de Laranja", descricao: "100% natural, espremido na hora", categoria: categorias[4]?.id, preco: 10.00, unidade: "un", tamanhos: ["300ml", "500ml"], estoque: 60, imagem: "", temComplementos: false },
    { nome: "onix banana", descricao: "Fresca, sem agrotóxicos", categoria: categorias[5]?.id, preco: 3.50, unidade: "un", tamanhos: [], estoque: 40, imagem: "", temComplementos: false },
  
  ];
  prods.forEach(p => PRODUTOS.criar(p));
}

// ============================================================
// FUNÇÕES GLOBAIS DE UI — CARRINHO
// ============================================================
function abrirCarrinho() {
  const panel = document.getElementById("carrinho-panel");
  if (panel) { panel.classList.add("open"); CARRINHO.renderizarCarrinho(); }
}
function fecharCarrinho() {
  document.getElementById("carrinho-panel")?.classList.remove("open");
}
window.abrirCarrinho = abrirCarrinho;
window.fecharCarrinho = fecharCarrinho;

// ============================================================
// MODAL DE PRODUTO (CLIENTE)
// ============================================================
function abrirModalProduto(produtoId) {
  const produto = STATE.get("produtos").find(p => p.id === produtoId);
  if (!produto || !produto.ativo) return;
  document.getElementById("produto-modal-overlay")?.remove();
  const complementosDisponiveis = produto.temComplementos
    ? COMPLEMENTOS.ativos().filter(c =>
        !produto.complementosVinculados || produto.complementosVinculados.length === 0
          ? true
          : produto.complementosVinculados.includes(c.id)
      )
    : [];
  const tamanhos = produto.tamanhos || [];
  const overlay = document.createElement("div");
  overlay.id = "produto-modal-overlay";
  overlay.className = "modal-overlay active";
  overlay.innerHTML = `
    <div class="produto-modal">
      <button class="produto-modal-close" onclick="document.getElementById('produto-modal-overlay').remove()">✕</button>
      ${produto.imagem
        ? `<div class="pm-img"><img src="${UTIL.sanitize(produto.imagem)}" alt="${UTIL.sanitize(produto.nome)}"></div>`
        : `<div class="pm-img" style="display:flex;align-items:center;justify-content:center;"><span style="font-size:64px">${produto.emoji || "🛍️"}</span></div>`}
      <div class="pm-body">
        <h2>${UTIL.sanitize(produto.nome)}</h2>
        <p class="pm-desc">${UTIL.sanitize(produto.descricao || "")}</p>
        <div class="pm-preco" id="pm-preco-display">${UTIL.formatarMoeda(produto.preco)}</div>
        ${tamanhos.length ? `<div class="pm-secao"><label>Tamanho:</label><div class="pm-tamanhos">${tamanhos.map(t => {
          const vol   = typeof t === "object" ? t.volume : t;
          const preco = typeof t === "object" ? t.preco  : null;
          return `<label class="tag-radio"><input type="radio" name="pm-tamanho" value="${vol}" data-preco="${preco !== null ? preco : produto.preco}" onchange="pmAtualizarPreco(this)"><span>${vol}${preco !== null ? " — " + UTIL.formatarMoeda(preco) : ""}</span></label>`;
        }).join("")}</div></div>` : ""}
        ${complementosDisponiveis.length ? `<div class="pm-secao"><label>Complementos:</label><div class="pm-complementos">${complementosDisponiveis.map(c => `<label class="tag-check"><input type="checkbox" name="pm-comp" value="${c.id}" data-nome="${c.nome}" data-preco="${c.preco || 0}"><span>${c.nome}${c.preco ? ` (+${UTIL.formatarMoeda(c.preco)})` : ""}</span></label>`).join("")}</div></div>` : ""}
        <div class="pm-secao"><label>Observação:</label><textarea id="pm-obs" placeholder="Ex: sem açúcar..." rows="2"></textarea></div>
        <div class="pm-qtd-row">
          <div class="pm-qtd">
            <button onclick="pmQtd(-1)">−</button>
            <span id="pm-qtd-val">1</span>
            <button onclick="pmQtd(1)">+</button>
          </div>
          <button class="btn btn-primary pm-add" onclick="pmAdicionarCarrinho('${produtoId}')">Adicionar ao Carrinho 🛒</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
}
window.abrirModalProduto = abrirModalProduto;

function pmQtd(d) {
  const el = document.getElementById("pm-qtd-val");
  if (el) el.textContent = Math.max(1, parseInt(el.textContent) + d);
}
window.pmQtd = pmQtd;

function pmAdicionarCarrinho(produtoId) {
  const produto = STATE.get("produtos").find(p => p.id === produtoId);
  if (!produto) return;
  const qtd = parseInt(document.getElementById("pm-qtd-val")?.textContent) || 1;
  const tamanhoEl = document.querySelector('input[name="pm-tamanho"]:checked');
  const tamanho   = tamanhoEl?.value || "";
  const precoTam  = tamanhoEl ? parseFloat(tamanhoEl.dataset.preco) || produto.preco : produto.preco;
  const comps = [...document.querySelectorAll('input[name="pm-comp"]:checked')]
    .map(el => ({ id: el.value, nome: el.dataset.nome, preco: parseFloat(el.dataset.preco) || 0 }));
  const obs = document.getElementById("pm-obs")?.value || "";
  CARRINHO.adicionar({ ...produto, preco: precoTam }, qtd, tamanho, comps, obs);
  document.getElementById("produto-modal-overlay")?.remove();
}
window.pmAdicionarCarrinho = pmAdicionarCarrinho;

function pmAtualizarPreco(input) {
  const el = document.getElementById("pm-preco-display");
  if (el) el.textContent = UTIL.formatarMoeda(parseFloat(input.dataset.preco) || 0);
}
window.pmAtualizarPreco = pmAtualizarPreco;

// ============================================================
// RENDERIZAÇÃO DO CATÁLOGO
// ============================================================
// ============================================================
// VERIFICAÇÃO DE HORÁRIO E STATUS DA LOJA
// ============================================================
function _lojaAbertaPorHorario() {
  const horarios = CONFIG.funcionamento?.horarios || [];
  if (!horarios.length) return true; // sem horários cadastrados = sempre aberta

  const agora  = new Date();
  const diaSem = agora.getDay(); // 0=Dom … 6=Sáb
  const hhmm   = agora.getHours() * 60 + agora.getMinutes();

  const diasPT = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
  const diaAtual = diasPT[diaSem];

  for (const h of horarios) {
    const diaStr = (h.dia || "").toLowerCase();

    // Verifica se o dia atual é coberto por este horário
    const cobre =
      diaStr.includes(diaAtual) ||
      (diaStr.includes("seg") && diaStr.includes("sex") && diaSem >= 1 && diaSem <= 5) ||
      (diaStr.includes("seg") && diaStr.includes("sáb") && diaSem >= 1 && diaSem <= 6) ||
      (diaStr.includes("seg") && diaStr.includes("dom") && diaSem >= 0 && diaSem <= 6) ||
      diaStr === "todos os dias" || diaStr === "todos";

    if (!cobre) continue;

    // Extrai horários de abertura e fechamento do formato "HH:MM – HH:MM" ou "HH:MM - HH:MM"
    const match = (h.hora || "").match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const abertura  = parseInt(match[1]) * 60 + parseInt(match[2]);
    const fechamento = parseInt(match[3]) * 60 + parseInt(match[4]);
    if (hhmm >= abertura && hhmm <= fechamento) return true;
  }
  return false;
}

function _verificarStatusLoja() {
  // Remove banner anterior se existir
  document.getElementById("banner-loja-fechada")?.remove();

  // Loja fechada SOMENTE pelo botão manual "Fechar Loja"
  const lojaAberta = CONFIG.funcionamento?.aberto !== false; // default true

  if (lojaAberta) return; // loja aberta, nada a fazer

  const msg = "🌙 Estamos fora do ar por agora, mas logo voltamos com tudo! Obrigado pela sua preferência. 💜";

  // Cria banner de loja fechada
  const banner = document.createElement("div");
  banner.id = "banner-loja-fechada";
  banner.style.cssText = `
    position:fixed;inset:0;z-index:9998;
    background:rgba(10,5,20,.96);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;padding:32px 24px;
  `;
  banner.innerHTML = `
    <div style="font-size:64px;margin-bottom:16px;">🔒</div>
    <div style="font-size:22px;font-weight:800;color:var(--primary,#5B2D8E);margin-bottom:12px;">${CONFIG.loja.nome || "Nossa Loja"}</div>
    <div style="font-size:16px;color:#ccc;max-width:440px;line-height:1.6;">${msg}</div>
    ${(CONFIG.funcionamento?.horarios || []).length
      ? `<div style="margin-top:24px;background:rgba(91,45,142,.15);border-radius:12px;padding:16px 24px;max-width:360px;">
           <div style="font-size:13px;font-weight:700;color:var(--primary,#5B2D8E);margin-bottom:10px;">🕐 Horários de Funcionamento</div>
           ${(CONFIG.funcionamento.horarios).map(h =>
             `<div style="display:flex;justify-content:space-between;gap:20px;font-size:13px;color:#ccc;padding:4px 0;">
               <span>${h.dia}</span><span style="font-weight:600;color:#fff;">${h.hora}</span>
             </div>`).join("")}
         </div>`
      : ""}
  `;
  document.body.appendChild(banner);

  // Bloqueia botões de adicionar ao carrinho
  document.querySelectorAll(".btn-add, .pm-add, #btn-finalizar").forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = "0.4";
    btn.style.cursor = "not-allowed";
  });
}

function _proximoHorarioAbertura() {
  const horarios = CONFIG.funcionamento?.horarios || [];
  if (!horarios.length) return null;
  // Tenta encontrar o próximo horário de abertura hoje ou nos próximos dias
  const diasPT = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
  const agora = new Date();
  for (let d = 0; d < 7; d++) {
    const dia = new Date(agora);
    dia.setDate(dia.getDate() + d);
    const diaSem = dia.getDay();
    const diaAtual = diasPT[diaSem];
    for (const h of horarios) {
      const diaStr = (h.dia || "").toLowerCase();
      const cobre =
        diaStr.includes(diaAtual) ||
        (diaStr.includes("seg") && diaStr.includes("sex") && diaSem >= 1 && diaSem <= 5) ||
        (diaStr.includes("seg") && diaStr.includes("sáb") && diaSem >= 1 && diaSem <= 6) ||
        diaStr === "todos os dias" || diaStr === "todos";
      if (!cobre) continue;
      const match = (h.hora || "").match(/(\d{1,2}):(\d{2})/);
      if (!match) continue;
      if (d === 0) {
        const abMin = parseInt(match[1]) * 60 + parseInt(match[2]);
        const agoraMin = agora.getHours() * 60 + agora.getMinutes();
        if (abMin <= agoraMin) continue; // já passou
        return `às ${match[1]}:${match[2]}`;
      }
      return `${diaAtual === "segunda" ? "na segunda-feira" : `em ${diaAtual}`} às ${match[1]}:${match[2]}`;
    }
  }
  return null;
}

function renderizarCatalogo() {
  aplicarConfigUI();
  _verificarStatusLoja();
  renderizarCategorias();
  renderizarProdutos();
  CARRINHO.atualizarUI();
}

function aplicarConfigUI() {
  UTIL.aplicarCores();
  const nome = document.getElementById("loja-nome");
  const slogan = document.getElementById("loja-slogan");
  const logo = document.getElementById("loja-logo");
  if (nome) nome.textContent = CONFIG.loja.nome;
  if (slogan) slogan.textContent = CONFIG.loja.slogan;
  if (logo) {
    logo.innerHTML = "";
    if (CONFIG.loja.logoUrl) {
      const img = document.createElement("img");
      img.src = CONFIG.loja.logoUrl; img.alt = "Logo";
      logo.appendChild(img);
    } else {
      logo.textContent = CONFIG.loja.logo;
    }
  }
  document.title = CONFIG.loja.nome;
  const wppFloat = document.getElementById("wpp-float");
  if (wppFloat) wppFloat.href = `https://wa.me/${CONFIG.contato.whatsapp}`;
}

function renderizarCategorias() {
  const container = document.getElementById("categorias-filtro");
  if (!container) return;
  const cats = CATEGORIAS.ativas();
  const filtro = STATE.get("categoriaFiltro");
  container.innerHTML = `<button class="cat-btn ${filtro === 'todos' ? 'ativo' : ''}" onclick="filtrarCategoria('todos')">🛒 Todos</button>` +
    cats.map(c => `<button class="cat-btn ${filtro === c.id ? 'ativo' : ''}" onclick="filtrarCategoria('${c.id}')" style="--cat-cor:${c.cor || 'var(--primary)'}">
      ${c.emoji || ""} ${UTIL.sanitize(c.nome)}</button>`).join("");
}

function filtrarCategoria(id) {
  STATE.set("categoriaFiltro", id);
  renderizarCategorias();
  renderizarProdutos();
}
window.filtrarCategoria = filtrarCategoria;

function renderizarProdutos() {
  const container = document.getElementById("produtos-grid");
  if (!container) return;
  const lista = PRODUTOS.filtrar(STATE.get("buscaTermo"), STATE.get("categoriaFiltro")).filter(p => p.ativo);
  const cats = STATE.get("categoriaFiltro") === "todos"
    ? CATEGORIAS.ativas()
    : CATEGORIAS.ativas().filter(c => c.id === STATE.get("categoriaFiltro"));

  if (lista.length === 0) {
    container.innerHTML = `<div class="sem-produtos"><span>🔍</span><p>${ENUMS.MSGS.SEM_PRODUTOS}</p></div>`;
    return;
  }

  let html = "";
  if (STATE.get("categoriaFiltro") === "todos") {
    cats.forEach(cat => {
      const prods = lista.filter(p => p.categoria === cat.id);
      if (prods.length === 0) return;
      html += `<div class="secao-categoria">
        <div class="secao-cat-header" style="border-color:${cat.cor || 'var(--primary)'}">
          <span class="cat-emoji">${cat.emoji || ""}</span>
          <div><h2>${UTIL.sanitize(cat.nome)}</h2>${cat.frase ? `<p class="cat-frase">${UTIL.sanitize(cat.frase)}</p>` : ""}</div>
        </div>
        <div class="produtos-row">${prods.map(p => cardProduto(p)).join("")}</div>
      </div>`;
    });
    const semCat = lista.filter(p => !cats.find(c => c.id === p.categoria));
    if (semCat.length) html += `<div class="produtos-row">${semCat.map(p => cardProduto(p)).join("")}</div>`;
  } else {
    html += `<div class="produtos-row">${lista.map(p => cardProduto(p)).join("")}</div>`;
  }
  container.innerHTML = html;
}

function cardProduto(p) {
  // Calcular preço exibido: se tem tamanhos com preços, mostrar "a partir de"
  const tams = (p.tamanhos || []).filter(t => typeof t === "object" && t.volume);
  let precoLabel = "";
  if (tams.length > 0) {
    const menor = Math.min(...tams.map(t => t.preco || 0));
    precoLabel = `<span class="pc-preco"><small style="font-size:10px;font-weight:400;">a partir de</small><br>${UTIL.formatarMoeda(menor)}</span>`;
  } else {
    precoLabel = `<span class="pc-preco">${UTIL.formatarMoeda(p.preco)}</span>`;
  }
  return `<div class="produto-card" onclick="abrirModalProduto('${p.id}')">
    <div class="pc-img">${p.imagem
      ? `<img src="${UTIL.sanitize(p.imagem)}" alt="${UTIL.sanitize(p.nome)}" loading="lazy">`
      : `<span class="pc-emoji">${p.emoji || "🛍️"}</span>`}</div>
    <div class="pc-body">
      <h3>${UTIL.sanitize(p.nome)}</h3>
      ${p.descricao ? `<p>${UTIL.sanitize(p.descricao)}</p>` : ""}
      <div class="pc-footer">
        ${precoLabel}
        <button class="btn-add" onclick="event.stopPropagation();abrirModalProduto('${p.id}')">+</button>
      </div>
    </div>
  </div>`;
}

function buscarProdutos(termo) {
  STATE.set("buscaTermo", termo);
  renderizarProdutos();
}
window.buscarProdutos = buscarProdutos;

// ============================================================
// ADMIN — Funções de renderização
// ============================================================
function renderizarAdmin() {
  UTIL.aplicarCores();
  const el = document.getElementById("adm-loja-nome");
  if (el) el.textContent = CONFIG.loja.nome;
  document.title = `Admin — ${CONFIG.loja.nome}`;
  DASHBOARD.atualizar();
}

function renderizarAdmProdutos() {
  const container = document.getElementById("adm-produtos-lista");
  if (!container) return;

  // Mapa de categorias (id -> objeto categoria) para exibir nome/emoji/ordem
  const categorias = STATE.get("categorias") || [];
  const mapaCategorias = {};
  categorias.forEach(c => { mapaCategorias[c.id] = c; });

  // Termo de busca (por nome do produto ou nome da categoria) — tempo real, não altera dados
  const termoBusca = (document.getElementById("adm-produtos-busca")?.value || "").trim().toLowerCase();

  let lista = [...STATE.get("produtos")];

  if (termoBusca) {
    lista = lista.filter(p => {
      const nomeCategoria = (mapaCategorias[p.categoria]?.nome || "").toLowerCase();
      return p.nome.toLowerCase().includes(termoBusca) || nomeCategoria.includes(termoBusca);
    });
  }

  if (lista.length === 0) {
    container.innerHTML = termoBusca
      ? `<p class="sem-dados">Nenhum produto encontrado para "${UTIL.sanitize(termoBusca)}".</p>`
      : `<p class="sem-dados">Nenhum produto cadastrado.</p>`;
    return;
  }

  // Ranking global por vendas (mantém a numeração original, mesmo agrupando por categoria)
  const rankMap = new Map(
    [...lista].sort((a, b) => (b.vendas || 0) - (a.vendas || 0)).map((p, i) => [p.id, i + 1])
  );

  // Agrupa apenas para exibição visual — não altera os dados nem a lógica existente
  const grupos = {};
  lista.forEach(p => {
    const catId = p.categoria || "__sem_categoria__";
    if (!grupos[catId]) grupos[catId] = [];
    grupos[catId].push(p);
  });

  // Ordena os grupos pela "ordem" cadastrada da categoria; sem categoria fica por último
  const idsOrdenados = Object.keys(grupos).sort((a, b) => {
    if (a === "__sem_categoria__") return 1;
    if (b === "__sem_categoria__") return -1;
    return (mapaCategorias[a]?.ordem ?? 0) - (mapaCategorias[b]?.ordem ?? 0);
  });

  container.innerHTML = idsOrdenados.map(catId => {
    const cat = mapaCategorias[catId];
    const nomeCategoria = cat ? `${cat.emoji || "🏷️"} ${cat.nome}` : "🏷️ Sem categoria";
    const itens = [...grupos[catId]].sort((a, b) => (b.vendas || 0) - (a.vendas || 0));

    return `
      <div class="adm-grupo-categoria" style="margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin:12px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border);">
          ${UTIL.sanitize(nomeCategoria)} <span style="font-weight:400;">(${itens.length})</span>
        </div>
        ${itens.map(p => `
          <div class="adm-item ${p.ativo ? "" : "pausado"}">
            <div class="adm-item-img" style="position:relative;">
              ${p.imagem
                ? `<img src="${UTIL.sanitize(p.imagem)}" alt="">`
                : `<span>${p.emoji || "🛍️"}</span>`}
              <span style="position:absolute;top:-6px;left:-6px;background:var(--primary,#5B2D8E);color:#fff;border-radius:50%;width:22px;height:22px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${rankMap.get(p.id)}°</span>
            </div>
            <div class="adm-item-info">
              <strong>${UTIL.sanitize(p.nome)}</strong>
              <small>${UTIL.formatarMoeda(p.preco)} / ${p.unidade || "un"} | Estoque: ${p.estoque ?? "∞"} | Vendas: ${p.vendas || 0}</small>
              <small>${UTIL.sanitize(nomeCategoria)}</small>
              ${(p.tamanhos && p.tamanhos.length) ? `<small>Tamanhos: ${p.tamanhos.map(t => typeof t === "object" ? t.volume + " — " + UTIL.formatarMoeda(t.preco) : t).join(" | ")}</small>` : ""}
              ${!p.ativo ? `<span class="badge-warning">Pausado</span>` : ""}
            </div>
            <div class="adm-item-acoes">
              <button class="btn-icon" onclick="editarProduto('${p.id}')" title="Editar">✏️</button>
              <button class="btn-icon" onclick="pausarProduto('${p.id}')" title="${p.ativo ? 'Pausar' : 'Reativar'}">${p.ativo ? "⏸" : "▶️"}</button>
              <button class="btn-icon btn-icon-del" onclick="excluirProduto('${p.id}')" title="Excluir">🗑️</button>

            </div>
          </div>`).join("")}
      </div>`;
  }).join("");
}
window.renderizarAdmProdutos = renderizarAdmProdutos;

function pausarProduto(id) {
  PRODUTOS.pausar(id);
  renderizarAdmProdutos();
  MODAL.toast("Status do produto atualizado.");
}
window.pausarProduto = pausarProduto;

function excluirProduto(id) {
  MODAL.pedirSenha("Excluir Produto", () => {
    MODAL.confirmar(ENUMS.MSGS.CONFIRMAR_EXCLUSAO, () => {
      PRODUTOS.excluir(id);
      renderizarAdmProdutos();
      MODAL.toast(ENUMS.MSGS.PRODUTO_EXCLUIDO, "sucesso");
    });
  });
}
window.excluirProduto = excluirProduto;

// Variável temporária para guardar o produto em edição durante a troca de aba
let _produtoEmEdicao = null;

function editarProduto(id) {
  const p = STATE.get("produtos").find(x => x.id === id);
  if (!p) return;

  // Guarda o produto para que o tabchange possa reaplicar os acompanhamentos
  _produtoEmEdicao = p;

  // Navega para a aba de edição (isso dispara tabchange → popularComplementosProd)
  TABS.ir("sec-produtos", "tab-novo-produto");

  // Preenche o formulário DEPOIS da troca de aba, garantindo que os selects
  // de categoria e os checkboxes de acompanhamentos já existam no DOM
  setTimeout(() => {
    preencherFormProduto(p);
    document.getElementById("form-produto-titulo").textContent = "Editar Produto";
    document.getElementById("form-produto-id").value = id;
    _produtoEmEdicao = null;
  }, 80);
}
window.editarProduto = editarProduto;

// Controle de estoque — tab dentro de categorias
function renderizarControleEstoque() {
  const container = document.getElementById("tab-controle-estoque");
  if (!container) return;
  const lista = STATE.get("produtos");
  const estoquesBases = STATE.get("estoquesBases") || [];

  if (lista.length === 0) {
    container.innerHTML = `<p class="sem-dados">Nenhum produto cadastrado.</p>`;
    return;
  }
  container.innerHTML = `
    <div class="form-card">
      <div class="form-card-titulo">📦 Controle de Estoque</div>
      <div id="estoque-lista">
        ${lista.map(p => {
          // Produto com Estoque-Base: mostra dados do base vinculado
          if (p.usaEstoqueBase && p.estoqueBaseId) {
            const base = estoquesBases.find(e => e.id === p.estoqueBaseId);
            const qtdBase   = base ? base.quantidade.toFixed(3) : "?";
            const unBase    = base ? base.unidade : "";
            const nomeBase  = base ? base.nome : "Base não encontrado";
            const alertaBaixo = base && base.quantidade <= 1
              ? `<span class="badge-danger">⚠️ Estoque Baixo</span>` : "";
            return `
              <div class="adm-item">
                <div class="adm-item-img">${p.imagem ? `<img src="${UTIL.sanitize(p.imagem)}" alt="">` : `<span>${p.emoji || "🛍️"}</span>`}</div>
                <div class="adm-item-info">
                  <strong>${UTIL.sanitize(p.nome)}</strong>
                  <small>⚖️ Estoque-Base: <strong>${nomeBase}</strong> — <strong>${qtdBase} ${unBase}</strong> disponível | Vendas: ${p.vendas || 0}</small>
                  <small style="color:var(--text-muted)">Desconta do Estoque-Base conforme o tamanho selecionado na venda (ex: 400ml, 700ml, 1L)</small>
                  ${alertaBaixo}
                </div>
                <div class="adm-item-acoes" style="align-items:center;gap:8px;">
                  <span style="font-size:12px;color:var(--text-muted);">Gerenciar em ⚖️ Estoque-Base</span>
                </div>
              </div>`;
          }
          // Produto por unidade: comportamento original inalterado
          const alertaBaixo = (p.estoque !== undefined && p.estoque !== "" && Number(p.estoque) <= 5)
            ? `<span class="badge-danger">⚠️ Estoque Baixo</span>` : "";
          return `
            <div class="adm-item">
              <div class="adm-item-img">${p.imagem ? `<img src="${UTIL.sanitize(p.imagem)}" alt="">` : `<span>${p.emoji || "🛍️"}</span>`}</div>
              <div class="adm-item-info">
                <strong>${UTIL.sanitize(p.nome)}</strong>
                <small>Estoque atual: <strong>${p.estoque ?? "∞"}</strong> ${p.unidade || "un"} | Vendas: ${p.vendas || 0}</small>
                ${alertaBaixo}
              </div>
              <div class="adm-item-acoes" style="align-items:center; gap:8px;">
                <input type="number" min="0" value="${p.estoque ?? ""}" placeholder="∞"
                  style="width:80px; text-align:center;"
                  onchange="atualizarEstoque('${p.id}', this.value)">
                <span style="font-size:12px; color:var(--text-muted)">${p.unidade || "un"}</span>
              </div>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}
window.renderizarControleEstoque = renderizarControleEstoque;

function atualizarEstoque(id, valor) {
  // Protege qualquer alteração manual de estoque com a senha master (empresaConfig.js)
  MODAL.pedirSenha("Alterar Estoque", () => {
    PRODUTOS.editar(id, { estoque: valor === "" ? "" : parseInt(valor) });
    MODAL.toast("Estoque atualizado!");
    DASHBOARD.atualizar();
  }, () => {
    // Cancelado ou senha incorreta: reverte o valor exibido no campo
    renderizarControleEstoque();
  });
}
window.atualizarEstoque = atualizarEstoque;

// ADMIN — Categorias
function renderizarAdmCategorias() {
  const container = document.getElementById("adm-categorias-lista");
  if (!container) return;
  const lista = STATE.get("categorias");
  if (lista.length === 0) {
    container.innerHTML = `<p class="sem-dados">Nenhuma categoria cadastrada.</p>`;
    return;
  }
  container.innerHTML = lista.map(c => `
    <div class="adm-item ${c.ativo ? "" : "pausado"}" draggable="true" data-id="${c.id}">
      <span class="drag-handle">⠿</span>
      <div class="adm-item-info">
        <strong>${c.emoji || ""} ${UTIL.sanitize(c.nome)}</strong>
        ${c.frase ? `<small class="cat-frase-adm">${UTIL.sanitize(c.frase)}</small>` : ""}
        ${!c.ativo ? `<span class="badge-warning">Pausada</span>` : ""}
      </div>
      <div class="adm-item-acoes">
        <button class="btn-icon" onclick="editarCategoria('${c.id}')">✏️</button>
        <button class="btn-icon" onclick="pausarCategoria('${c.id}')">${c.ativo ? "⏸" : "▶️"}</button>
        <button class="btn-icon btn-icon-del" onclick="excluirCategoria('${c.id}')">🗑️</button>
      </div>
    </div>`).join("");
  iniciarDragDrop();
}
window.renderizarAdmCategorias = renderizarAdmCategorias;

function pausarCategoria(id) {
  CATEGORIAS.pausar(id);
  renderizarAdmCategorias();
  MODAL.toast("Categoria atualizada.");
}
window.pausarCategoria = pausarCategoria;

function excluirCategoria(id) {
  MODAL.pedirSenha("Excluir Categoria", () => {
    MODAL.confirmar(ENUMS.MSGS.CONFIRMAR_EXCLUSAO, () => {
      CATEGORIAS.excluir(id);
      renderizarAdmCategorias();
      MODAL.toast("Categoria excluída!");
    });
  });
}
window.excluirCategoria = excluirCategoria;

function editarCategoria(id) {
  const c = STATE.get("categorias").find(x => x.id === id);
  if (!c) return;
  document.getElementById("cat-id").value = id;
  document.getElementById("cat-nome").value = c.nome;
  document.getElementById("cat-emoji").value = c.emoji || "";
  document.getElementById("cat-cor").value = c.cor || "#7B2FBE";
  document.getElementById("cat-frase").value = c.frase || "";
  document.getElementById("form-cat-titulo").textContent = "Editar Categoria";
  TABS.ir("sec-categorias", "tab-nova-categoria");
}
window.editarCategoria = editarCategoria;

// ADMIN — Complementos
function renderizarAdmComplementos() {
  const container = document.getElementById("adm-complementos-lista");
  if (!container) return;
  const lista = STATE.get("complementos");
  if (lista.length === 0) {
    container.innerHTML = `<p class="sem-dados">Nenhum complemento cadastrado.</p>`;
    return;
  }
  const estoquesBases = STATE.get("estoquesBases") || [];
  container.innerHTML = lista.map(c => {
    // Linha de estoque: mostra estoque simples ou estoque-base vinculado
    let estoqueInfo = "";
    if (c.usaEstoqueBase && c.estoqueBaseId) {
      const eb = estoquesBases.find(e => e.id === c.estoqueBaseId);
      const dispQtd = eb ? eb.quantidade.toFixed(3) + " " + eb.unidade : "—";
      const dispNome = eb ? eb.nome : c.estoqueBaseId;
      estoqueInfo = `Estoque-Base: <strong>${dispNome}</strong> — Disponível: <strong>${dispQtd}</strong> | Consome: ${c.consumoQtd || 0}${c.consumoUnidade || "g"} por pedido`;
    } else {
      estoqueInfo = `Estoque: ${c.estoque !== "" && c.estoque !== undefined && c.estoque !== null ? c.estoque : "∞"}`;
    }
    return `
    <div class="adm-item ${c.ativo ? "" : "pausado"}">
      <div class="adm-item-info">
        <strong>${UTIL.sanitize(c.nome)}</strong>
        <small>+ ${UTIL.formatarMoeda(c.preco || 0)} | ${estoqueInfo}</small>
        ${!c.ativo ? `<span class="badge-warning">Pausado</span>` : ""}
      </div>
      <div class="adm-item-acoes">
        <button class="btn-icon" onclick="editarComplemento('${c.id}')">✏️</button>
        <button class="btn-icon" onclick="pausarComplemento('${c.id}')">${c.ativo ? "⏸" : "▶️"}</button>
        <button class="btn-icon btn-icon-del" onclick="excluirComplemento('${c.id}')">🗑️</button>
      </div>
    </div>`;
  }).join("");
}
window.renderizarAdmComplementos = renderizarAdmComplementos;

function pausarComplemento(id) {
  COMPLEMENTOS.pausar(id);
  renderizarAdmComplementos();
  MODAL.toast("Complemento atualizado.");
}
window.pausarComplemento = pausarComplemento;

function excluirComplemento(id) {
  MODAL.pedirSenha("Excluir Complemento", () => {
    MODAL.confirmar(ENUMS.MSGS.CONFIRMAR_EXCLUSAO, () => {
      COMPLEMENTOS.excluir(id);
      renderizarAdmComplementos();
      MODAL.toast("Complemento excluído!");
    });
  });
}
window.excluirComplemento = excluirComplemento;

function editarComplemento(id) {
  const c = STATE.get("complementos").find(x => x.id === id);
  if (!c) return;
  document.getElementById("comp-id").value = id;
  document.getElementById("comp-nome").value = c.nome;
  document.getElementById("comp-preco").value = c.preco || 0;
  document.getElementById("comp-estoque").value = c.estoque ?? "";
  // Campos de estoque-base
  const cbBase = document.getElementById("comp-usa-estoque-base");
  if (cbBase) {
    cbBase.checked = c.usaEstoqueBase || false;
    toggleCompEstoqueBase(c.usaEstoqueBase || false);
    if (c.usaEstoqueBase) {
      document.getElementById("comp-estoque-base-id").value = c.estoqueBaseId || "";
      document.getElementById("comp-consumo-qtd").value = c.consumoQtd || "";
      document.getElementById("comp-consumo-unidade").value = c.consumoUnidade || "g";
    }
  }
  document.getElementById("form-comp-titulo").textContent = "Editar Acompanhamento";
  mostrarSecao("sec-categorias");
  TABS.ir("sec-categorias", "tab-novo-complemento");
}
window.editarComplemento = editarComplemento;

// ADMIN — Pedidos
// ── Card de um pedido — reaproveitado em "Pedidos Recebidos" e no
// novo "Histórico de Vendas" (historicoVendas.js), sem duplicar HTML.
function cardPedido(p, somenteLeitura = false) {
  const corBadge = p.status === "cancelado" ? "danger"
    : p.status === "entregue" || p.status === "pago" ? "success"
    : "warning";

  const btnPago = (!somenteLeitura && p.status !== "pago" && p.status !== "entregue" && p.status !== "cancelado")
    ? `<button class="btn btn-outline btn-sm" style="color:#4caf50;border-color:#4caf50;font-size:11px;"
         title="Marcar como pago"
         onclick="marcarPedidoPago('${p.id}')">✅ Pago</button>`
    : "";

  // Selo informativo (sem função/clique) — aparece só no Histórico, quando o
  // pedido foi excluído em "Pedidos Recebidos". A informação nunca é apagada.
  const badgeExcluido = p.excluido
    ? `<span class="badge-danger" title="Excluído de 'Pedidos Recebidos' em ${UTIL.formatarData(p.dataExclusao)}">🗑️ Pedido Excluído</span>`
    : "";

  // No Histórico (somenteLeitura) não existe nenhum botão de ação — é uma
  // trilha de auditoria, apenas para consulta, para evitar fraude.
  const botoesAcao = somenteLeitura ? "" : `
        ${btnPago}
        <button class="btn-icon" title="Adicionar produto ao pedido"
          onclick="abrirAdicionarProdutoPedido('${p.id}')" style="background:rgba(91,45,142,.2);color:var(--primary,#5B2D8E);">➕</button>
        <button class="btn-icon" title="Imprimir comprovante"
          onclick="imprimirPedido('${p.id}')" style="background:rgba(91,45,142,.12);">🖨️</button>
        <button class="btn-icon btn-icon-del" title="Excluir pedido e estornar estoque"
          onclick="confirmarExcluirPedido('${p.id}')">🗑️</button>`;

  return `
  <div class="pedido-card">
    <div class="pedido-header">
      <div>
        <strong>${UTIL.sanitize(p.cliente?.nome || "—")}</strong>
        <small style="color:var(--primary,#5B2D8E);font-weight:700;display:block;">
          Pedido #${p.numeroPedido != null ? String(p.numeroPedido).padStart(3, "0") : "—"}
        </small>
        ${p.cliente?.telefone ? `<small style="color:var(--text-muted); display:block;"> ${UTIL.sanitize(p.cliente.telefone)}</small>` : ""}
        <small style="color:var(--text-muted); display:block;">${UTIL.formatarData(p.data)}</small>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span class="badge-${corBadge}">${p.status}</span>
        ${p.origem === "manual" ? `<span class="badge-primary" title="Venda registrada pelo administrador (balcão)">🧑‍💼 Presencial</span>` : ""}
        ${badgeExcluido}${botoesAcao}
      </div>
    </div>
    <div class="pedido-itens">
      ${(p.itens || []).map(i =>
        `<small>• ${i.quantidade}x ${UTIL.sanitize(i.nome)}${i.tamanho ? ` (${i.tamanho})` : ""} — <strong>${UTIL.formatarMoeda(i.preco)}</strong> un.</small>`
      ).join("")}
    </div>
    <div class="pedido-footer">
      <span>${p.tipoEntrega === "entrega" ? " Entrega" : " Retirada"} | ${p.formaPagamento || "—"}</span>
      <strong>${UTIL.formatarMoeda(p.total)}</strong>
    </div>
    ${p.tipoEntrega === "entrega"
      ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Taxa de entrega: <strong>${p.taxaEntrega ? UTIL.formatarMoeda(p.taxaEntrega) : "Grátis"}</strong></div>`
      : ""}
    ${p.tipoEntrega === "entrega" && p.endereco
      ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;"> ${UTIL.sanitize(p.endereco)}</div>`
      : ""}
  </div>`;
}

function renderizarAdmPedidos() {
  const activeContainer = document.getElementById("pedidos-recebidos-lista");
  const pedidos = [...STATE.get("pedidos")]
    .filter(p => !p.excluido) // pedidos excluídos somem daqui, mas continuam no Histórico
    .sort((a, b) => {
      const da = new Date(a.data || a.createdAt || 0).getTime();
      const db = new Date(b.data || b.createdAt || 0).getTime();
      return db - da; // mais recente primeiro
    });

  if (activeContainer) {
    activeContainer.innerHTML = pedidos.length
      ? pedidos.map(p => cardPedido(p)).join("")
      : `<p class="sem-dados">Nenhum pedido recebido.</p>`;
  }

  // Mantém a aba "Histórico de Vendas" sincronizada quando estiver visível
  if (typeof HISTORICO !== "undefined" && document.getElementById("tab-historico-vendas")?.classList.contains("ativo")) {
    HISTORICO.renderizar();
  }
}

// ============================================================
// COMPROVANTE DE IMPRESSÃO — Pedido individual
// Segue o mesmo layout/dados exibidos no card de "Pedidos Recebidos".
// Otimizado para impressoras térmicas (58mm/80mm) e compatível com A4:
// as linhas separadoras usam borda CSS (não caracteres fixos), então
// sempre preenchem a largura correta do papel, seja qual for o tamanho.
// ============================================================
function _formatarDataComprovante(d) {
  const data = new Date(d);
  const dataStr = data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const horaStr = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dataStr} às ${horaStr}`;
}

function _gerarComprovanteHTML(p) {
  const nomeLoja   = UTIL.sanitize(CONFIG.loja.nome || "Loja");
  const codigo     = (p.id || "").slice(-5).toUpperCase();
  const clienteNome= UTIL.sanitize(p.cliente?.nome || "Cliente");
  const dataTexto  = _formatarDataComprovante(p.data);
  const tipoTexto  = p.tipoEntrega === "entrega" ? "🚚 Entrega" : "📦 Retirada";
  const pagamento  = UTIL.sanitize(p.formaPagamento || "—");

  const itensHTML = (p.itens || []).map(i => {
    const complementosHTML = (i.complementos && i.complementos.length)
      ? i.complementos.map(c => `<div class="comp-item-extra">+ ${UTIL.sanitize(c.nome)}</div>`).join("")
      : "";
    const obsHTML = i.observacao
      ? `<div class="comp-item-obs">Obs: ${UTIL.sanitize(i.observacao)}</div>`
      : "";
    return `<div class="comp-item">${i.quantidade}x ${UTIL.sanitize(i.nome)}${i.tamanho ? " (" + UTIL.sanitize(i.tamanho) + ")" : ""}</div>${complementosHTML}${obsHTML}`;
  }).join("");

  const taxaHTML = (p.taxaEntrega && p.taxaEntrega > 0)
    ? `<div class="comp-linha-info">Taxa de Entrega: ${UTIL.formatarMoeda(p.taxaEntrega)}</div>`
    : "";

  const enderecoBlocoHTML = p.tipoEntrega === "entrega"
    ? `<div class="comp-linha-info">Endereço</div><div class="comp-linha-info">${UTIL.sanitize(p.endereco || "—")}</div>`
    : `<div class="comp-linha-info">📦 Retirada no Local.</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Comprovante #${codigo}</title>
<style>
  @page { margin: 4mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: 'Courier New', Courier, monospace; display: flex; justify-content: center; }
  .comprovante {
    width: 100%;
    max-width: 320px;   /* cabe em 58mm e 80mm; em A4 fica centralizado sem esticar */
    padding: 10px 8px;
    font-size: 12px;
    line-height: 1.5;
  }
  .comp-linha-dupla { border-top: 2px solid #000; margin: 6px 0; }
  .comp-linha { border-top: 1px dashed #000; margin: 8px 0; }
  .comp-nome-loja { text-align: center; font-weight: 700; font-size: 14px; text-transform: uppercase; padding: 4px 0; word-break: break-word; }
  .comp-linha-info { margin: 3px 0; }
  .comp-item { margin-top: 6px; }
  .comp-item-extra, .comp-item-obs { padding-left: 14px; font-size: 11px; color: #333; }
  .comp-total { font-weight: 700; font-size: 13px; margin-top: 4px; }
  .comp-rodape { text-align: center; margin: 8px 0 2px; }
  @media print { .comp-linha-dupla, .comp-linha { border-color: #000 !important; } }
</style>
</head>
<body>
  <div class="comprovante">
    <div class="comp-linha-dupla"></div>
    <div class="comp-nome-loja">${nomeLoja}</div>
    <div class="comp-linha-dupla"></div>

    <div class="comp-linha-info">Pedido #${codigo}</div>
    <div class="comp-linha-info">Cliente: ${clienteNome}</div>
    <div class="comp-linha-info">${dataTexto}</div>

    <div class="comp-linha"></div>
    ${itensHTML}
    <div class="comp-linha"></div>

    <div class="comp-linha-info">Tipo: ${tipoTexto}</div>
    <div class="comp-linha-info">Pagamento: ${pagamento}</div>
    ${taxaHTML}
    <div class="comp-linha-info comp-total">Total: ${UTIL.formatarMoeda(p.total)}</div>
    <div class="comp-linha"></div>

    ${enderecoBlocoHTML}
    <div class="comp-linha"></div>

    <div class="comp-rodape">Obrigado pela preferência!</div>
    <div class="comp-linha-dupla"></div>
  </div>
  <script>
    window.onload = function () { window.focus(); window.print(); };
  </script>
</body></html>`;
}

// Imprime apenas o pedido correspondente — abre uma janela isolada com o
// comprovante e aciona a caixa de diálogo de impressão do navegador.
function imprimirPedido(id) {
  const pedidos = STATE.get("pedidos") || [];
  const p = pedidos.find(x => x.id === id);
  if (!p) { MODAL.erro("Pedido não encontrado para impressão."); return; }
  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) { MODAL.erro("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups do navegador."); return; }
  win.document.open();
  win.document.write(_gerarComprovanteHTML(p));
  win.document.close();
}
window.imprimirPedido = imprimirPedido;

function confirmarExcluirPedido(id) {
  MODAL.pedirSenha("Excluir Pedido", () => {
    MODAL.confirmar("Excluir este pedido? O estoque será revertido automaticamente e o faturamento será atualizado.", async () => {
      try {
        const pedidoExcluido = await API_PEDIDOS.excluir(id);
        // Não remove o pedido do estado: apenas atualiza (excluido:true), pois
        // o registro deve continuar existindo no "Histórico de Vendas" como
        // trilha de auditoria. Ele só some da lista de "Pedidos Recebidos"
        // (renderizarAdmPedidos já filtra os que têm excluido:true).
        STATE.update("pedidos", lista => lista.map(p => p.id === id ? { ...p, ...pedidoExcluido } : p));
        // Recarrega produtos para refletir estorno de estoque e vendas
        const [produtosAtualizados, estoquesBases] = await Promise.all([
          API_PRODUTOS.listar(),
          API_ESTOQUE_BASE.listar(),
        ]);
        STATE.set("produtos", produtosAtualizados || []);
        STATE.set("estoquesBases", estoquesBases || []);
        renderizarAdmPedidos();
        renderizarAdmProdutos();
        renderizarControleEstoque();
        DASHBOARD.atualizar();
        MODAL.toast(ENUMS.MSGS.PEDIDO_EXCLUIDO, "sucesso");
      } catch(e) {
        MODAL.erro("Erro ao excluir pedido: " + e.message);
      }
    });
  });
}
window.confirmarExcluirPedido = confirmarExcluirPedido;

// ── Marca pedido como Pago ────────────────────────────────────
// Altera o status do pedido para "pago" sem excluir nem estornar estoque
async function marcarPedidoPago(id) {
  try {
    // Atualiza no MongoDB via API
    const pedidoAtualizado = await API_PEDIDOS.atualizarStatus(id, "pago");
    // Atualiza no estado local
    STATE.update("pedidos", lista =>
      lista.map(p => p.id === id ? { ...p, status: "pago" } : p)
    );
    renderizarAdmPedidos();
    DASHBOARD.atualizar();
    MODAL.toast("Pedido marcado como pago! ✅");
  } catch(e) {
    MODAL.erro("Erro ao atualizar pedido: " + e.message);
  }
}
window.marcarPedidoPago = marcarPedidoPago;

// ── Editar Pedido ─────────────────────────────────────────────
// Abre modal completo com edição de produtos, quantidades e status

// Salva edição completa do pedido no MongoDB e sincroniza todo o sistema

// ============================================================
// ADICIONAR PRODUTO AO PEDIDO — usa exatamente o mesmo catálogo e modal da loja
// ============================================================
function abrirAdicionarProdutoPedido(pedidoId) {
  const p = STATE.get("pedidos").find(x => x.id === pedidoId);
  if (!p) return;
  window._editandoPedidoId = pedidoId;
  window._editandoItens = (p.itens || []).map(i => ({ ...i }));

  // Abre catálogo com os cards IDÊNTICOS aos da loja
  const prods = STATE.get("produtos").filter(x => x.ativo);
  const cats  = STATE.get("categorias").filter(x => x.ativo);

  // Monta HTML dos cards igual à loja (mesmas classes produto-card, pc-img, pc-body)
  function cardsHtml(lista) {
    if (!lista.length) return '<p style="color:#aaa;padding:16px;">Nenhum produto disponível.</p>';
    return `<div style="display:contents;">${lista.map(p => `
      <div class="produto-card" onclick="window._pedAbrirProduto('${pedidoId}','${p.id}')" style="font-size:11px;">
        <div class="pc-img" style="aspect-ratio:1/1;">${p.imagem
          ? `<img src="${UTIL.sanitize(p.imagem)}" alt="${UTIL.sanitize(p.nome)}" loading="lazy">`
          : `<span class="pc-emoji" style="font-size:28px;">${p.emoji || "🛍️"}</span>`}
        </div>
        <div class="pc-body" style="padding:6px 8px;">
          <h3 style="font-size:11px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${UTIL.sanitize(p.nome)}</h3>
          <div class="pc-footer">
            <span class="pc-preco" style="font-size:11px;">${UTIL.formatarMoeda(p.preco)}</span>
            <button class="btn-add" style="width:22px;height:22px;font-size:14px;" onclick="event.stopPropagation();window._pedAbrirProduto('${pedidoId}','${p.id}')">+</button>
          </div>
        </div>
      </div>`).join("")}</div>`;
  }

  // Remove overlay anterior se existir
  document.getElementById("ped-loja-overlay")?.remove();
  const ov = document.createElement("div");
  ov.id = "ped-loja-overlay";
  ov.className = "modal-overlay active";
  ov.style.cssText = "z-index:9999;";
  ov.innerHTML = `
    <div class="modal-box" style="max-width:700px;width:96%;max-height:90vh;overflow-y:auto;padding:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <h3 style="margin:0;">🛍️ Adicionar ao Pedido</h3>
        <button onclick="document.getElementById('ped-loja-overlay').remove()"
          style="background:none;border:none;color:#aaa;font-size:22px;cursor:pointer;line-height:1;">✕</button>
      </div>
      <input type="text" id="ped-loja-busca" placeholder="Buscar produto..."
        class="input-busca"
        style="width:100%;padding:8px 12px;border-radius:8px;background:var(--bg,#0F0A1A);border:1px solid #444;color:inherit;font-size:13px;margin-bottom:14px;box-sizing:border-box;"
        oninput="(function(){
          const t = document.getElementById('ped-loja-busca').value.toLowerCase();
          const f = STATE.get('produtos').filter(x => x.ativo && x.nome.toLowerCase().includes(t));
          document.getElementById('ped-loja-grid').innerHTML = window._pedCardsHtml('${pedidoId}', f);
        })()">
      <div id="ped-loja-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">${cardsHtml(prods)}</div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });

  // Expor para o oninput
  window._pedCardsHtml = (pedidoId, lista) => cardsHtml(lista);
}
window.abrirAdicionarProdutoPedido = abrirAdicionarProdutoPedido;

// Ao clicar no card: abre EXATAMENTE abrirModalProduto da loja, só troca o botão final
window._pedAbrirProduto = function(pedidoId, produtoId) {
  document.getElementById("ped-loja-overlay")?.remove();
  const produto = STATE.get("produtos").find(p => p.id === produtoId);
  if (!produto) return;
  const complementosDisponiveis = produto.temComplementos
    ? COMPLEMENTOS.ativos().filter(c =>
        !produto.complementosVinculados || produto.complementosVinculados.length === 0
          ? true
          : produto.complementosVinculados.includes(c.id)
      )
    : [];
  const tamanhos = produto.tamanhos || [];

  // Usa o mesmo overlay e classes do abrirModalProduto da loja
  document.getElementById("produto-modal-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "produto-modal-overlay";
  overlay.className = "modal-overlay active";
  overlay.style.cssText = "z-index:9999;";
  overlay.innerHTML = `
    <div class="produto-modal">
      <button class="produto-modal-close" onclick="document.getElementById('produto-modal-overlay').remove();abrirAdicionarProdutoPedido('${pedidoId}')">← Voltar</button>
      ${produto.imagem
        ? `<div class="pm-img"><img src="${UTIL.sanitize(produto.imagem)}" alt="${UTIL.sanitize(produto.nome)}"></div>`
        : `<div class="pm-img" style="display:flex;align-items:center;justify-content:center;"><span style="font-size:64px">${produto.emoji || "🛍️"}</span></div>`}
      <div class="pm-body">
        <h2>${UTIL.sanitize(produto.nome)}</h2>
        <p class="pm-desc">${UTIL.sanitize(produto.descricao || "")}</p>
        <div class="pm-preco" id="pm-preco-display">${UTIL.formatarMoeda(produto.preco)}</div>
        ${tamanhos.length
          ? `<div class="pm-secao"><label>Tamanho:</label><div class="pm-tamanhos">
              ${tamanhos.map(t => { const vol = typeof t === "object" ? t.volume : t; const pr = typeof t === "object" ? t.preco : produto.preco; return `<label class="tag-radio"><input type="radio" name="pm-tamanho" value="${vol}" data-preco="${pr}" onchange="pmAtualizarPreco(this)"><span>${vol} — ${UTIL.formatarMoeda(pr)}</span></label>`; }).join("")}
             </div></div>`
          : ""}
        ${complementosDisponiveis.length
          ? `<div class="pm-secao"><label>Complementos:</label><div class="pm-complementos">
              ${complementosDisponiveis.map(c => `<label class="tag-check"><input type="checkbox" name="pm-comp" value="${c.id}" data-nome="${c.nome}" data-preco="${c.preco || 0}"><span>${c.nome}${c.preco ? " (+" + UTIL.formatarMoeda(c.preco) + ")" : ""}</span></label>`).join("")}
             </div></div>`
          : ""}
        <div class="pm-secao"><label>Observação:</label><textarea id="pm-obs" placeholder="Ex: sem açúcar..." rows="2"></textarea></div>
        <div class="pm-qtd-row">
          <div class="pm-qtd">
            <button onclick="pmQtd(-1)">−</button>
            <span id="pm-qtd-val">1</span>
            <button onclick="pmQtd(1)">+</button>
          </div>
          <button class="btn btn-primary pm-add"
            onclick="window._pedConfirmarProduto('${pedidoId}','${produtoId}')">
            ➕ Adicionar ao Pedido
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) { overlay.remove(); abrirAdicionarProdutoPedido(pedidoId); } });
};

// Confirmar: mesma lógica do pmAdicionarCarrinho, salva no pedido e sincroniza tudo
window._pedConfirmarProduto = function(pedidoId, produtoId) {
  const produto = STATE.get("produtos").find(p => p.id === produtoId);
  if (!produto) return;

  const qtd     = parseInt(document.getElementById("pm-qtd-val")?.textContent) || 1;
  const tamanho = document.querySelector('input[name="pm-tamanho"]:checked')?.value || "";
  const comps   = [...document.querySelectorAll('input[name="pm-comp"]:checked')]
    .map(el => ({ id: el.value, nome: el.dataset.nome, preco: parseFloat(el.dataset.preco) || 0 }));
  const obs     = document.getElementById("pm-obs")?.value || "";
  const unidade = tamanho || produto.unidade || "un";
  const precoComComps = produto.preco + comps.reduce((s, c) => s + (c.preco || 0), 0);

  const existente = window._editandoItens.find(i =>
    i.produtoId === produtoId &&
    (i.tamanho || "") === tamanho &&
    (i.complementos || []).map(c => c.id).sort().join(",") === comps.map(c => c.id).sort().join(",")
  );

  if (existente) {
    existente.quantidade += qtd;
  } else {
    window._editandoItens.push({
      id: UTIL.id(),
      produtoId: produto.id,
      nome: produto.nome,
      preco: precoComComps,
      quantidade: qtd,
      unidade: unidade,
      imagem: produto.imagem || "",
      tamanho: tamanho,
      complementos: comps,
      observacao: obs,
    });
  }

  document.getElementById("produto-modal-overlay")?.remove();

  // Salva direto no backend — reutiliza salvarEdicaoPedido que sincroniza estoque, faturamento, dashboard
  salvarEdicaoPedido(pedidoId);
};

async function salvarEdicaoPedido(id) {
  const status         = document.getElementById("edit-ped-status")?.value;
  const formaPagamento = document.getElementById("edit-ped-pagamento")?.value;
  const endereco       = document.getElementById("edit-ped-endereco")?.value;
  const itens          = window._editandoItens || [];

  const p = STATE.get("pedidos").find(x => x.id === id);
  const taxa = p?.taxaEntrega || 0;
  const subtotal = itens.reduce((s, i) => s + (i.preco * i.quantidade), 0);
  const total = subtotal + taxa;

  try {
    const pedidoAtualizado = await API_PEDIDOS.editar(id, {
      itens, total, subtotal, taxaEntrega: taxa, status, formaPagamento, endereco,
    });

    // Atualiza estado local com todos os dados retornados do backend
    STATE.update("pedidos", lista =>
      lista.map(p => p.id === id ? { ...p, ...pedidoAtualizado, itens, total, subtotal, status, formaPagamento, endereco } : p)
    );

    // Recarrega produtos do backend para refletir novos estoques e vendas
    const [produtosAtualizados, estoquesBases] = await Promise.all([
      API_PRODUTOS.listar(),
      API_ESTOQUE_BASE.listar(),
    ]);
    STATE.set("produtos", produtosAtualizados || []);
    STATE.set("estoquesBases", estoquesBases || []);

    MODAL.fechar();
    renderizarAdmPedidos();
    renderizarAdmProdutos();
    renderizarControleEstoque();
    DASHBOARD.atualizar();
    MODAL.toast("Pedido atualizado com sucesso! ✅");
  } catch(e) {
    MODAL.erro("Erro ao salvar: " + e.message);
  }
}
window.salvarEdicaoPedido = salvarEdicaoPedido;

// Drag and drop categorias
function iniciarDragDrop() {
  const lista = document.getElementById("adm-categorias-lista");
  if (!lista) return;
  let dragEl = null;
  lista.querySelectorAll("[draggable]").forEach(el => {
    el.addEventListener("dragstart", () => { dragEl = el; el.style.opacity = "0.5"; });
    el.addEventListener("dragend", () => {
      el.style.opacity = "";
      dragEl = null;
      salvarOrdemCategorias();
    });
    el.addEventListener("dragover", e => {
      e.preventDefault();
      if (dragEl && el !== dragEl) {
        const r = el.getBoundingClientRect();
        e.clientY < r.top + r.height / 2 ? lista.insertBefore(dragEl, el) : el.after(dragEl);
      }
    });
  });
}

function salvarOrdemCategorias() {
  const ids = [...document.querySelectorAll("#adm-categorias-lista [data-id]")].map(el => el.dataset.id);
  CATEGORIAS.reordenar(ids);
}

// ADMIN — Navegação por seções
function mostrarSecao(id) {
  document.querySelectorAll(".adm-secao").forEach(s => s.classList.remove("ativo"));
  document.getElementById(id)?.classList.add("ativo");
  document.querySelectorAll(".adm-nav-btn").forEach(b => b.classList.remove("ativo"));
  document.querySelector(`[data-sec="${id}"]`)?.classList.add("ativo");

  // Atualizar título topbar
  const tituloMap = {
    "sec-dashboard": "📊 Dashboard",
    "sec-produtos": "📦 Produtos",
    "sec-categorias": "🏷️ Categorias",
    "sec-complementos": "✨ Acompanhamentos",
    "sec-pedidos": "📋 Pedidos",
    "sec-config": "⚙️ Configurações",
  };
  const tt = document.getElementById("topbar-titulo");
  if (tt) tt.textContent = tituloMap[id] || "Admin";

  if (id === "sec-dashboard") DASHBOARD.atualizar();
}
window.mostrarSecao = mostrarSecao;

// Escuta mudanças de tab para renderizar conteúdo
document.addEventListener("tabchange", (e) => {
  const { tab, secao } = e.detail;
  if (secao === "sec-produtos") {
    if (tab === "tab-produtos-lista") { renderizarAdmProdutos(); popularSelectCategorias(); }
    if (tab === "tab-novo-produto") { popularSelectCategorias(); popularComplementosProd(); }
  }
  if (secao === "sec-categorias") {
    if (tab === "tab-categorias-lista") renderizarAdmCategorias();
    // Acompanhamentos agora estão dentro de categorias
    if (tab === "tab-complementos-lista") renderizarAdmComplementos();
  }
  if (secao === "sec-complementos") {
    // sec-complementos agora é a seção Estoque
    if (tab === "tab-controle-estoque") renderizarControleEstoque();
    if (tab === "tab-estoque-base" && typeof renderizarEstoqueBase === "function") renderizarEstoqueBase();
  }
  if (secao === "sec-pedidos") {
    renderizarAdmPedidos();
  }
  if (secao === "sec-config") {
    preencherFormConfig();
  }
});

function popularSelectCategorias() {
  const sel = document.getElementById("prod-categoria");
  if (!sel) return;
  sel.innerHTML = `<option value="">Selecione...</option>` +
    STATE.get("categorias").map(c => `<option value="${c.id}">${c.emoji || ""} ${c.nome}</option>`).join("");
}

function popularComplementosProd() {
  const container = document.getElementById("prod-complementos-lista");
  if (!container) return;
  container.innerHTML = COMPLEMENTOS.ativos()
    .map(c => `<label class="tag-check"><input type="checkbox" name="prod-comp" value="${c.id}"><span>${c.nome}</span></label>`)
    .join("");
}

function preencherFormProduto(p) {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  s("prod-nome", p.nome); s("prod-descricao", p.descricao);
  s("prod-imagem", p.imagem); s("prod-preco", p.preco);
  s("prod-unidade", p.unidade || "un"); s("prod-estoque", p.estoque);
  s("prod-validade", p.validade); s("prod-emoji", p.emoji);
  // Preenche preview de imagem se já tiver
  if (typeof _preencherPreviewImagem === "function") _preencherPreviewImagem(p.imagem || "");
  const tc = document.getElementById("prod-tem-complementos");
  if (tc) tc.checked = p.temComplementos || false;
  const area = document.getElementById("prod-complementos-area");
  if (area) area.style.display = p.temComplementos ? "block" : "none";
  // Preenche campos de estoque-base
  const cbBase = document.getElementById("prod-usa-estoque-base");
  if (cbBase) {
    cbBase.checked = p.usaEstoqueBase || false;
    if (typeof toggleEstoqueBase === "function") toggleEstoqueBase(p.usaEstoqueBase || false);
    s("prod-estoque-base-id",    p.estoqueBaseId    || "");
    s("prod-consumo-por-venda",  p.consumoPorVenda  || "");
  }
  popularSelectCategorias();
  s("prod-categoria", p.categoria);
  // Preencher tamanhos com preço
  const VOLS_ED = ["200ml","300ml","400ml","500ml","700ml","1L"];
  VOLS_ED.forEach(v => {
    const cb  = document.getElementById("tam-" + v);
    const inp = document.getElementById("tam-preco-" + v);
    if (!cb) return;
    const tam = (p.tamanhos || []).find(t => (typeof t === "object" ? t.volume : t) === v);
    const ativo = !!tam;
    cb.checked   = ativo;
    if (inp) { inp.disabled = !ativo; inp.value = ativo && typeof tam === "object" ? (tam.preco || "") : ""; }
  });
  const todosEl = document.getElementById("sel-todos-tamanhos");
  if (todosEl) todosEl.checked = VOLS_ED.every(v => document.getElementById("tam-" + v)?.checked);
  popularComplementosProd();
  if (p.complementosVinculados) {
    document.querySelectorAll('input[name="prod-comp"]').forEach(cb => {
      cb.checked = p.complementosVinculados.includes(cb.value);
    });
  }
}

// CONFIG
function preencherFormConfig() {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
  s("cfg-nome", CONFIG.loja.nome); s("cfg-slogan", CONFIG.loja.slogan);
  // Preenche uploads de logo e banner
  if (typeof _preencherLogoUrl === "function") _preencherLogoUrl(CONFIG.loja.logoUrl || "");
  else { const el = document.getElementById("cfg-logoUrl"); if (el) el.value = CONFIG.loja.logoUrl || ""; }
  if (typeof _preencherBanner === "function") _preencherBanner(CONFIG.loja.banner || "");
  else { const el = document.getElementById("cfg-banner"); if (el) el.value = CONFIG.loja.banner || ""; }
  s("cfg-cor-primary", CONFIG.loja.corPrimaria); s("cfg-cor-secondary", CONFIG.loja.corSecundaria);
  s("cfg-cor-bg", CONFIG.loja.corFundo); s("cfg-cor-surface", CONFIG.loja.corSuperficie);
  s("cfg-cor-text", CONFIG.loja.corTexto);
  s("cfg-wpp", CONFIG.contato.whatsapp); s("cfg-wpp-adm", CONFIG.contato.whatsappAdm);
  s("cfg-endereco", CONFIG.contato.endereco); s("cfg-cidade", CONFIG.contato.cidade);
  s("cfg-instagram", CONFIG.contato.instagram);
  s("cfg-taxa", CONFIG.delivery.taxaEntrega); s("cfg-pedido-min", CONFIG.delivery.pedidoMinimo);
  s("cfg-tempo", CONFIG.delivery.tempoEstimado);
  s("cfg-wpp", CONFIG.contato.whatsapp); s("cfg-wpp-adm", CONFIG.contato.whatsappAdm);
  renderizarHorarios();
  const entrega = document.getElementById("cfg-entrega-ativa");
  if (entrega) entrega.checked = CONFIG.delivery.entregaAtiva;
  const retirada = document.getElementById("cfg-retirada-ativa");
  if (retirada) retirada.checked = CONFIG.delivery.retiradaAtiva;
  // Atualiza botão "Fechar Loja"
  const btnFechar = document.getElementById("btn-fechar-loja");
  if (btnFechar) {
    const estaAberta = CONFIG.funcionamento.aberto !== false;
    btnFechar.textContent = estaAberta ? "🟢 Loja Aberta" : "🔴 Loja Fechada";
    btnFechar.style.background = estaAberta ? "#2ecc71" : "#e74c3c";
  }
}

function renderizarHorarios() {
  const container = document.getElementById("horarios-lista");
  if (!container) return;
  container.innerHTML = (CONFIG.funcionamento.horarios || []).map((h, i) => `
    <div class="adm-item" data-index="${i}">
      <div class="adm-item-info" style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <input type="text" value="${h.dia}" placeholder="Dia(s)"
          onchange="atualizarHorario(${i}, 'dia', this.value)">
        <input type="text" value="${h.hora}" placeholder="Horário"
          onchange="atualizarHorario(${i}, 'hora', this.value)">
      </div>
      <button class="btn-icon btn-icon-del" onclick="removerHorario(${i})">🗑️</button>
    </div>`).join("") +
    `<button class="btn btn-outline btn-sm" onclick="adicionarHorario()" style="margin-top:8px;">+ Adicionar Horário</button>`;
}

function atualizarHorario(index, campo, valor) {
  CONFIG.funcionamento.horarios[index][campo] = valor;
}
window.atualizarHorario = atualizarHorario;

function removerHorario(index) {
  CONFIG.funcionamento.horarios.splice(index, 1);
  renderizarHorarios();
}
window.removerHorario = removerHorario;

function adicionarHorario() {
  CONFIG.funcionamento.horarios.push({ dia: "Dia(s)", hora: "00:00 – 00:00" });
  renderizarHorarios();
}
window.adicionarHorario = adicionarHorario;

function salvarConfig() {
  MODAL.pedirSenha("Salvar Configurações", () => {
    const g = id => document.getElementById(id)?.value || "";
    CONFIG.loja.nome = g("cfg-nome"); CONFIG.loja.slogan = g("cfg-slogan");
    CONFIG.loja.logoUrl = g("cfg-logoUrl");
    CONFIG.loja.banner = g("cfg-banner");
    CONFIG.loja.corPrimaria = g("cfg-cor-primary"); CONFIG.loja.corSecundaria = g("cfg-cor-secondary");
    CONFIG.loja.corFundo = g("cfg-cor-bg"); CONFIG.loja.corSuperficie = g("cfg-cor-surface");
    CONFIG.loja.corTexto = g("cfg-cor-text");
    CONFIG.contato.whatsapp = g("cfg-wpp"); CONFIG.contato.whatsappAdm = g("cfg-wpp-adm");
    CONFIG.contato.endereco = g("cfg-endereco"); CONFIG.contato.cidade = g("cfg-cidade");
    CONFIG.contato.instagram = g("cfg-instagram");
    CONFIG.delivery.taxaEntrega = parseFloat(g("cfg-taxa")) || 0;
    CONFIG.delivery.pedidoMinimo = parseFloat(g("cfg-pedido-min")) || 0;
    CONFIG.delivery.tempoEstimado = g("cfg-tempo");
    CONFIG.delivery.entregaAtiva = document.getElementById("cfg-entrega-ativa")?.checked;
    CONFIG.delivery.retiradaAtiva = document.getElementById("cfg-retirada-ativa")?.checked;
    // CONFIG.funcionamento.aberto é controlado pelo botão "Fechar Loja" (toggleFecharLoja)
    // ⚠️ Senhas NÃO são alteradas via painel — apenas via código-fonte pelo programador
    STORAGE.salvarConfig();
    UTIL.aplicarCores();
    renderizarAdmin();
    // Se estiver na página da loja (não admin), atualiza status imediatamente
    if (typeof _verificarStatusLoja === "function") _verificarStatusLoja();
    MODAL.sucesso(ENUMS.MSGS.CONFIG_SALVA);
  });
}
window.salvarConfig = salvarConfig;

// ADMIN — Login (multi-tenant — implementado no api.js)
// As funções fazerLogin e fazerLogout são definidas no api.js
// e não devem ser sobrescritas aqui.

// ============================================================
// EVENT LISTENERS — Formulários
// ============================================================
function bindFormProduto() {
  const form = document.getElementById("form-produto");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const g = id => document.getElementById(id)?.value?.trim() || "";
    const id = g("form-produto-id");
    // Ler tamanhos com preço
    const VOLS_TAMANHOS = ["200ml","300ml","400ml","500ml","700ml","1L"];
    const tamanhos = VOLS_TAMANHOS
      .filter(v => document.getElementById("tam-" + v)?.checked)
      .map(v => ({ volume: v, preco: parseFloat(document.getElementById("tam-preco-" + v)?.value) || 0 }));
    const compsVinculados = [...document.querySelectorAll('input[name="prod-comp"]:checked')].map(el => el.value);
    const dados = {
      nome: g("prod-nome"), descricao: g("prod-descricao"), imagem: g("prod-imagem"),
      emoji: g("prod-emoji"), categoria: g("prod-categoria"),
      preco: parseFloat(g("prod-preco")) || 0,
      unidade: g("prod-unidade"), tamanhos,
      estoque: g("prod-estoque") !== "" ? parseInt(g("prod-estoque")) : "",
      validade: g("prod-validade"),
      temComplementos: document.getElementById("prod-tem-complementos")?.checked,
      complementosVinculados: compsVinculados,
      // Campos de estoque-base (produto por peso)
      usaEstoqueBase:   document.getElementById("prod-usa-estoque-base")?.checked || false,
      estoqueBaseId:    g("prod-estoque-base-id"),
      consumoPorVenda:  parseFloat(g("prod-consumo-por-venda")) || 0,
    };
    if (!dados.nome || !dados.preco) { MODAL.erro(ENUMS.MSGS.CAMPO_OBRIGATORIO); return; }

    function _limparFormularioProduto() {
      form.reset();
      document.getElementById("form-produto-id").value = "";
      document.getElementById("form-produto-titulo").textContent = "Novo Produto";
      document.getElementById("prod-complementos-area").style.display = "none";
      // Limpa campos de estoque-base
      document.getElementById("config-estoque-base").style.display = "none";
      document.getElementById("prod-usa-estoque-base").checked = false;
      // Limpa tamanhos
      ["200ml","300ml","400ml","500ml","700ml","1L"].forEach(v => {
        const cb  = document.getElementById("tam-" + v);
        const inp = document.getElementById("tam-preco-" + v);
        if (cb)  cb.checked = false;
        if (inp) { inp.value = ""; inp.disabled = true; }
      });
      const todosEl = document.getElementById("sel-todos-tamanhos");
      if (todosEl) todosEl.checked = false;
      // Limpa preview de imagem
      if (typeof _removerImagemProduto === "function") _removerImagemProduto();
      TABS.ir("sec-produtos", "tab-produtos-lista");
      MODAL.sucesso(ENUMS.MSGS.PRODUTO_SALVO);
    }

    if (id) {
      // Edição: aguarda confirmação do servidor antes de limpar o formulário
      PRODUTOS.editar(id, dados).then(() => {
        _limparFormularioProduto();
      }).catch(() => {
        // O erro já é exibido dentro de PRODUTOS.editar
      });
    } else {
      PRODUTOS.criar(dados);
      _limparFormularioProduto();
    }
  });
  document.getElementById("prod-tem-complementos")?.addEventListener("change", e => {
    document.getElementById("prod-complementos-area").style.display = e.target.checked ? "block" : "none";
  });
}

function bindFormCategoria() {
  const form = document.getElementById("form-categoria");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const g = id => document.getElementById(id)?.value?.trim() || "";
    const id = g("cat-id");
    const nome = g("cat-nome");
    if (!nome) { MODAL.erro(ENUMS.MSGS.CAMPO_OBRIGATORIO); return; }
    const dados = {
      nome, emoji: g("cat-emoji"),
      cor: document.getElementById("cat-cor")?.value || "#7B2FBE",
      frase: g("cat-frase"),
    };
    if (!dados.frase) dados.frase = UTIL.gerarFraseCategoria(nome);
    if (id) { CATEGORIAS.editar(id, dados); } else { CATEGORIAS.criar(dados); }
    form.reset();
    document.getElementById("cat-id").value = "";
    document.getElementById("form-cat-titulo").textContent = "Nova Categoria";
    TABS.ir("sec-categorias", "tab-categorias-lista");
    MODAL.sucesso(ENUMS.MSGS.CATEGORIA_SALVA);
  });
  document.getElementById("cat-nome")?.addEventListener("input", e => {
    const fraseEl = document.getElementById("cat-frase");
    if (fraseEl && !document.getElementById("cat-id")?.value) {
      fraseEl.placeholder = UTIL.gerarFraseCategoria(e.target.value);
    }
  });
}

function bindFormComplemento() {
  const form = document.getElementById("form-complemento");
  if (!form) return;
  form.addEventListener("submit", e => {
    e.preventDefault();
    const g = id => document.getElementById(id)?.value?.trim() || "";
    const id = g("comp-id");
    const nome = g("comp-nome");
    if (!nome) { MODAL.erro(ENUMS.MSGS.CAMPO_OBRIGATORIO); return; }
    const usaBase = document.getElementById("comp-usa-estoque-base")?.checked || false;
    const dados = {
      nome,
      preco: parseFloat(g("comp-preco")) || 0,
      estoque: g("comp-estoque") !== "" ? parseInt(g("comp-estoque")) : "",
      usaEstoqueBase: usaBase,
      estoqueBaseId:  usaBase ? g("comp-estoque-base-id") : "",
      consumoQtd:     usaBase ? parseFloat(g("comp-consumo-qtd")) || 0 : 0,
      consumoUnidade: usaBase ? g("comp-consumo-unidade") || "g" : "",
    };
    if (id) { COMPLEMENTOS.editar(id, dados); } else { COMPLEMENTOS.criar(dados); }
    form.reset();
    const cbBase = document.getElementById("comp-usa-estoque-base");
    if (cbBase) { cbBase.checked = false; toggleCompEstoqueBase(false); }
    document.getElementById("comp-id").value = "";
    document.getElementById("form-comp-titulo").textContent = "Novo Acompanhamento";
    MODAL.sucesso(ENUMS.MSGS.COMPLEMENTO_SALVO);
  });
}

function toggleCompEstoqueBase(ativo) {
  const cfg = document.getElementById("comp-estoque-base-config");
  if (cfg) cfg.style.display = ativo ? "block" : "none";
  // Popular select de estoques base
  if (ativo) {
    const sel = document.getElementById("comp-estoque-base-id");
    if (sel) {
      const bases = STATE.get("estoquesBases") || [];
      const atual = sel.value;
      sel.innerHTML = '<option value="">Selecione...</option>' +
        bases.map(b => `<option value="${b.id}" ${b.id === atual ? "selected" : ""}>${b.nome} (${b.unidade})</option>`).join("");
    }
  }
}
window.toggleCompEstoqueBase = toggleCompEstoqueBase;

function bindCarrinhoFinalizacao() {
  document.querySelectorAll('input[name="tipo-entrega"]').forEach(r => {
    r.addEventListener("change", () => {
      const isEntrega = r.value === ENUMS.TIPO_ENTREGA.ENTREGA;
      const enderecoArea = document.getElementById("area-endereco");
      if (enderecoArea) enderecoArea.style.display = isEntrega ? "block" : "none";
      CARRINHO._atualizarTotais();
    });
  });
  document.getElementById("btn-finalizar")?.addEventListener("click", async () => {
    const nome = document.getElementById("cliente-nome")?.value?.trim();
    const tel = document.getElementById("cliente-telefone")?.value?.trim();
    const tipoEntrega = document.querySelector('input[name="tipo-entrega"]:checked')?.value;
    const pag = document.getElementById("cliente-pagamento")?.value;
    const endereco = document.getElementById("cliente-endereco")?.value?.trim();
    if (tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA && !endereco) {
      MODAL.erro("Informe o endereço de entrega.");
      return;
    }
    await WPP.enviar({ nome, telefone: tel }, tipoEntrega, pag, endereco);
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  // Carrinho ainda usa localStorage (não precisa de autenticação)
  STATE.set("carrinho", STORAGE.get(STORAGE.KEYS.CARRINHO) || []);
  // Dados de produtos/categorias/pedidos vêm do MongoDB via api.js
  // carregarDadosDemo só roda se api.js não estiver presente
  carregarDadosDemo();
  UTIL.aplicarCores();

  const isAdmin = document.body.classList.contains("pagina-admin");

  if (isAdmin) {
    // Tecla Enter nos campos de login (multi-tenant via api.js)
    document.getElementById("login-senha")?.addEventListener("keydown", e => {
      if (e.key === "Enter") fazerLogin();
    });
    document.getElementById("login-usuario")?.addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("login-senha")?.focus();
    });
    // Overlay sempre visível até api.js autenticar
    document.getElementById("login-overlay")?.classList.add("active");
    bindFormProduto();
    bindFormCategoria();
    bindFormComplemento();
    document.querySelectorAll(".adm-nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const sec = btn.dataset.sec;
        mostrarSecao(sec);
        // Init tabs da seção ao abrir
        setTimeout(() => TABS.init(sec), 50);
      });
    });
  } else {
    renderizarCatalogo();
    bindCarrinhoFinalizacao();
    document.getElementById("busca-input")?.addEventListener("input", e => buscarProdutos(e.target.value));
    document.getElementById("overlay-carrinho")?.addEventListener("click", fecharCarrinho);
    const opcEntrega = document.getElementById("opc-entrega");
    const opcRetirada = document.getElementById("opc-retirada");
    if (!CONFIG.delivery.entregaAtiva && opcEntrega) opcEntrega.style.display = "none";
    if (!CONFIG.delivery.retiradaAtiva && opcRetirada) opcRetirada.style.display = "none";

    // Verifica status inicial da loja (controlado pelo botão Fechar Loja)
    _verificarStatusLoja();
  }
});

// ============================================================
// BOTÃO FECHAR LOJA — Controle manual pelo admin
// ============================================================
function toggleFecharLoja() {
  const estaAberta = CONFIG.funcionamento.aberto !== false;
  CONFIG.funcionamento.aberto = !estaAberta; // inverte

  // Atualiza visual do botão
  const btn = document.getElementById("btn-fechar-loja");
  if (btn) {
    btn.textContent = CONFIG.funcionamento.aberto ? "🟢 Loja Aberta" : "🔴 Loja Fechada";
    btn.style.background = CONFIG.funcionamento.aberto ? "#2ecc71" : "#e74c3c";
  }

  // Salva config
  STORAGE.salvarConfig();
  MODAL.toast(CONFIG.funcionamento.aberto ? "✅ Loja aberta com sucesso!" : "🔒 Loja fechada com sucesso!");
}
window.toggleFecharLoja = toggleFecharLoja;

// ============================================================
// ADICIONAR PRODUTO AO PEDIDO (botão ➕ em Produtos Cadastrados)
// ============================================================

// Abre o mesmo modal do cliente para selecionar tamanho/complementos/qtd,
// mas ao confirmar adiciona direto ao pedido escolhido pelo admin

async function pmAdicionarAoPedido(produtoId) {
  const produto = STATE.get("produtos").find(x => x.id === produtoId);
  if (!produto) return;

  const pedidoId = document.getElementById("pm-pedido-select")?.value;
  if (!pedidoId) { MODAL.toast("Selecione um pedido."); return; }

  const pedido = STATE.get("pedidos").find(x => x.id === pedidoId);
  if (!pedido) return;

  const qtd     = parseInt(document.getElementById("pm-qtd-val")?.textContent) || 1;
  const _tamEl = document.querySelector('input[name="pm-tamanho"]:checked');
  const tamanho = _tamEl?.value || "";
  const precoTamanho = _tamEl ? parseFloat(_tamEl.dataset.preco) || produto.preco : produto.preco;
  const comps   = [...document.querySelectorAll('input[name="pm-comp"]:checked')]
    .map(el => ({ id: el.value, nome: el.dataset.nome, preco: parseFloat(el.dataset.preco) || 0 }));
  const obs     = document.getElementById("pm-obs-adm")?.value || "";

  // Unidade: tamanho selecionado tem prioridade (igual ao carrinho do cliente)
  const unidade = tamanho || produto.unidade || "un";

  const precoComComps = precoTamanho + comps.reduce((s, c) => s + (c.preco || 0), 0);

  const itensAtuais = (pedido.itens || []).map(i => ({ ...i }));

  // Verifica se já existe item igual (mesmo produto + tamanho + complementos iguais)
  const chave = produtoId + "|" + tamanho + "|" + comps.map(c => c.id).sort().join(",");
  const existente = itensAtuais.find(i =>
    i.produtoId === produtoId &&
    (i.tamanho || "") === tamanho &&
    (i.complementos || []).map(c => c.id).sort().join(",") === comps.map(c => c.id).sort().join(",")
  );

  if (existente) {
    existente.quantidade += qtd;
  } else {
    itensAtuais.push({
      id: UTIL.id(),
      produtoId: produto.id,
      nome: produto.nome,
      preco: precoComComps,
      quantidade: qtd,
      unidade: unidade,
      imagem: produto.imagem || "",
      tamanho: tamanho,
      complementos: comps,
      observacao: obs,
    });
  }

  const taxa     = pedido.taxaEntrega || 0;
  const subtotal = itensAtuais.reduce((s, i) => s + (i.preco * i.quantidade), 0);
  const total    = subtotal + taxa;

  try {
    const pedidoAtualizado = await API_PEDIDOS.editar(pedidoId, {
      itens: itensAtuais, total, subtotal, taxaEntrega: taxa,
      status: pedido.status, formaPagamento: pedido.formaPagamento, endereco: pedido.endereco,
    });

    STATE.update("pedidos", lista =>
      lista.map(p => p.id === pedidoId
        ? { ...p, ...pedidoAtualizado, itens: itensAtuais, total, subtotal }
        : p)
    );

    const [produtosAtualizados, estoquesBases] = await Promise.all([
      API_PRODUTOS.listar(),
      API_ESTOQUE_BASE.listar(),
    ]);
    STATE.set("produtos", produtosAtualizados);
    STATE.set("estoques_base", estoquesBases);

    renderizarAdmProdutos?.();
    renderizarAdmPedidos?.();

    document.getElementById("produto-modal-overlay")?.remove();
    MODAL.sucesso(`✅ "${produto.nome}"${tamanho ? " ("+tamanho+")" : ""} adicionado ao pedido de ${pedido.cliente?.nome || "cliente"}!`);
  } catch (err) {
    MODAL.toast("Erro ao adicionar: " + (err.message || err));
  }
}
window.pmAdicionarAoPedido = pmAdicionarAoPedido;