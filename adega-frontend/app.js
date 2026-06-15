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
    corPrimaria: "#5B2D8E",
    corSecundaria: "#E91E8C",
    corFundo: "#1d1331",
    corSuperficie: "#2c1c4f",
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
    admin: "1234",
    confirmacoes: "1234",
   
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
    PEDIDO_ENVIADO: "Pedido enviado pelo WhatsApp!",
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
  verificarSenha(senha) {
    return senha === CONFIG.senha.confirmacoes || senha === CONFIG.senha.admin;
  },
  aplicarCores() {
    const r = document.documentElement.style;
    r.setProperty("--primary", CONFIG.loja.corPrimaria);
    r.setProperty("--secondary", CONFIG.loja.corSecundaria);
    r.setProperty("--background", CONFIG.loja.corFundo);
    r.setProperty("--surface", CONFIG.loja.corSuperficie);
    r.setProperty("--text", CONFIG.loja.corTexto);
  },
};

// ============================================================
// MODAL SYSTEM
// ============================================================
const MODAL = {
  mostrar(tipo, titulo, mensagem, onConfirm = null, placeholder = "") {
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
          ${isConfirm ? `<button class="btn btn-outline" onclick="MODAL.fechar()">Cancelar</button>` : ""}
          <button class="btn ${tipo==='erro'?'btn-danger':tipo==='sucesso'?'btn-success':'btn-primary'}" id="modal-confirm-btn">
            ${tipo === "senha" ? "Confirmar" : isConfirm ? "Confirmar" : "OK"}
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("active"), 10);
    const btn = document.getElementById("modal-confirm-btn");
    if (tipo === "senha") {
      btn.onclick = () => {
        const val = document.getElementById("modal-senha-input")?.value;
        if (UTIL.verificarSenha(val)) { MODAL.fechar(); if (onConfirm) onConfirm(); }
        else { document.getElementById("modal-senha-input").classList.add("input-erro"); MODAL.shake(); }
      };
      document.getElementById("modal-senha-input")?.addEventListener("keydown", e => { if (e.key === "Enter") btn.click(); });
      setTimeout(() => document.getElementById("modal-senha-input")?.focus(), 100);
    } else if (isConfirm) {
      btn.onclick = () => { MODAL.fechar(); if (onConfirm) onConfirm(); };
    } else {
      btn.onclick = () => { MODAL.fechar(); if (onConfirm) onConfirm(); };
      setTimeout(() => MODAL.fechar(), 3000);
    }
    overlay.addEventListener("click", e => { if (e.target === overlay && tipo !== "senha") MODAL.fechar(); });
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
  pedirSenha(titulo, cb) { this.mostrar("senha", titulo, "Digite a senha para continuar:", cb); },
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
      preco: produto.preco,
      imagem: produto.imagem,
      quantidade: parseInt(quantidade) || 1,
      tamanho: tamanho || "",
      complementos: complementosSelecionados || [],
      observacao: observacao || "",
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
    const taxa = tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA && CONFIG.delivery.entregaAtiva
      ? CONFIG.delivery.taxaEntrega : 0;
    const total = subtotal + taxa;
    const elSub = document.getElementById("carrinho-subtotal");
    const elTaxa = document.getElementById("carrinho-taxa");
    const elTotal = document.getElementById("carrinho-total");
    if (elSub) elSub.textContent = UTIL.formatarMoeda(subtotal);
    if (elTaxa) elTaxa.textContent = taxa > 0 ? UTIL.formatarMoeda(taxa) : "Grátis";
    if (elTotal) elTotal.textContent = UTIL.formatarMoeda(total);
  },
};

// Reatividade: carrinho
STATE.on("carrinho", () => CARRINHO.atualizarUI());

