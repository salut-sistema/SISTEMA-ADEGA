// ============================================================
// routes/index.js — Todas as rotas da API (Multi-Tenant)
// Todas as operações filtradas por empresaId.
// ============================================================
const express     = require("express");
const router      = express.Router();
const { Produto, EstoqueBase, Categoria, Complemento, Pedido, Config, Contador } = require("../models");
const { authMiddleware, EMPRESAS, empresaValida } = require("../middleware/auth");
const { SENHA_MASTER } = require("../empresasConfig");

// Helpers de resposta padronizada
const ok  = (res, data)         => res.json({ sucesso: true, data });
const err = (res, msg, st = 500) => res.status(st).json({ sucesso: false, erro: msg });

// ── Gerador de ID único simples ───────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Gerador do número sequencial do pedido (por empresa) ─────
// Atômico via $inc — seguro mesmo com pedidos simultâneos, e nunca
// repete ou reaproveita números (mesmo que um pedido seja excluído depois).
async function proximoNumeroPedido(empresaId) {
  const contador = await Contador.findOneAndUpdate(
    { empresaId, tipo: "pedido" },
    { $inc: { valor: 1 } },
    { upsert: true, new: true }
  );
  return contador.valor;
}

// ============================================================
// ROTAS PÚBLICAS (sem autenticação)
// ============================================================

// POST /api/login — autentica a empresa e retorna o token
router.post("/login", (req, res) => {
  const { login, senha } = req.body || {};
  if (!login || !senha) return err(res, "Login e senha obrigatórios", 400);

  const empresa = EMPRESAS.find(e => e.login === login && e.senha === senha);
  if (!empresa)          return err(res, "Credenciais inválidas", 401);
  if (!empresaValida(empresa)) return err(res, "Empresa bloqueada ou com acesso expirado", 403);

  // Token = base64(login:senha) — compatível com Basic Auth
  const token = Buffer.from(`${empresa.login}:${empresa.senha}`).toString("base64");
  // "vencimento" alimenta o card "Aviso de Assinatura" do menu lateral no painel admin
  ok(res, { token, empresaId: empresa.empresaId, nome: empresa.nome, slug: empresa.slug, endereco: empresa.endereco || "", vencimento: empresa.vencimento || null });
});

// GET /api/loja/:slug — carrega dados públicos da loja pelo slug
router.get("/loja/:slug", async (req, res) => {
  try {
    const empresa = EMPRESAS.find(e => e.slug === req.params.slug);
    if (!empresa || !empresaValida(empresa)) return err(res, "Loja não encontrada", 404);

    const [config, categorias, produtos, complementos] = await Promise.all([
      Config.findOne({ empresaId: empresa.empresaId }).lean(),
      Categoria.find({ empresaId: empresa.empresaId, ativo: true }).sort({ ordem: 1 }).lean(),
      Produto.find({ empresaId: empresa.empresaId, ativo: true }).sort({ dataCriacao: 1 }).lean(),
      Complemento.find({ empresaId: empresa.empresaId, ativo: true }).lean(),
    ]);

    ok(res, { empresaId: empresa.empresaId, nome: empresa.nome, slug: empresa.slug, endereco: empresa.endereco || "", config: config || {}, categorias, produtos, complementos });
  } catch (e) { err(res, e.message); }
});

// POST /api/pedidos/publico/:slug — cliente finaliza pedido pelo link da loja
// Rota pública que cria pedido e desconta estoque sem precisar de token de admin
router.post("/pedidos/publico/:slug", async (req, res) => {
  try {
    const empresa = EMPRESAS.find(e => e.slug === req.params.slug);
    if (!empresa || !empresaValida(empresa)) return err(res, "Loja não encontrada", 404);

    const eId = empresa.empresaId;
    const numeroPedido = await proximoNumeroPedido(eId);
    const pedido = await Pedido.create({ ...req.body, empresaId: eId, numeroPedido });

    // Desconta estoque de cada item do pedido
    await _descontarEstoque(eId, pedido.itens);

    ok(res, pedido);
  } catch (e) { err(res, e.message); }
});

// ── A partir daqui todas as rotas exigem autenticação ────────
router.use(authMiddleware);

// ============================================================
// SENHA MASTER — validação centralizada (valor vem de empresaConfig.js)
// Protege ações sensíveis do painel: alteração manual de estoque,
// exclusões e salvamento de configurações.
// ============================================================
router.post("/senha-master/validar", (req, res) => {
  const { senha } = req.body || {};
  const valida = !!senha && senha === SENHA_MASTER;
  ok(res, { valida });
});

