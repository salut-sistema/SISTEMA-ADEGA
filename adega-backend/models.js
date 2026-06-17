// ============================================================
// models.js — Modelos Mongoose para o Sistema de Adega (Multi-Tenant)
// Todos os modelos possuem empresaId para isolamento total de dados.
// ============================================================
const mongoose = require("mongoose");

// ── PRODUTO ──────────────────────────────────────────────────
const ProdutoSchema = new mongoose.Schema({
  empresaId:           { type: String, required: true, index: true },
  id:                  { type: String, required: true },
  nome:                { type: String, required: true },
  descricao:           { type: String, default: "" },
  imagem:              { type: String, default: "" },
  emoji:               { type: String, default: "" },
  categoria:           { type: String, default: "" },
  preco:               { type: Number, required: true },
  unidade:             { type: String, default: "" },
  tamanhos:            [String],
  estoque:             { type: mongoose.Schema.Types.Mixed, default: "" },
  validade:            { type: String, default: "" },
  ativo:               { type: Boolean, default: true },
  temComplementos:     { type: Boolean, default: false },
  complementosVinculados: [String],
  dataCriacao:         { type: String, default: () => new Date().toISOString() },
  vendas:              { type: Number, default: 0 },
}, { timestamps: true });

// id único por empresa (não globalmente)
ProdutoSchema.index({ empresaId: 1, id: 1 }, { unique: true });

// ── CATEGORIA ─────────────────────────────────────────────────
const CategoriaSchema = new mongoose.Schema({
  empresaId: { type: String, required: true, index: true },
  id:        { type: String, required: true },
  nome:      { type: String, required: true },
  emoji:     { type: String, default: "" },
  cor:       { type: String, default: "#7B2FBE" },
  frase:     { type: String, default: "" },
  ativo:     { type: Boolean, default: true },
  ordem:     { type: Number, default: 0 },
}, { timestamps: true });

CategoriaSchema.index({ empresaId: 1, id: 1 }, { unique: true });

// ── COMPLEMENTO ───────────────────────────────────────────────
const ComplementoSchema = new mongoose.Schema({
  empresaId: { type: String, required: true, index: true },
  id:        { type: String, required: true },
  nome:      { type: String, required: true },
  preco:     { type: Number, default: 0 },
  estoque:   { type: mongoose.Schema.Types.Mixed, default: "" },
  ativo:     { type: Boolean, default: true },
}, { timestamps: true });

ComplementoSchema.index({ empresaId: 1, id: 1 }, { unique: true });

// ── PEDIDO ────────────────────────────────────────────────────
const ItemPedidoSchema = new mongoose.Schema({
  id:           String,
  produtoId:    String,
  nome:         String,
  preco:        Number,
  imagem:       String,
  quantidade:   Number,
  tamanho:      String,
  complementos: [{ id: String, nome: String, preco: Number }],
  observacao:   String,
}, { _id: false });

const PedidoSchema = new mongoose.Schema({
  empresaId:      { type: String, required: true, index: true },
  id:             { type: String, required: true },
  status:         { type: String, default: "pendente" },
  tipoEntrega:    String,
  formaPagamento: String,
  endereco:       String,
  total:          Number,
  subtotal:       Number,
  taxaEntrega:    Number,
  data:           { type: String, default: () => new Date().toISOString() },
  cliente: {
    nome:     String,
    telefone: String,
  },
  itens: [ItemPedidoSchema],
}, { timestamps: true });

PedidoSchema.index({ empresaId: 1, id: 1 }, { unique: true });

// ── CONFIGURAÇÃO DA LOJA ──────────────────────────────────────
const ConfigSchema = new mongoose.Schema({
  empresaId:     { type: String, required: true, unique: true, index: true },
  chave:         { type: String, default: "principal" },
  loja:          { type: Object, default: {} },
  contato:       { type: Object, default: {} },
  funcionamento: { type: Object, default: {} },
  delivery:      { type: Object, default: {} },
  senha:         { type: Object, default: {} },
  pagamento:     { type: Object, default: {} },
}, { timestamps: true });

module.exports = {
  Produto:     mongoose.model("Produto",     ProdutoSchema),
  Categoria:   mongoose.model("Categoria",   CategoriaSchema),
  Complemento: mongoose.model("Complemento", ComplementoSchema),
  Pedido:      mongoose.model("Pedido",      PedidoSchema),
  Config:      mongoose.model("Config",      ConfigSchema),
};
