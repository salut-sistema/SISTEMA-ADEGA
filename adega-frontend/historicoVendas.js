// ============================================================
//  historicoVendas.js — Histórico de Vendas (Admin > Pedidos)
// ============================================================
//  Módulo independente, dentro da aba "Pedidos".
//
//  NÃO cria nenhuma funcionalidade paralela — apenas reaproveita:
//    • STATE.pedidos          — mesma fonte de dados de sempre
//    • cardPedido()           — mesmo card usado em "Pedidos Recebidos" (app.js)
//    • botão "⬇️ Exportar"    — passa a usar HISTORICO.listaFiltrada()
//                                 (ver função exportarPedidos() em admin.html)
//
//  Lista TODOS os pedidos, sejam feitos pela loja ou como venda
//  presencial (campo "origem" em models.js), com filtros opcionais.
// ============================================================

const HISTORICO = {

  // Estado atual dos filtros (mantido enquanto o admin navega entre abas)
  filtros: { texto: "", status: "todos", origem: "todos", dataIni: "", dataFim: "" },

  // ── Retorna os pedidos já filtrados e ordenados (mais recente primeiro) ──
  // Usada tanto para renderizar a lista quanto para o botão Exportar.
  listaFiltrada() {
    const f = this.filtros;
    return [...(STATE.get("pedidos") || [])]
      .filter(p => {
        if (f.texto && !(p.cliente?.nome || "").toLowerCase().includes(f.texto.toLowerCase())) return false;
        if (f.status !== "todos" && p.status !== f.status) return false;
        if (f.origem !== "todos") {
          const origemPedido = p.origem === "manual" ? "manual" : "loja";
          if (origemPedido !== f.origem) return false;
        }
        const dataPedido = (p.data || p.createdAt || "").slice(0, 10);
        if (f.dataIni && dataPedido < f.dataIni) return false;
        if (f.dataFim && dataPedido > f.dataFim) return false;
        return true;
      })
      .sort((a, b) => {
        const da = new Date(a.data || a.createdAt || 0).getTime();
        const db = new Date(b.data || b.createdAt || 0).getTime();
        return db - da;
      });
  },

  // ── Renderiza a lista na tela — reaproveita cardPedido() (app.js) ────
  renderizar() {
    const container = document.getElementById("historico-vendas-lista");
    if (!container) return;
    const lista = this.listaFiltrada();
    container.innerHTML = lista.length
      ? lista.map(p => (typeof cardPedido === "function" ? cardPedido(p, true) : "")).join("")
      : `<p class="sem-dados">Nenhum pedido encontrado.</p>`;
  },

  // ── Chamado sempre que a aba "Histórico de Vendas" é aberta ──────────
  abrir() {
    const campos = { texto: "hv-busca", status: "hv-status", origem: "hv-origem", dataIni: "hv-data-ini", dataFim: "hv-data-fim" };
    Object.entries(campos).forEach(([chave, id]) => {
      const el = document.getElementById(id);
      if (el) el.value = this.filtros[chave];
    });
    this.renderizar();
  },

  // ── Limpa todos os filtros aplicados ──────────────────────────────────
  limparFiltros() {
    this.filtros = { texto: "", status: "todos", origem: "todos", dataIni: "", dataFim: "" };
    this.abrir();
  },

  // ── Liga os eventos dos campos de filtro ──────────────────────────────
  _bindEventos() {
    document.getElementById("hv-busca")?.addEventListener("input", e => { this.filtros.texto = e.target.value; this.renderizar(); });
    document.getElementById("hv-status")?.addEventListener("change", e => { this.filtros.status = e.target.value; this.renderizar(); });
    document.getElementById("hv-origem")?.addEventListener("change", e => { this.filtros.origem = e.target.value; this.renderizar(); });
    document.getElementById("hv-data-ini")?.addEventListener("change", e => { this.filtros.dataIni = e.target.value; this.renderizar(); });
    document.getElementById("hv-data-fim")?.addEventListener("change", e => { this.filtros.dataFim = e.target.value; this.renderizar(); });
  },
};
window.HISTORICO = HISTORICO;

// Abre a aba automaticamente quando o admin clica em "Histórico de Vendas"
// (reaproveita o CustomEvent "tabchange" já disparado por TABS.init em app.js)
document.addEventListener("tabchange", e => {
  if (e.detail?.tab === "tab-historico-vendas") HISTORICO.abrir();
});

// Liga os eventos assim que o painel admin estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("pagina-admin")) {
    HISTORICO._bindEventos();
  }
});