// ============================================================
// PRODUTOS
// ============================================================

// GET /api/produtos — lista todos os produtos da empresa
router.get("/produtos", async (req, res) => {
  try { ok(res, await Produto.find({ empresaId: req.empresaId }).sort({ dataCriacao: 1 }).lean()); }
  catch (e) { err(res, e.message); }
});

// POST /api/produtos — cria novo produto
router.post("/produtos", async (req, res) => {
  try {
    // Normaliza tamanhos: aceita string[] ou {volume,preco}[]
    const tamanhos = (req.body.tamanhos || []).map(t =>
      typeof t === "string" ? { volume: t, preco: 0 } : t
    );
    ok(res, await Produto.create({
      ...req.body,
      tamanhos,
      ativo: true,           // garante sempre ativo ao criar
      empresaId: req.empresaId,
    }));
  }
  catch (e) { err(res, e.message); }
});

// PUT /api/produtos/:id — edita produto existente
router.put("/produtos/:id", async (req, res) => {
  try {
    // Normaliza tamanhos: aceita string[] ou {volume,preco}[]
    const tamanhos = (req.body.tamanhos || []).map(t =>
      typeof t === "string" ? { volume: t, preco: 0 } : { volume: String(t.volume || ""), preco: Number(t.preco) || 0 }
    );
    // Monta objeto de atualização sem sobrescrever campo ativo
    const { ativo, tamanhos: _t, ...resto } = req.body;
    const update = { $set: { ...resto, tamanhos } };
    const p = await Produto.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id },
      update,
      { new: true }
    );
    if (!p) return err(res, "Produto não encontrado", 404);
    ok(res, p);
  } catch (e) { err(res, e.message); }
});

// DELETE /api/produtos/:id — remove produto
router.delete("/produtos/:id", async (req, res) => {
  try {
    await Produto.deleteOne({ empresaId: req.empresaId, id: req.params.id });
    ok(res, { id: req.params.id });
  } catch (e) { err(res, e.message); }
});

// PATCH /api/produtos/:id/pausar — ativa/pausa produto
router.patch("/produtos/:id/pausar", async (req, res) => {
  try {
    const p = await Produto.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!p) return err(res, "Produto não encontrado", 404);
    p.ativo = !p.ativo;
    await p.save();
    ok(res, p);
  } catch (e) { err(res, e.message); }
});

// ============================================================
// ESTOQUE-BASE (produtos por peso)
// ============================================================

// GET /api/estoque-base — lista todos os estoques-base da empresa
router.get("/estoque-base", async (req, res) => {
  try { ok(res, await EstoqueBase.find({ empresaId: req.empresaId }).lean()); }
  catch (e) { err(res, e.message); }
});

// POST /api/estoque-base — cria novo estoque-base
router.post("/estoque-base", async (req, res) => {
  try {
    const { nome, unidade, quantidade } = req.body;
    const eb = await EstoqueBase.create({
      empresaId: req.empresaId,
      id: uid(),
      nome, unidade,
      quantidade: _round3(quantidade),
      movimentacoes: [{
        tipo: "entrada", quantidade: _round3(quantidade),
      }]
    });
    ok(res, eb);
  } catch (e) { err(res, e.message); }
});

// PUT /api/estoque-base/:id — edita estoque-base
router.put("/estoque-base/:id", async (req, res) => {
  try {
    const dados = { ...req.body };
    if (dados.quantidade !== undefined) dados.quantidade = _round3(dados.quantidade);
    const eb = await EstoqueBase.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id }, dados, { new: true }
    );
    if (!eb) return err(res, "Estoque-base não encontrado", 404);
    ok(res, eb);
  } catch (e) { err(res, e.message); }
});

// DELETE /api/estoque-base/:id — remove estoque-base
router.delete("/estoque-base/:id", async (req, res) => {
  try {
    await EstoqueBase.deleteOne({ empresaId: req.empresaId, id: req.params.id });
    ok(res, { id: req.params.id });
  } catch (e) { err(res, e.message); }
});

