// ============================================================
// models.js — Modelos Mongoose (Multi-Tenant)
// Todos os schemas possuem empresaId para isolamento total.
// ============================================================
const mongoose = require("mongoose");

// ── PRODUTO ──────────────────────────────────────────────────
// Representa cada produto cadastrado pela empresa
const ProdutoSchema = new mongoose.Schema({
  empresaId:              { type: String, required: true, index: true },
  id:                     { type: String, required: true },
  nome:                   { type: String, required: true },
  descricao:              { type: String, default: "" },
  imagem:                 { type: String, default: "" }, // URL ou base64
  emoji:                  { type: String, default: "" },
  categoria:              { type: String, default: "" },
  preco:                  { type: Number, required: true },
  unidade:                { type: String, default: "" },
  tamanhos:               [String],
  estoque:                { type: mongoose.Schema.Types.Mixed, default: "" },
  validade:               { type: String, default: "" },
  ativo:                  { type: Boolean, default: true },
  temComplementos:        { type: Boolean, default: false },
  complementosVinculados: [String],
  dataCriacao:            { type: String, default: () => new Date().toISOString() },
  vendas:                 { type: Number, default: 0 },
  // ── Estoque-Base (produtos por peso) ──────────────────────
  usaEstoqueBase:         { type: Boolean, default: false },       // true = produto por peso
  estoqueBaseId:          { type: String, default: "" },           // ID do EstoqueBase vinculado
  consumoPorVenda:        { type: Number, default: 0 },            // quanto consome do base por venda (em g ou ml)
}, { timestamps: true });

ProdutoSchema.index({ empresaId: 1, id: 1 }, { unique: true });

// ── ESTOQUE-BASE ─────────────────────────────────────────────
// Representa o estoque compartilhado por múltiplos produtos (ex: Açaí 20kg)
const MovimentacaoSchema = new mongoose.Schema({
  data:       { type: String, default: () => new Date().toISOString() },
  tipo:       { type: String, enum: ["entrada", "saida", "ajuste"] }, // tipo de movimentação
  quantidade: Number,     // valor movimentado
  descricao:  String,     // motivo/descrição
  pedidoId:   String,     // referência ao pedido, se houver
}, { _id: false });

const EstoqueBaseSchema = new mongoose.Schema({
  empresaId:    { type: String, required: true, index: true },
  id:           { type: String, required: true },
  nome:         { type: String, required: true },               // Ex: "Açaí"
  unidade:      { type: String, enum: ["kg", "L"], default: "kg" }, // Kg ou Litros
  quantidade:   { type: Number, default: 0 },                   // quantidade atual
  movimentacoes: [MovimentacaoSchema],                           // histórico completo
}, { timestamps: true });

EstoqueBaseSchema.index({ empresaId: 1, id: 1 }, { unique: true });

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
  unidade:      String,  // ex: "ml", "L", "kg", "g" — usado para desconto automático do Estoque-Base
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
  cliente:        { nome: String, telefone: String },
  itens:          [ItemPedidoSchema],
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
  Produto:      mongoose.model("Produto",      ProdutoSchema),
  EstoqueBase:  mongoose.model("EstoqueBase",  EstoqueBaseSchema),
  Categoria:    mongoose.model("Categoria",    CategoriaSchema),
  Complemento:  mongoose.model("Complemento",  ComplementoSchema),
  Pedido:       mongoose.model("Pedido",       PedidoSchema),
  Config:       mongoose.model("Config",       ConfigSchema),
};