// ============================================================
// WHATSAPP
// ============================================================
const WPP = {
  gerarMensagem(cliente, tipoEntrega, formaPagamento, endereco) {
    const carrinho = STATE.get("carrinho");
    const linhas = [
      `🛒 *NOVO PEDIDO — ${CONFIG.loja.nome}*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Cliente:* ${cliente.nome}`,
      `📱 *Tel:* ${cliente.telefone}`,
      ``,
      `📦 *ITENS DO PEDIDO:*`,
    ];
    carrinho.forEach((item, i) => {
      const compPreco = item.complementos.reduce((s, c) => s + (c.preco || 0), 0);
      linhas.push(`\n${i + 1}. *${item.nome}*${item.tamanho ? ` (${item.tamanho})` : ""}`);
      linhas.push(`   Qtd: ${item.quantidade}x — ${UTIL.formatarMoeda(item.preco)}`);
      if (item.complementos.length) linhas.push(`   ➕ ${item.complementos.map(c => c.nome).join(", ")}`);
      if (item.observacao) linhas.push(`   📝 ${item.observacao}`);
      linhas.push(`   Subtotal: ${UTIL.formatarMoeda((item.preco + compPreco) * item.quantidade)}`);
    });
    const subtotal = CARRINHO.total();
    const taxa = tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA && CONFIG.delivery.entregaAtiva
      ? CONFIG.delivery.taxaEntrega : 0;
    linhas.push(`\n━━━━━━━━━━━━━━━━━━━━━`);
    linhas.push(`💰 *Subtotal:* ${UTIL.formatarMoeda(subtotal)}`);
    linhas.push(`🚚 *${tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA ? "Taxa de entrega" : "Retirada"}:* ${taxa > 0 ? UTIL.formatarMoeda(taxa) : "Grátis"}`);
    linhas.push(`✅ *TOTAL: ${UTIL.formatarMoeda(subtotal + taxa)}*`);
    linhas.push(`\n💳 *Pagamento:* ${formaPagamento}`);
    if (tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA) linhas.push(`📍 *Endereço:* ${endereco}`);
    linhas.push(`\n⏱ Tempo estimado: ${CONFIG.delivery.tempoEstimado}`);
    return encodeURIComponent(linhas.join("\n"));
  },
  enviar(cliente, tipoEntrega, formaPagamento, endereco) {
    const carrinho = STATE.get("carrinho");
    if (carrinho.length === 0) { MODAL.erro(ENUMS.MSGS.CARRINHO_VAZIO); return; }
    if (!cliente.nome || !cliente.telefone) { MODAL.erro(ENUMS.MSGS.CAMPO_OBRIGATORIO); return; }

    const pedido = {
      id: UTIL.id(),
      data: new Date().toISOString(),
      cliente,
      itens: [...carrinho],
      tipoEntrega,
      formaPagamento,
      endereco,
      subtotal: CARRINHO.total(),
      taxaEntrega: tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA ? CONFIG.delivery.taxaEntrega : 0,
      total: CARRINHO.total() + (tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA ? CONFIG.delivery.taxaEntrega : 0),
      status: ENUMS.STATUS_PEDIDO.PENDENTE,
    };

    STATE.update("pedidos", p => [...p, pedido]);
    STORAGE.salvarPedidos();

    // Decrementar estoque
    const produtos = [...STATE.get("produtos")];
    const complementos = [...STATE.get("complementos")];

    carrinho.forEach(item => {
      const prod = produtos.find(p => p.id === item.produtoId);
      if (prod && prod.estoque !== undefined && prod.estoque !== null && prod.estoque !== "") {
        prod.estoque = Math.max(0, (prod.estoque || 0) - item.quantidade);
        prod.vendas = (prod.vendas || 0) + item.quantidade;
      }
      item.complementos.forEach(c => {
        const comp = complementos.find(x => x.id === c.id);
        if (comp && comp.estoque !== undefined && comp.estoque !== "") {
          comp.estoque = Math.max(0, (comp.estoque || 0) - item.quantidade);
        }
      });
    });

    STATE.set("produtos", produtos);
    STATE.set("complementos", complementos);
    STORAGE.salvarProdutos();
    STORAGE.salvarComplementos();

    const msg = this.gerarMensagem(cliente, tipoEntrega, formaPagamento, endereco);
    const num = CONFIG.contato.whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
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
    return STATE.get("produtos").filter(p =>
      p.estoque !== "" && p.estoque !== undefined && Number(p.estoque) <= limite && Number(p.estoque) >= 0
    );
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
      .filter(p => p.data?.startsWith(hoje) && p.status !== ENUMS.STATUS_PEDIDO.CANCELADO)
      .reduce((s, p) => s + (p.total || 0), 0);
  },
  faturamentoMes() {
    const mes = UTIL.mesAtual();
    return STATE.get("pedidos")
      .filter(p => p.data?.startsWith(mes) && p.status !== ENUMS.STATUS_PEDIDO.CANCELADO)
      .reduce((s, p) => s + (p.total || 0), 0);
  },
  faturamentoAno() {
    const ano = UTIL.anoAtual();
    return STATE.get("pedidos")
      .filter(p => p.data?.startsWith(ano) && p.status !== ENUMS.STATUS_PEDIDO.CANCELADO)
      .reduce((s, p) => s + (p.total || 0), 0);
  },
  totalPedidos() { return STATE.get("pedidos").length; },
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
    const lista = PRODUTOS.comEstoqueBaixo(5);
    el.innerHTML = lista.length
      ? lista.map(p => `<div class="alerta-item">
          <span>⚠️ ${UTIL.sanitize(p.nome)}</span>
          <span class="badge-danger">${p.estoque} ${p.unidade || "un"}</span>
        </div>`).join("")
      : `<p class="sem-dados">Nenhum alerta de estoque.</p>`;

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
      <div class="dash-stat"><span>${total}</span><small>Total Produtos</small></div>
      <div class="dash-stat"><span style="color:var(--warning)">${baixo}</span><small>Estoque Baixo</small></div>
    `;
  },
};

// Reatividade automática do dashboard
STATE.on("pedidos", () => {
  if (document.getElementById("sec-dashboard")?.classList.contains("ativo")) {
    DASHBOARD.atualizar();
  }
  // Atualizar aba de pedidos se estiver visível
  const pane = document.getElementById("tab-pedidos-recebidos") || document.getElementById("tab-historico-pedidos");
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
  const complementosDisponiveis = produto.temComplementos ? COMPLEMENTOS.ativos() : [];
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
        <div class="pm-preco">${UTIL.formatarMoeda(produto.preco)}<small>/${produto.unidade || "un"}</small></div>
        ${tamanhos.length ? `<div class="pm-secao"><label>Tamanho:</label><div class="pm-tamanhos">${tamanhos.map(t => `<label class="tag-radio"><input type="radio" name="pm-tamanho" value="${t}"><span>${t}</span></label>`).join("")}</div></div>` : ""}
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
  const tamanho = document.querySelector('input[name="pm-tamanho"]:checked')?.value || "";
  const comps = [...document.querySelectorAll('input[name="pm-comp"]:checked')]
    .map(el => ({ id: el.value, nome: el.dataset.nome, preco: parseFloat(el.dataset.preco) || 0 }));
  const obs = document.getElementById("pm-obs")?.value || "";
  CARRINHO.adicionar(produto, qtd, tamanho, comps, obs);
  document.getElementById("produto-modal-overlay")?.remove();
}
window.pmAdicionarCarrinho = pmAdicionarCarrinho;

// ============================================================
// RENDERIZAÇÃO DO CATÁLOGO
// ============================================================
function renderizarCatalogo() {
  aplicarConfigUI();
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
  return `<div class="produto-card" onclick="abrirModalProduto('${p.id}')">
    <div class="pc-img">${p.imagem
      ? `<img src="${UTIL.sanitize(p.imagem)}" alt="${UTIL.sanitize(p.nome)}" loading="lazy">`
      : `<span class="pc-emoji">${p.emoji || "🛍️"}</span>`}</div>
    <div class="pc-body">
      <h3>${UTIL.sanitize(p.nome)}</h3>
      ${p.descricao ? `<p>${UTIL.sanitize(p.descricao)}</p>` : ""}
      <div class="pc-footer">
        <span class="pc-preco">${UTIL.formatarMoeda(p.preco)}<small>/${p.unidade || "un"}</small></span>
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
  const lista = STATE.get("produtos");
  if (lista.length === 0) {
    container.innerHTML = `<p class="sem-dados">Nenhum produto cadastrado.</p>`;
    return;
  }
  container.innerHTML = lista.map(p => `
    <div class="adm-item ${p.ativo ? "" : "pausado"}">
      <div class="adm-item-img">${p.imagem
        ? `<img src="${UTIL.sanitize(p.imagem)}" alt="">`
        : `<span>${p.emoji || "🛍️"}</span>`}</div>
      <div class="adm-item-info">
        <strong>${UTIL.sanitize(p.nome)}</strong>
        <small>${UTIL.formatarMoeda(p.preco)} / ${p.unidade || "un"} | Estoque: ${p.estoque ?? "∞"} | Vendas: ${p.vendas || 0}</small>
        ${!p.ativo ? `<span class="badge-warning">Pausado</span>` : ""}
      </div>
      <div class="adm-item-acoes">
        <button class="btn-icon" onclick="editarProduto('${p.id}')" title="Editar">✏️</button>
        <button class="btn-icon" onclick="pausarProduto('${p.id}')" title="${p.ativo ? 'Pausar' : 'Reativar'}">${p.ativo ? "⏸" : "▶️"}</button>
        <button class="btn-icon btn-icon-del" onclick="excluirProduto('${p.id}')" title="Excluir">🗑️</button>
      </div>
    </div>`).join("");
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

function editarProduto(id) {
  const p = STATE.get("produtos").find(x => x.id === id);
  if (!p) return;
  preencherFormProduto(p);
  TABS.ir("sec-produtos", "tab-novo-produto");
  document.getElementById("form-produto-titulo").textContent = "Editar Produto";
  document.getElementById("form-produto-id").value = id;
}
window.editarProduto = editarProduto;

// Controle de estoque — tab dentro de categorias
function renderizarControleEstoque() {
  const container = document.getElementById("tab-controle-estoque");
  if (!container) return;
  const lista = STATE.get("produtos");
  if (lista.length === 0) {
    container.innerHTML = `<p class="sem-dados">Nenhum produto cadastrado.</p>`;
    return;
  }
  container.innerHTML = `
    <div class="form-card">
      <div class="form-card-titulo">📦 Controle de Estoque</div>
      <div id="estoque-lista">
        ${lista.map(p => `
          <div class="adm-item">
            <div class="adm-item-img">${p.imagem ? `<img src="${UTIL.sanitize(p.imagem)}" alt="">` : `<span>${p.emoji || "🛍️"}</span>`}</div>
            <div class="adm-item-info">
              <strong>${UTIL.sanitize(p.nome)}</strong>
              <small>Estoque atual: <strong>${p.estoque ?? "∞"}</strong> ${p.unidade || "un"} | Vendas: ${p.vendas || 0}</small>
              ${(p.estoque !== undefined && p.estoque !== "" && Number(p.estoque) <= 5)
                ? `<span class="badge-danger">⚠️ Estoque Baixo</span>` : ""}
            </div>
            <div class="adm-item-acoes" style="align-items:center; gap:8px;">
              <input type="number" min="0" value="${p.estoque ?? ''}" placeholder="∞"
                style="width:80px; text-align:center;"
                onchange="atualizarEstoque('${p.id}', this.value)">
              <span style="font-size:12px; color:var(--text-muted)">${p.unidade || "un"}</span>
            </div>
          </div>`).join("")}
      </div>
    </div>`;
}
window.renderizarControleEstoque = renderizarControleEstoque;

function atualizarEstoque(id, valor) {
  PRODUTOS.editar(id, { estoque: valor === "" ? "" : parseInt(valor) });
  MODAL.toast("Estoque atualizado!");
  DASHBOARD.atualizar();
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
  container.innerHTML = lista.map(c => `
    <div class="adm-item ${c.ativo ? "" : "pausado"}">
      <div class="adm-item-info">
        <strong>${UTIL.sanitize(c.nome)}</strong>
        <small>+ ${UTIL.formatarMoeda(c.preco || 0)} | Estoque: ${c.estoque ?? "∞"}</small>
        ${!c.ativo ? `<span class="badge-warning">Pausado</span>` : ""}
      </div>
      <div class="adm-item-acoes">
        <button class="btn-icon" onclick="editarComplemento('${c.id}')">✏️</button>
        <button class="btn-icon" onclick="pausarComplemento('${c.id}')">${c.ativo ? "⏸" : "▶️"}</button>
        <button class="btn-icon btn-icon-del" onclick="excluirComplemento('${c.id}')">🗑️</button>
      </div>
    </div>`).join("");
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
  document.getElementById("form-comp-titulo").textContent = "Editar Complemento";
  TABS.ir("sec-complementos", "tab-novo-complemento");
}
window.editarComplemento = editarComplemento;

// ADMIN — Pedidos
function renderizarAdmPedidos() {
  // Pedidos Recebidos (pendentes/ativos)
  const activeContainer = document.getElementById("pedidos-recebidos-lista");
  // Histórico (todos)
  const histContainer = document.getElementById("pedidos-historico-lista");

  const pedidos = [...STATE.get("pedidos")].reverse();
  const ativos = pedidos.filter(p => p.status !== ENUMS.STATUS_PEDIDO.CANCELADO && p.status !== ENUMS.STATUS_PEDIDO.ENTREGUE);
  const historico = pedidos;

  const renderPedido = (p, showStatus = false) => `
    <div class="pedido-card">
      <div class="pedido-header">
        <div>
          <strong>${UTIL.sanitize(p.cliente?.nome || "—")}</strong>
          <small style="color:var(--text-muted); display:block;">${UTIL.formatarData(p.data)}</small>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge-${p.status === 'cancelado' ? 'danger' : p.status === 'entregue' ? 'success' : 'warning'}">${p.status}</span>
          <button class="btn-icon btn-icon-del" title="Excluir pedido e estornar estoque"
            onclick="confirmarExcluirPedido('${p.id}')">🗑️</button>
        </div>
      </div>
      <div class="pedido-itens">
        ${(p.itens || []).map(i => `<small>• ${i.quantidade}x ${UTIL.sanitize(i.nome)}${i.tamanho ? ` (${i.tamanho})` : ""}</small>`).join("")}
      </div>
      <div class="pedido-footer">
        <span>${p.tipoEntrega === "entrega" ? "🚚 Entrega" : "🏪 Retirada"} | ${p.formaPagamento || "—"}</span>
        <strong>${UTIL.formatarMoeda(p.total)}</strong>
      </div>
      ${p.tipoEntrega === "entrega" && p.endereco ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">📍 ${UTIL.sanitize(p.endereco)}</div>` : ""}
    </div>`;

  if (activeContainer) {
    activeContainer.innerHTML = ativos.length
      ? ativos.map(p => renderPedido(p)).join("")
      : `<p class="sem-dados">Nenhum pedido recebido.</p>`;
  }

  if (histContainer) {
    histContainer.innerHTML = historico.length
      ? historico.map(p => renderPedido(p, true)).join("")
      : `<p class="sem-dados">Nenhum pedido no histórico.</p>`;
  }
}

function confirmarExcluirPedido(id) {
  MODAL.pedirSenha("Excluir Pedido", () => {
    MODAL.confirmar("Excluir este pedido? O estoque será revertido automaticamente e o faturamento será atualizado.", () => {
      PEDIDOS.excluir(id);
      renderizarAdmPedidos();
      DASHBOARD.atualizar();
      MODAL.toast(ENUMS.MSGS.PEDIDO_EXCLUIDO, "sucesso");
    });
  });
}
window.confirmarExcluirPedido = confirmarExcluirPedido;

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
    if (tab === "tab-controle-estoque") renderizarControleEstoque();
  }
  if (secao === "sec-complementos") {
    if (tab === "tab-complementos-lista") renderizarAdmComplementos();
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
  const tc = document.getElementById("prod-tem-complementos");
  if (tc) tc.checked = p.temComplementos || false;
  const area = document.getElementById("prod-complementos-area");
  if (area) area.style.display = p.temComplementos ? "block" : "none";
  popularSelectCategorias();
  s("prod-categoria", p.categoria);
  const tamanhosSel = document.getElementById("prod-tamanhos");
  if (tamanhosSel) {
    [...tamanhosSel.options].forEach(o => { o.selected = (p.tamanhos || []).includes(o.value); });
  }
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
  s("cfg-logo", CONFIG.loja.logo); s("cfg-logoUrl", CONFIG.loja.logoUrl);
  s("cfg-banner", CONFIG.loja.banner);
  s("cfg-cor-primary", CONFIG.loja.corPrimaria); s("cfg-cor-secondary", CONFIG.loja.corSecundaria);
  s("cfg-cor-bg", CONFIG.loja.corFundo); s("cfg-cor-surface", CONFIG.loja.corSuperficie);
  s("cfg-cor-text", CONFIG.loja.corTexto);
  s("cfg-wpp", CONFIG.contato.whatsapp); s("cfg-wpp-adm", CONFIG.contato.whatsappAdm);
  s("cfg-endereco", CONFIG.contato.endereco); s("cfg-cidade", CONFIG.contato.cidade);
  s("cfg-instagram", CONFIG.contato.instagram);
  s("cfg-taxa", CONFIG.delivery.taxaEntrega); s("cfg-pedido-min", CONFIG.delivery.pedidoMinimo);
  s("cfg-tempo", CONFIG.delivery.tempoEstimado);
  s("cfg-senha-adm", CONFIG.senha.admin); s("cfg-senha-conf", CONFIG.senha.confirmacoes);
  // Horários
  renderizarHorarios();
  const entrega = document.getElementById("cfg-entrega-ativa");
  if (entrega) entrega.checked = CONFIG.delivery.entregaAtiva;
  const retirada = document.getElementById("cfg-retirada-ativa");
  if (retirada) retirada.checked = CONFIG.delivery.retiradaAtiva;
  const aberto = document.getElementById("cfg-loja-aberta");
  if (aberto) aberto.checked = CONFIG.funcionamento.aberto;
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
    CONFIG.loja.logo = g("cfg-logo"); CONFIG.loja.logoUrl = g("cfg-logoUrl");
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
    CONFIG.funcionamento.aberto = document.getElementById("cfg-loja-aberta")?.checked;
    const novaSenhaAdm = g("cfg-senha-adm");
    const novaSenhaConf = g("cfg-senha-conf");
    if (novaSenhaAdm) CONFIG.senha.admin = novaSenhaAdm;
    if (novaSenhaConf) CONFIG.senha.confirmacoes = novaSenhaConf;
    STORAGE.salvarConfig();
    UTIL.aplicarCores();
    renderizarAdmin();
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
    const tamanhosSel = document.getElementById("prod-tamanhos");
    const tamanhos = tamanhosSel ? [...tamanhosSel.selectedOptions].map(o => o.value) : [];
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
    };
    if (!dados.nome || !dados.preco) { MODAL.erro(ENUMS.MSGS.CAMPO_OBRIGATORIO); return; }
    if (id) { PRODUTOS.editar(id, dados); } else { PRODUTOS.criar(dados); }
    form.reset();
    document.getElementById("form-produto-id").value = "";
    document.getElementById("form-produto-titulo").textContent = "Novo Produto";
    document.getElementById("prod-complementos-area").style.display = "none";
    TABS.ir("sec-produtos", "tab-produtos-lista");
    MODAL.sucesso(ENUMS.MSGS.PRODUTO_SALVO);
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
    const dados = {
      nome,
      preco: parseFloat(g("comp-preco")) || 0,
      estoque: g("comp-estoque") !== "" ? parseInt(g("comp-estoque")) : "",
    };
    if (id) { COMPLEMENTOS.editar(id, dados); } else { COMPLEMENTOS.criar(dados); }
    form.reset();
    document.getElementById("comp-id").value = "";
    document.getElementById("form-comp-titulo").textContent = "Novo Complemento";
    TABS.ir("sec-complementos", "tab-complementos-lista");
    MODAL.sucesso(ENUMS.MSGS.COMPLEMENTO_SALVO);
  });
}

function bindCarrinhoFinalizacao() {
  document.querySelectorAll('input[name="tipo-entrega"]').forEach(r => {
    r.addEventListener("change", () => {
      const isEntrega = r.value === ENUMS.TIPO_ENTREGA.ENTREGA;
      const enderecoArea = document.getElementById("area-endereco");
      if (enderecoArea) enderecoArea.style.display = isEntrega ? "block" : "none";
      CARRINHO._atualizarTotais();
    });
  });
  document.getElementById("btn-finalizar")?.addEventListener("click", () => {
    const nome = document.getElementById("cliente-nome")?.value?.trim();
    const tel = document.getElementById("cliente-telefone")?.value?.trim();
    const tipoEntrega = document.querySelector('input[name="tipo-entrega"]:checked')?.value;
    const pag = document.getElementById("cliente-pagamento")?.value;
    const endereco = document.getElementById("cliente-endereco")?.value?.trim();
    if (tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA && !endereco) {
      MODAL.erro("Informe o endereço de entrega.");
      return;
    }
    WPP.enviar({ nome, telefone: tel }, tipoEntrega, pag, endereco);
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
  }
});