// PATCH /api/estoque-base/:id/movimentar — adiciona ou reduz quantidade manualmente
router.patch("/estoque-base/:id/movimentar", async (req, res) => {
  try {
    const { tipo, quantidade, descricao } = req.body;
    // tipo: "entrada" = adiciona | "saida" = reduz | "ajuste" = define valor absoluto
    const eb = await EstoqueBase.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!eb) return err(res, "Estoque-base não encontrado", 404);

    const qtd = Number(quantidade) || 0;
    if (tipo === "entrada") eb.quantidade = _round3(eb.quantidade + qtd);
    else if (tipo === "saida") eb.quantidade = _round3(Math.max(0, eb.quantidade - qtd));
    else if (tipo === "ajuste") eb.quantidade = _round3(qtd);

    eb.movimentacoes.push({ tipo, quantidade: qtd, descricao: descricao || "", data: new Date().toISOString() });
    await eb.save();
    ok(res, eb);
  } catch (e) { err(res, e.message); }
});

// ============================================================
// CATEGORIAS
// ============================================================
router.get("/categorias", async (req, res) => {
  try { ok(res, await Categoria.find({ empresaId: req.empresaId }).sort({ ordem: 1 }).lean()); }
  catch (e) { err(res, e.message); }
});

router.post("/categorias", async (req, res) => {
  try { ok(res, await Categoria.create({ ...req.body, empresaId: req.empresaId })); }
  catch (e) { err(res, e.message); }
});

router.put("/categorias/:id", async (req, res) => {
  try {
    const c = await Categoria.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id }, req.body, { new: true }
    );
    if (!c) return err(res, "Categoria não encontrada", 404);
    ok(res, c);
  } catch (e) { err(res, e.message); }
});

router.delete("/categorias/:id", async (req, res) => {
  try {
    await Categoria.deleteOne({ empresaId: req.empresaId, id: req.params.id });
    ok(res, { id: req.params.id });
  } catch (e) { err(res, e.message); }
});

router.patch("/categorias/:id/pausar", async (req, res) => {
  try {
    const c = await Categoria.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!c) return err(res, "Categoria não encontrada", 404);
    c.ativo = !c.ativo;
    await c.save();
    ok(res, c);
  } catch (e) { err(res, e.message); }
});

// ============================================================
// COMPLEMENTOS
// ============================================================
router.get("/complementos", async (req, res) => {
  try { ok(res, await Complemento.find({ empresaId: req.empresaId }).lean()); }
  catch (e) { err(res, e.message); }
});

router.post("/complementos", async (req, res) => {
  try { ok(res, await Complemento.create({ ...req.body, empresaId: req.empresaId })); }
  catch (e) { err(res, e.message); }
});

router.put("/complementos/:id", async (req, res) => {
  try {
    const c = await Complemento.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id }, req.body, { new: true }
    );
    if (!c) return err(res, "Complemento não encontrado", 404);
    ok(res, c);
  } catch (e) { err(res, e.message); }
});

router.delete("/complementos/:id", async (req, res) => {
  try {
    await Complemento.deleteOne({ empresaId: req.empresaId, id: req.params.id });
    ok(res, { id: req.params.id });
  } catch (e) { err(res, e.message); }
});

router.patch("/complementos/:id/pausar", async (req, res) => {
  try {
    const c = await Complemento.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!c) return err(res, "Complemento não encontrado", 404);
    c.ativo = !c.ativo;
    await c.save();
    ok(res, c);
  } catch (e) { err(res, e.message); }
});

// ============================================================
// PEDIDOS
// ============================================================

// GET /api/pedidos — lista pedidos ordenados do mais recente
router.get("/pedidos", async (req, res) => {
  try { ok(res, await Pedido.find({ empresaId: req.empresaId }).sort({ data: -1 }).lean()); }
  catch (e) { err(res, e.message); }
});

// POST /api/pedidos — cria pedido e desconta estoque automaticamente
router.post("/pedidos", async (req, res) => {
  try {
    const numeroPedido = await proximoNumeroPedido(req.empresaId);
    const pedido = await Pedido.create({ ...req.body, empresaId: req.empresaId, numeroPedido });
    await _descontarEstoque(req.empresaId, pedido.itens);
    ok(res, pedido);
  } catch (e) { err(res, e.message); }
});

