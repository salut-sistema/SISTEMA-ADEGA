// ============================================================
//  vendaManual.js — Venda Manual (Balcão / Presencial)
// ============================================================
//  Módulo independente, dentro da aba "Pedidos" do Admin.
//
//  NÃO duplica nenhuma lógica existente — apenas orquestra o que
//  já existe no sistema:
//    • Catálogo:  renderizarCategorias() / renderizarProdutos() /
//                 cardProduto() / abrirModalProduto() (app.js)
//    • Carrinho:  objeto CARRINHO — adicionar, remover, totais (app.js)
//    • Pedido:    API_PEDIDOS.criar() — MESMA rota autenticada que já
//                 existe no backend (routes/index.js), que desconta
//                 estoque, soma vendas e entra automaticamente no
//                 Dashboard/Faturamento. Nenhuma lógica nova de
//                 estoque, preço ou faturamento é criada aqui.
// ============================================================

const VENDA_MANUAL = {

  // ── Chamado sempre que a aba "Venda Manual" é aberta ─────────
  abrir() {
    STATE.set("categoriaFiltro", "todos");
    STATE.set("buscaTermo", "");
    const buscaEl = document.getElementById("venda-busca-input");
    if (buscaEl) buscaEl.value = "";

    renderizarCategorias(); // mesma função usada na Loja do Cliente
    renderizarProdutos();   // mesma função usada na Loja do Cliente
    CARRINHO.atualizarUI();
    this._popularClientes();

    // Mesma regra da Loja do Cliente: some com a opção desativada pelo admin
    const opcEntrega  = document.getElementById("opc-entrega");
    const opcRetirada = document.getElementById("opc-retirada");
    if (opcEntrega)  opcEntrega.style.display  = CONFIG.delivery?.entregaAtiva  === false ? "none" : "";
    if (opcRetirada) opcRetirada.style.display = CONFIG.delivery?.retiradaAtiva === false ? "none" : "";
  },

  // ── Lista de "clientes já atendidos" — reaproveita o histórico de   ──
  // pedidos existente (STATE.pedidos). Não cria nenhum cadastro novo.
  _popularClientes() {
    const sel = document.getElementById("venda-cliente-select");
    if (!sel) return;

    const pedidos = STATE.get("pedidos") || [];
    const vistos = new Map();
    pedidos.forEach(p => {
      const nome = p.cliente?.nome?.trim();
      if (!nome || nome === "Cliente Balcão") return;
      const chave = (p.cliente?.telefone || nome).trim();
      if (!vistos.has(chave)) vistos.set(chave, { nome, telefone: p.cliente?.telefone || "" });
    });

    const opcoes = [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome));
    sel.innerHTML =
      `<option value="">🧑 Venda sem cliente / Novo cliente</option>` +
      opcoes.map(c =>
        `<option value="${UTIL.sanitize(c.nome)}|${UTIL.sanitize(c.telefone)}">${UTIL.sanitize(c.nome)}${c.telefone ? " — " + c.telefone : ""}</option>`
      ).join("");
  },

  // ── Preenche nome/telefone ao escolher um cliente já existente ──────
  selecionarCliente(valor) {
    const [nome, telefone] = valor ? valor.split("|") : ["", ""];
    const nomeEl = document.getElementById("cliente-nome");
    const telEl  = document.getElementById("cliente-telefone");
    if (nomeEl) nomeEl.value = nome || "";
    if (telEl)  telEl.value  = telefone || "";
  },

  // ── Confirma a venda: monta o pedido no MESMO formato usado ─────────
  // pelo fluxo da loja (WPP.enviar) e salva pela rota autenticada
  // já existente (API_PEDIDOS.criar), sem duplicar regras de preço,
  // estoque ou taxa de entrega (tudo calculado por CONFIG/CARRINHO,
  // já usados pelo restante do sistema).
  async confirmar() {
    const carrinho = STATE.get("carrinho");
    if (!carrinho.length) { MODAL.erro(ENUMS.MSGS.CARRINHO_VAZIO); return; }

    const nome            = document.getElementById("cliente-nome")?.value?.trim() || "Cliente Balcão";
    const telefone        = document.getElementById("cliente-telefone")?.value?.trim() || "";
    const tipoEntrega     = document.querySelector('input[name="tipo-entrega"]:checked')?.value || ENUMS.TIPO_ENTREGA.RETIRADA;
    const formaPagamento  = document.getElementById("cliente-pagamento")?.value || "Dinheiro";
    const endereco        = document.getElementById("cliente-endereco")?.value?.trim() || "";

    if (tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA && !endereco) {
      MODAL.erro("Informe o endereço de entrega.");
      return;
    }

    const subtotal = CARRINHO.total();
    const taxa = (tipoEntrega === ENUMS.TIPO_ENTREGA.ENTREGA && CONFIG.delivery?.entregaAtiva)
      ? (CONFIG.delivery.taxaEntrega || 0) : 0;

    // Mesmo "formato de pedido" usado pela loja (id, status, cliente, itens...)
    const pedido = {
      id:           UTIL.id(),
      status:       ENUMS.STATUS_PEDIDO.PENDENTE,
      tipoEntrega,
      formaPagamento,
      endereco,
      subtotal,
      taxaEntrega:  taxa,
      total:        subtotal + taxa,
      data:         new Date().toISOString(),
      cliente:      { nome, telefone },
      itens:        [...carrinho],
      origem:       "manual", // identifica venda registrada pelo admin (balcão)
    };

    try {
      // Mesma API autenticada já usada pelo restante do painel (api.js).
      // O backend já desconta estoque e soma vendas (routes/index.js).
      await API_PEDIDOS.criar(pedido);

      // Recarrega os dados do backend — mesmo padrão já usado no polling (api.js)
      const [pedidos, produtos, estoquesBases] = await Promise.all([
        API_PEDIDOS.listar(),
        API_PRODUTOS.listar(),
        API_ESTOQUE_BASE.listar(),
      ]);
      STATE.set("pedidos", pedidos || []);
      STATE.set("produtos", produtos || []);
      STATE.set("estoquesBases", estoquesBases || []);

      // Atualiza as telas já existentes — nenhuma renderização nova é criada.
      if (typeof renderizarAdmin === "function") renderizarAdmin();           // Dashboard/Faturamento
      if (typeof renderizarAdmPedidos === "function") renderizarAdmPedidos(); // Pedidos Recebidos
      if (document.getElementById("tab-controle-estoque")?.classList.contains("ativo")
          && typeof renderizarControleEstoque === "function") renderizarControleEstoque();
      renderizarProdutos(); // catálogo da própria Venda Manual (estoque pode ter zerado/pausado)

      // Limpa o formulário para a próxima venda
      CARRINHO.limpar();
      fecharCarrinho();
      const nomeEl = document.getElementById("cliente-nome");
      const telEl  = document.getElementById("cliente-telefone");
      const selEl  = document.getElementById("venda-cliente-select");
      if (nomeEl) nomeEl.value = "";
      if (telEl)  telEl.value  = "";
      if (selEl)  selEl.value  = "";

      MODAL.sucesso("Venda registrada com sucesso! ✅");
    } catch (e) {
      // Erro na venda manual nunca deve travar o restante do painel
      console.error("Erro ao registrar venda manual:", e.message);
      MODAL.erro("Erro ao registrar a venda: " + e.message);
    }
  },

  // ── Liga os eventos da aba (rádio de entrega e botão de confirmar) ──
  // Os campos do formulário (rádio de tipo de entrega, endereço, etc.)
  // ficam dentro do painel #carrinho-panel (mesmo componente da Loja do
  // Cliente) — não dentro de #tab-venda-manual, que é só a aba do catálogo.
  _bindEventos() {
    document.querySelectorAll('#carrinho-panel input[name="tipo-entrega"]').forEach(r => {
      r.addEventListener("change", () => {
        const isEntrega = r.value === ENUMS.TIPO_ENTREGA.ENTREGA;
        const enderecoArea = document.getElementById("area-endereco");
        if (enderecoArea) enderecoArea.style.display = isEntrega ? "block" : "none";
        CARRINHO._atualizarTotais();
      });
    });
    document.getElementById("btn-finalizar-venda")?.addEventListener("click", () => this.confirmar());
    document.getElementById("venda-cliente-select")?.addEventListener("change", e => this.selecionarCliente(e.target.value));
  },
};

// Abre a aba automaticamente quando o admin clica em "Venda Manual"
// (reaproveita o CustomEvent "tabchange" já disparado por TABS.init em app.js)
document.addEventListener("tabchange", e => {
  if (e.detail?.tab === "tab-venda-manual") VENDA_MANUAL.abrir();
});

// Liga os eventos assim que o painel admin estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("pagina-admin")) {
    VENDA_MANUAL._bindEventos();
  }
});

window.VENDA_MANUAL = VENDA_MANUAL;
