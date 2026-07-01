// ============================================================
//  config/pagamento.config.js
//  Configuração do "Aviso de Assinatura" (menu lateral do Admin)
// ============================================================
//  Este arquivo centraliza tudo que pode precisar ser alterado
//  no futuro sem precisar mexer no restante do código:
//
//    • Mensagens exibidas no card de aviso
//    • Dados do PIX (chave, copia-e-cola, recebedor, valor)
//    • Caminho da imagem do QR Code
//
//  A DATA DE VENCIMENTO NÃO fica aqui — ela já existe no cadastro
//  da empresa (arquivo empresas.config.js do backend, campo
//  "vencimento") e é enviada para o painel automaticamente no
//  login. Não duplique essa informação aqui.
// ============================================================

const PAGAMENTO_CONFIG = {

  // ── MENSAGENS DO SISTEMA ────────────────────────────────────
  // ✏️ ALTERE AQUI o texto exibido em cada situação do aviso.
  mensagens: {
    // Exibida quando falta exatamente 1 dia para o vencimento
    avisoUmDia:
      "Atenção! Sua assinatura vence amanhã. Renove para não perder o acesso ao sistema.",

    // Exibida no próprio dia do vencimento (junto com o QR Code do PIX)
    avisoVencido:
      " Alerta de assinatura ",
  },

  // ── DADOS DO PIX ─────────────────────────────────────────────
  // ✏️ ALTERE AQUI a chave PIX, o nome do recebedor, o código
  // "copia e cola" e o valor da cobrança, quando necessário.
  pix: {
    chave: "11959175925",          // chave PIX exibida no aviso do dia do vencimento
    nomeRecebedor: "",              // nome de quem recebe o PIX (opcional)
    codigoCopiaCola: "",            // código "PIX copia e cola" (opcional)
    valor: null,                    // valor da cobrança em R$, ex: 49.90 (opcional)

    // ✏️ ALTERE AQUI o caminho da imagem do QR Code do PIX.
    // Pode ser um caminho local (ex: "assets/qrcode-pix.png") ou uma URL.
    // Deixe em branco ("") para não exibir a imagem do QR Code.
    qrCodeImagem: "config/img.jpeg/QRCODE-59-90.jpeg",
  },
};

// Disponibiliza a configuração globalmente para os demais scripts
window.PAGAMENTO_CONFIG = PAGAMENTO_CONFIG;