// PUT /api/pedidos/:id — edita itens/total do pedido e reconcilia estoque
router.put("/pedidos/:id", async (req, res) => {
  try {
    const pedidoAntigo = await Pedido.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!pedidoAntigo) return err(res, "Pedido não encontrado", 404);

    // Reverte estoque dos itens antigos
    await _reporEstoque(req.empresaId, pedidoAntigo.itens || []);

    // Aplica campos editáveis
    const { itens, total, subtotal, taxaEntrega, status, formaPagamento, endereco } = req.body;
    if (itens !== undefined)          pedidoAntigo.itens          = itens;
    if (total !== undefined)          pedidoAntigo.total          = total;
    if (subtotal !== undefined)       pedidoAntigo.subtotal       = subtotal;
    if (taxaEntrega !== undefined)    pedidoAntigo.taxaEntrega    = taxaEntrega;
    if (status !== undefined)         pedidoAntigo.status         = status;
    if (formaPagamento !== undefined) pedidoAntigo.formaPagamento = formaPagamento;
    if (endereco !== undefined)       pedidoAntigo.endereco       = endereco;

    await pedidoAntigo.save();

    // Aplica estoque dos novos itens
    await _descontarEstoque(req.empresaId, pedidoAntigo.itens || []);

    ok(res, pedidoAntigo);
  } catch (e) { err(res, e.message); }
});

// PUT /api/pedidos/:id/status — atualiza status do pedido
router.put("/pedidos/:id/status", async (req, res) => {
  try {
    const p = await Pedido.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id },
      { status: req.body.status }, { new: true }
    );
    if (!p) return err(res, "Pedido não encontrado", 404);
    ok(res, p);
  } catch (e) { err(res, e.message); }
});

// DELETE /api/pedidos/:id — marca o pedido como excluído (soft delete) e repõe estoque
// IMPORTANTE: o registro NUNCA é removido do banco. Ele some da aba "Pedidos
// Recebidos", mas continua existindo (com excluido:true) para a aba "Histórico
// de Vendas", que funciona como trilha de auditoria e controle de fraude.
router.delete("/pedidos/:id", async (req, res) => {
  try {
    const pedido = await Pedido.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!pedido) return err(res, "Pedido não encontrado", 404);
    if (pedido.excluido) return err(res, "Pedido já estava excluído", 400);

    // Repõe o estoque ao cancelar/excluir pedido
    await _reporEstoque(req.empresaId, pedido.itens);

    pedido.excluido = true;
    pedido.dataExclusao = new Date().toISOString();
    await pedido.save();

    ok(res, pedido);
  } catch (e) { err(res, e.message); }
});

// ============================================================
// CONFIGURAÇÕES
// ============================================================
router.get("/config", async (req, res) => {
  try { ok(res, await Config.findOne({ empresaId: req.empresaId }).lean() || {}); }
  catch (e) { err(res, e.message); }
});

router.post("/config", async (req, res) => {
  try {
    // Bloqueia alteração de senha por esta rota (conforme requisito de segurança)
    const { senha: _s, ...dados } = req.body;
    const config = await Config.findOneAndUpdate(
      { empresaId: req.empresaId },
      { ...dados, empresaId: req.empresaId, chave: "principal" },
      { upsert: true, new: true }
    );
    ok(res, config);
  } catch (e) { err(res, e.message); }
});

// ============================================================
// DASHBOARD — métricas em tempo real
// ============================================================
router.get("/dashboard", async (req, res) => {
  try {
    const agora  = new Date();
    const diaStr = agora.toISOString().split("T")[0];   // "2025-06-12"
    const mesStr = diaStr.substring(0, 7);               // "2025-06"
    const anoStr = diaStr.substring(0, 4);               // "2025"

    const [pedidos, produtos, estoquesBases] = await Promise.all([
      Pedido.find({ empresaId: req.empresaId, excluido: { $ne: true } }).lean(),
      Produto.find({ empresaId: req.empresaId }).lean(),
      EstoqueBase.find({ empresaId: req.empresaId }).lean(),
    ]);

    const pedidosDia = pedidos.filter(p => p.data?.startsWith(diaStr));
    const pedidosMes = pedidos.filter(p => p.data?.startsWith(mesStr));
    const pedidosAno = pedidos.filter(p => p.data?.startsWith(anoStr));
    const soma = arr => arr.reduce((s, p) => s + (p.total || 0), 0);

    // Estoque baixo: unidade <= 5 ou base <= 1kg/L
    const estoqueBaixo = produtos.filter(p =>
      !p.usaEstoqueBase &&
      p.estoque !== "" && p.estoque !== null && p.estoque !== undefined &&
      !isNaN(Number(p.estoque)) && Number(p.estoque) <= 5
    );
    const estoqueBaixoBase = estoquesBases.filter(e => e.quantidade <= 1);

    // Validade próxima (30 dias)
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    const validadeProxima = produtos.filter(p => {
      if (!p.validade) return false;
      const d = new Date(p.validade);
      return d >= agora && d <= limite;
    });

    // Top 5 mais vendidos
    const maisVendidos = [...produtos]
      .filter(p => p.vendas > 0)
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, 5)
      .map(p => ({ id: p.id, nome: p.nome, vendas: p.vendas }));

    ok(res, {
      faturamento: { dia: soma(pedidosDia), mes: soma(pedidosMes), ano: soma(pedidosAno) },
      pedidos:     { dia: pedidosDia.length, mes: pedidosMes.length, ano: pedidosAno.length, total: pedidos.length },
      estoqueBaixo,
      estoqueBaixoBase,
      validadeProxima,
      maisVendidos,
    });
  } catch (e) { err(res, e.message); }
});

