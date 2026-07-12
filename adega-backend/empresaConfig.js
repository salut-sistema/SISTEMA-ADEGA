/**
 * ============================================================
 * empresaConfig.js — Configuração interna do sistema
 * ============================================================
 *
 * Este arquivo centraliza a SENHA MASTER utilizada para proteger
 * ações sensíveis do painel administrativo (ex: alterações manuais
 * de estoque, exclusões e salvamento de configurações).
 *
 * Para trocar a senha master do sistema, altere APENAS o valor abaixo.
 * Nenhum outro arquivo precisa ser modificado.
 *
 * Nunca exponha este arquivo ou seu valor ao frontend/cliente —
 * toda validação da senha master deve ser feita no backend.
 * ============================================================
 */

const EMPRESA_CONFIG = {
  // Senha master única, usada por todas as validações do sistema
  SENHA_MASTER: "123",
};

module.exports = EMPRESA_CONFIG;
