/**
 * ATENÇÃO
 *
 * Este arquivo contém os cadastros reais das empresas do sistema.
 *
 * Nunca apagar, substituir ou recriar este arquivo durante atualizações.
 *
 * Sempre preservar todos os registros existentes e apenas adicionar
 * novos campos ou funcionalidades quando necessário.
 *
 * Atualizações futuras devem manter 100% dos dados já cadastrados.
 */

// ============================================================
// empresas.config.js — ARQUIVO INTERNO DO CRIADOR DO SISTEMA
// Gerenciado apenas pelo desenvolvedor, sem interface gráfica.
// Adicione, remova ou bloqueie empresas aqui.
// ============================================================

const EMPRESAS = [

  {
    empresaId:  "kleber-001",
    nome:       "kleber ",
    login:      "kleber",
    senha:      "kleber",
    ativo:      true,                        // false = acesso bloqueado
    vencimento: null,                        // "2025-12-31" ou null = sem vencimento
    endereco:   "", // endereço da empresa
    slug:       "kleber-Demostração",              // link exclusivo: /loja/kleber-adega
  },

  // ── EMPRESA 1 ─────────────────────────────────────────────
  {
    empresaId:  "adega-001",
    nome:       "Adega do João",
    login:      "adega001",
    senha:      "adega001@2025",
    ativo:      true,                        // false = acesso bloqueado
    vencimento: null,                        // "2025-12-31" ou null = sem vencimento
    endereco:   "",                          // endereço da empresa
    slug:       "adega-joao",               // link exclusivo: /loja/adega-joao
  },

  // ── EMPRESA 2 ─────────────────────────────────────────────
  {
    empresaId:  "rhuan-001",
    nome:       "rhuan",
    login:      "rhuan",
    senha:      "rhuan",
    ativo:      true,
    vencimento: null,
    endereco:   "",                          // endereço da empresa
    slug:       "rhuan-vendedor-Demosntração",          // link exclusivo: /loja/bomboniere-maria
  },

  {
    empresaId:  "ma-1",
    nome:       "marcia sampaio",
    login:      "ma",
    senha:      "ma",
    ativo:      true,
    vencimento: "2026-08-08",
    endereco:   "",                          // endereço da empresa
    slug:       "Point-morenas",          // link exclusivo: /loja/bomboniere-maria
  },

  {
    empresaId:  "leandro-1",
    nome:       "leandro nascimento",
    login:      "leandro",
    senha:      "leandro",
    ativo:      true,
    vencimento: "2026-08-11",
    endereco:   "",                          // endereço da empresa
    slug:       "pizzaria",          // link exclusivo: /loja/bomboniere-maria
  },


  // ── TEMPLATE PARA NOVA EMPRESA (copie e preencha) ─────────
  // {
  //   empresaId:  "nova-001",
  //   nome:       "Nome da Loja",
  //   login:      "novaempresa",
  //   senha:      "senha@2025",
  //   ativo:      true,
  //   vencimento: null,                     // "2026-12-31" ou null = sem vencimento
  //   endereco:   "Rua Exemplo, nº 00",
  //   slug:       "nome-da-loja",
  // },
];

module.exports = EMPRESAS;