// ============================================================
// FUNÇÃO INTERNA — extrai quantidade e unidade de strings como "400ml", "1L", "500g", "2kg", "400ML"
// O campo item.unidade pode ser o tamanho selecionado pelo cliente (ex: "400ML")
// ou a unidade base do produto (ex: "kg", "L", "ml")
// ============================================================
function _parseUnidade(unidadeStr) {
  if (!unidadeStr) return { valor: 1, tipo: "un" };
  const s = String(unidadeStr).trim();

  // Tenta extrair número + unidade: "400ml", "1.5L", "500g", "2kg", "400ML"
  const match = s.match(/^([0-9]*\.?[0-9]+)\s*(ml|l|g|kg)\b/i);
  if (match) {
    return { valor: parseFloat(match[1]), tipo: match[2].toLowerCase() };
  }

  // Só a unidade sem número: "L", "kg", "ml", "g"
  const soUnidade = s.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (["ml","l","g","kg"].includes(soUnidade)) {
    return { valor: 1, tipo: soUnidade };
  }

  // Tamanhos como "P", "M", "G", "PP", "GG" ou texto livre → sem conversão
  return { valor: 1, tipo: "un" };
}

// ============================================================
// FUNÇÃO INTERNA — converte quantidade × unidade para kg ou L
// ============================================================
function _converterParaKgOuL(quantidade, unidadeStr) {
  const { valor, tipo } = _parseUnidade(unidadeStr);
  const total = valor * quantidade; // ex: 400ml × 2 vendas = 800ml total
  switch (tipo) {
    case "ml": return total / 1000;   // ml → L
    case "l":  return total;           // já em L
    case "g":  return total / 1000;   // g → kg
    case "kg": return total;           // já em kg
    default:   return total;           // unidades simples (un, cx…)
  }
}

// Converte uma quantidade + unidade direta (g, kg, ml) para kg ou L
// Arredonda para 3 casas decimais — evita erros de ponto flutuante
// acumulados (ex: 7.6999999999999975) toda vez que o estoque é alterado.
function _round3(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000;
}

function _converterFatorParaKgOuL(qtd, unidade) {
  const u = (unidade || "").toLowerCase().trim();
  switch (u) {
    case "g":  return qtd / 1000;   // g → kg
    case "kg": return qtd;
    case "ml": return qtd / 1000;   // ml → L
    case "l":  return qtd;
    default:   return qtd;
  }
}

