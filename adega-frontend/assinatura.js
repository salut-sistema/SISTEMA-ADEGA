// ============================================================
//  assinatura.js — Aviso de Assinatura (menu lateral do Admin)
// ============================================================
//  Módulo independente, responsável apenas por controlar o card
//  de aviso de vencimento exibido no lugar do antigo botão
//  "Ver Catálogo" do menu lateral.
//
//  Não mexe em nenhuma outra funcionalidade do sistema.
//  Depende apenas de:
//    • AUTH.vencimento()  → data de vencimento já enviada pelo
//                            backend no login (empresas.config.js)
//    • PAGAMENTO_CONFIG    → config/pagamento.config.js
// ============================================================

const AVISO_ASSINATURA = {

  // ── Calcula quantos dias faltam para o vencimento ───────────
  // Retorna:
  //   > 1   → ainda falta mais de 1 dia (aviso não aparece)
  //   1     → falta exatamente 1 dia (aviso "vence amanhã")
  //   <= 0  → hoje é o vencimento ou já venceu (aviso "vence hoje")
  //   null  → sem data de vencimento cadastrada (aviso não aparece)
  _diasParaVencimento(vencimentoStr) {
    if (!vencimentoStr) return null;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const venc = new Date(vencimentoStr + "T00:00:00");
    if (isNaN(venc.getTime())) return null;

    const diffMs = venc.getTime() - hoje.getTime();
    return Math.round(diffMs / 86400000); // 86400000ms = 1 dia
  },

  // ── Monta o HTML do bloco de PIX (usado apenas no dia do vencimento) ──
  _montarBlocoPix() {
    const pix = (window.PAGAMENTO_CONFIG && window.PAGAMENTO_CONFIG.pix) || {};
    let html = '<div class="aviso-assinatura-pix">';

    if (pix.qrCodeImagem) {
      html += `<img src="${pix.qrCodeImagem}" alt="QR Code PIX" class="aviso-assinatura-qrcode">`;
    }
    if (pix.chave) {
      html += `<div class="aviso-assinatura-pix-linha"><b>Chave PIX:</b> ${pix.chave}</div>`;
    }
    if (pix.nomeRecebedor) {
      html += `<div class="aviso-assinatura-pix-linha"><b>Recebedor:</b> ${pix.nomeRecebedor}</div>`;
    }
    if (pix.valor) {
      html += `<div class="aviso-assinatura-pix-linha"><b>Valor:</b> R$ ${Number(pix.valor).toFixed(2).replace(".", ",")}</div>`;
    }
    if (pix.codigoCopiaCola) {
      html += `<div class="aviso-assinatura-copiacola" title="Código copia e cola">${pix.codigoCopiaCola}</div>`;
    }

    html += "</div>";
    return html;
  },

  // ── Atualiza (mostra/esconde) o card no menu lateral ─────────
  // Chamado após o login e após a restauração automática de sessão.
  atualizar() {
    const el = document.getElementById("aviso-assinatura");
    if (!el) return; // componente não existe nesta tela

    try {
      const vencimento = (typeof AUTH !== "undefined" && AUTH.vencimento) ? AUTH.vencimento() : null;
      const dias = this._diasParaVencimento(vencimento);
      const msgs = (window.PAGAMENTO_CONFIG && window.PAGAMENTO_CONFIG.mensagens) || {};

      // Sem vencimento cadastrado ou faltando mais de 1 dia → aviso oculto
      if (dias === null || dias > 1) {
        el.style.display = "none";
        el.innerHTML = "";
        return;
      }

      if (dias === 1) {
        // ── Falta 1 dia: aviso amarelo/laranja ──────────────────
        el.className = "aviso-assinatura aviso-assinatura--amanha";
        el.innerHTML = `
          <div class="aviso-assinatura-icone">⚠️</div>
          <div class="aviso-assinatura-texto">${msgs.avisoUmDia || "Sua assinatura vence amanhã."}</div>
        `;
      } else {
        // ── Vence hoje ou já venceu: aviso vermelho + PIX ───────
        el.className = "aviso-assinatura aviso-assinatura--vencido";
        el.innerHTML = `
          <div class="aviso-assinatura-icone">🚨</div>
          <div class="aviso-assinatura-texto">${msgs.avisoVencido || "Sua assinatura venceu."}</div>
          ${this._montarBlocoPix()}
        `;
      }

      el.style.display = "flex";
    } catch (e) {
      // Erro no aviso nunca deve quebrar o restante do painel
      console.error("Aviso de Assinatura: erro ao atualizar.", e);
    }
  },
};

window.AVISO_ASSINATURA = AVISO_ASSINATURA;
