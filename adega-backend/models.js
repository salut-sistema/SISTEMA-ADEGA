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
  tamanhos:               [{ volume: String, preco: { type: Number, default: 0 }, estoque: { type: Number, default: 0 } }],
  estoque:                { type: mongoose.Schema.Types.Mixed, default: "" },
  validade:               { type: String, default: "" },
  ativo:                  { type: Boolean, default: true },
  temComplementos:        { type: Boolean, default: false },
  complementosVinculados: [String],
  dataCriacao:            { type: String, default: () => new Date().toISOString() },
  vendas:                 { type: Number, default: 0 },
  // true = o "ativo:false" atual foi setado pelo SISTEMA (estoque zerou),
  // não pelo admin. Usado pra reativação automática nunca sobrescrever
  // uma pausa manual — ver _sincronizarPausaAutomatica().
  pausadoAutomaticamente: { type: Boolean, default: false },
  // ── Estoque-Base (produtos por peso) ──────────────────────
  usaEstoqueBase:         { type: Boolean, default: false },       // true = produto por peso
  estoqueBaseId:          { type: String, default: "" },           // ID do EstoqueBase vinculado
  consumoPorVenda:        { type: Number, default: 0 },            // quanto consome do base por venda (em g ou ml)
}, { timestamps: true });

ProdutoSchema.index({ empresaId: 1, id: 1 }, { unique: true });
// Acelera listagens filtradas por "ativo" ordenadas por data de criação
// (catálogo da loja pública, listas administrativas) — sem isso, o banco
// tem que examinar TODOS os produtos da empresa pra depois filtrar os
// ativos e ordenar; com o índice, ele já pega só o que precisa, em ordem.
ProdutoSchema.index({ empresaId: 1, ativo: 1, dataCriacao: 1 });

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
// Acelera a listagem pública da loja (categorias ativas, em ordem de exibição)
CategoriaSchema.index({ empresaId: 1, ativo: 1, ordem: 1 });

// ── COMPLEMENTO ───────────────────────────────────────────────
const ComplementoSchema = new mongoose.Schema({
  empresaId:      { type: String, required: true, index: true },
  id:             { type: String, required: true },
  nome:           { type: String, required: true },
  preco:          { type: Number, default: 0 },
  estoque:        { type: mongoose.Schema.Types.Mixed, default: "" },
  ativo:          { type: Boolean, default: true },
  // ── Desconto de Estoque-Base ───────────────────────────────
  usaEstoqueBase: { type: Boolean, default: false },    // true = desconta do estoque-base ao vender
  estoqueBaseId:  { type: String, default: "" },         // ID do EstoqueBase vinculado
  consumoUnidade: { type: String, default: "" },         // "g", "kg" ou "ml"
  consumoQtd:     { type: Number, default: 0 },          // quantidade consumida por pedido
}, { timestamps: true });

ComplementoSchema.index({ empresaId: 1, id: 1 }, { unique: true });
// Acelera a listagem pública da loja (só complementos ativos)
ComplementoSchema.index({ empresaId: 1, ativo: 1 });

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
  numeroPedido:   { type: Number },   // número sequencial exibido ao usuário (001, 002, 003...), por empresa
  status:         { type: String, default: "pendente" },
  tipoEntrega:    String,
  formaPagamento: String,
  endereco:       String,
  total:          Number,
  subtotal:       Number,
  taxaEntrega:    Number,
  data:           {
    // Tipo real Date (antes era String). O Mongoose converte automaticamente
    // strings ISO ("2025-06-12T14:30:00.000Z") para Date ao salvar — o
    // frontend já envia data nesse formato, então NENHUMA mudança é
    // necessária em quem cria pedidos, nem na loja nem no admin.
    // Documentos antigos (já gravados como string no banco) são
    // convertidos por uma migração que roda sozinha ao iniciar o servidor
    // — ver adega-backend/migrations/migrar-data-pedidos.js.
    type: Date, default: () => new Date(),
  },
  cliente:        { nome: String, telefone: String },
  itens:          [ItemPedidoSchema],
  // "loja" = pedido feito pelo cliente | "manual" = venda registrada pelo admin (balcão/presencial)
  origem:         { type: String, default: "loja" },

  // ── Exclusão lógica (soft delete) ─────────────────────────────
  // Quando o admin exclui um pedido em "Pedidos Recebidos", o registro
  // NUNCA é apagado do banco — apenas marcado como excluído. Isso mantém
  // a aba "Histórico de Vendas" como uma trilha de auditoria confiável
  // (controle de fraude), com todas as informações originais preservadas.
  excluido:       { type: Boolean, default: false },
  dataExclusao:   { type: String, default: null },
}, { timestamps: true });

PedidoSchema.index({ empresaId: 1, id: 1 }, { unique: true });
// Ordenação "mais recente primeiro" da lista principal (Pedidos Recebidos),
// já considerando o filtro por excluído que a tela sempre aplica.
PedidoSchema.index({ empresaId: 1, excluido: 1, data: -1 });
// Filtro por status (ex: só "pendente") + ordenação por data — usado em
// telas/relatórios que filtram pedidos por etapa do fluxo.
PedidoSchema.index({ empresaId: 1, status: 1, data: -1 });

// ── CONTADOR — usado para gerar o número sequencial do pedido (por empresa) ──
// Incrementado de forma atômica (evita números repetidos mesmo com pedidos
// simultâneos). Nunca reaproveita números, mesmo se um pedido for excluído.
const ContadorSchema = new mongoose.Schema({
  empresaId: { type: String, required: true },
  tipo:      { type: String, required: true, default: "pedido" },
  valor:     { type: Number, default: 0 },
});
ContadorSchema.index({ empresaId: 1, tipo: 1 }, { unique: true });

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
  Contador:     mongoose.model("Contador",     ContadorSchema),
};