// ============================================================
// FUNÇÃO INTERNA — desconta estoque ao criar pedido
// ============================================================
async function _descontarEstoque(empresaId, itens = []) {
  for (const item of itens) {
    const prod = await Produto.findOne({ empresaId, id: item.produtoId });
    if (!prod) continue;

    // Incrementa contador de vendas
    prod.vendas = (prod.vendas || 0) + item.quantidade;

    if (prod.usaEstoqueBase && prod.estoqueBaseId) {
      // item.unidade contém o tamanho selecionado pelo cliente (ex: "400ML", "700ml", "1L")
      // ou a unidade base do produto se nenhum tamanho foi selecionado
      const unidade = item.unidade || prod.unidade || "";
      const consumoKgL = _converterParaKgOuL(item.quantidade, unidade);

      const eb = await EstoqueBase.findOne({ empresaId, id: prod.estoqueBaseId });
      if (eb) {
        eb.quantidade = _round3(Math.max(0, eb.quantidade - consumoKgL));
        eb.movimentacoes.push({
          tipo: "saida", quantidade: consumoKgL,
          descricao: `Venda: ${item.quantidade}x ${prod.nome} (${unidade})`,
          pedidoId: item.id || "", data: new Date().toISOString()
        });
        await eb.save();
      }
    } else if (prod.estoque !== "" && prod.estoque !== undefined && prod.estoque !== null) {
      prod.estoque = Math.max(0, Number(prod.estoque) - item.quantidade);
    }

    // Pausa automática se estoque zerou (ignora estoque vazio = infinito)
    const estoqueFinito = prod.estoque !== "" && prod.estoque !== null && prod.estoque !== undefined;
    if (!prod.usaEstoqueBase && estoqueFinito && Number(prod.estoque) <= 0 && prod.ativo) {
      prod.ativo = false;
    }

    await prod.save();

    for (const comp of (item.complementos || [])) {
      const c = await Complemento.findOne({ empresaId, id: comp.id });
      if (!c) continue;
      // Desconta estoque simples do complemento
      if (c.estoque !== "" && c.estoque !== undefined) {
        c.estoque = Math.max(0, Number(c.estoque) - item.quantidade);
      }
      // Desconta do Estoque-Base se configurado
      if (c.usaEstoqueBase && c.estoqueBaseId && c.consumoQtd > 0) {
        const fator = _converterFatorParaKgOuL(c.consumoQtd, c.consumoUnidade || "g");
        const totalConsumo = fator * item.quantidade;
        const eb = await EstoqueBase.findOne({ empresaId, id: c.estoqueBaseId });
        if (eb) {
          eb.quantidade = _round3(Math.max(0, eb.quantidade - totalConsumo));
          eb.movimentacoes.push({
            tipo: "saida", quantidade: totalConsumo,
            descricao: `Complemento: ${item.quantidade}x ${c.nome} (${c.consumoQtd}${c.consumoUnidade})`,
            pedidoId: item.id || "", data: new Date().toISOString()
          });
          await eb.save();
        }
      }
      await c.save();
    }
  }
}

// ============================================================
// FUNÇÃO INTERNA — repõe estoque ao cancelar/excluir pedido
// ============================================================
async function _reporEstoque(empresaId, itens = []) {
  for (const item of itens) {
    const prod = await Produto.findOne({ empresaId, id: item.produtoId });
    if (!prod) continue;

    prod.vendas = Math.max(0, (prod.vendas || 0) - item.quantidade);

    if (prod.usaEstoqueBase && prod.estoqueBaseId) {
      const unidade = item.unidade || prod.unidade || "";
      const consumoKgL = _converterParaKgOuL(item.quantidade, unidade);

      const eb = await EstoqueBase.findOne({ empresaId, id: prod.estoqueBaseId });
      if (eb) {
        eb.quantidade = _round3(eb.quantidade + consumoKgL);
        eb.movimentacoes.push({
          tipo: "entrada", quantidade: consumoKgL,
          descricao: `Cancelamento: ${item.quantidade}x ${prod.nome}`,
          pedidoId: item.id || "", data: new Date().toISOString()
        });
        await eb.save();
      }
    } else if (prod.estoque !== "" && prod.estoque !== undefined) {
      prod.estoque = Number(prod.estoque) + item.quantidade;
      // Reativa produto se tinha sido pausado por falta de estoque
      if (!prod.ativo && prod.estoque > 0) prod.ativo = true;
    }
    await prod.save();

    for (const comp of (item.complementos || [])) {
      const c = await Complemento.findOne({ empresaId, id: comp.id });
      if (!c) continue;
      if (c.estoque !== "" && c.estoque !== undefined) {
        c.estoque = Number(c.estoque) + item.quantidade;
      }
      // Repõe no Estoque-Base se configurado
      if (c.usaEstoqueBase && c.estoqueBaseId && c.consumoQtd > 0) {
        const fator = _converterFatorParaKgOuL(c.consumoQtd, c.consumoUnidade || "g");
        const totalConsumo = fator * item.quantidade;
        const eb = await EstoqueBase.findOne({ empresaId, id: c.estoqueBaseId });
        if (eb) {
          eb.quantidade = _round3(eb.quantidade + totalConsumo);
          eb.movimentacoes.push({
            tipo: "entrada", quantidade: totalConsumo,
            descricao: `Cancelamento complemento: ${item.quantidade}x ${c.nome}`,
            pedidoId: item.id || "", data: new Date().toISOString()
          });
          await eb.save();
        }
      }
      await c.save();
    }
  }
}

module.exports = router;
