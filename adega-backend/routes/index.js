// ============================================================
// routes/index.js — Todas as rotas da API (Multi-Tenant)
// Todas as operações filtradas por empresaId.
// ============================================================
const express     = require("express");
const router      = express.Router();
const { Produto, EstoqueBase, Categoria, Complemento, Pedido, Config, Contador } = require("../models");
const { authMiddleware, EMPRESAS, empresaValida } = require("../middleware/auth");
const { SENHA_MASTER, SOM_NOTIFICACAO_PEDIDO } = require("../empresasConfig");

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

// GET /api/som-config — retorna o nome do som de notificação configurado
// em empresasConfig.js (ver SOM_NOTIFICACAO_PEDIDO). Rota pública e livre
// de autenticação, pra facilitar a troca sem precisar reimplantar o backend.
router.get("/som-config", (req, res) => {
  ok(res, { som: SOM_NOTIFICACAO_PEDIDO || "classico" });
});

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

    // Valida estoque disponível ANTES de criar o pedido — impede vender
    // além do que existe (evita a "venda fantasma" no histórico).
    const errosEstoque = await _validarEstoqueSuficiente(eId, req.body.itens || []);
    if (errosEstoque.length) return err(res, "Estoque insuficiente: " + errosEstoque.join(" | "), 409);

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
    // Normaliza tamanhos: aceita string[] ou {volume,preco,estoque}[]
    const tamanhos = (req.body.tamanhos || []).map(t =>
      typeof t === "string"
        ? { volume: t, preco: 0, estoque: 0 }
        : { volume: String(t.volume || ""), preco: Number(t.preco) || 0, estoque: Number(t.estoque) || 0 }
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
    // Monta objeto de atualização sem sobrescrever campo ativo
    const { ativo, tamanhos: tamanhosBody, ...resto } = req.body;
    const update = { $set: { ...resto } };
    // Só mexe em "tamanhos" se ele vier explicitamente no corpo da requisição.
    // Isso evita apagar os tamanhos/estoque por tamanho já cadastrados quando
    // a edição é parcial (ex: atualizar só a quantidade de um tamanho, ou só
    // o estoque geral de um produto sem tamanhos).
    if (Array.isArray(tamanhosBody)) {
      update.$set.tamanhos = tamanhosBody.map(t =>
        typeof t === "string"
          ? { volume: t, preco: 0, estoque: 0 }
          : { volume: String(t.volume || ""), preco: Number(t.preco) || 0, estoque: Number(t.estoque) || 0 }
      );
    }
    const p = await Produto.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id },
      update,
      { new: true }
    );
    if (!p) return err(res, "Produto não encontrado", 404);

    // Depois de qualquer edição que possa ter mudado o estoque (total ou
    // por tamanho — ex: reposição manual no Controle de Estoque), verifica
    // se o produto deve ser pausado/reativado automaticamente. Nunca
    // sobrescreve uma pausa manual do admin — ver _sincronizarPausaAutomatica.
    _sincronizarPausaAutomatica(p);
    await p.save();

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
    // Ação manual do admin sempre "vence" — zera a marca de pausa
    // automática, pra essa mudança nunca ser desfeita sozinha depois
    // (ver _sincronizarPausaAutomatica).
    p.pausadoAutomaticamente = false;
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
// ============================================================
// GET /api/pedidos — lista pedidos PAGINADA (mais recente primeiro)
// ============================================================
// Aceita: page, limit, dataInicio (YYYY-MM-DD), dataFim (YYYY-MM-DD),
// status, origem, incluirExcluidos ("true"/"false").
// Responde: { itens, pagina, limite, total, totalPaginas }.
// Nunca devolve o histórico inteiro de uma vez — limite padrão 30,
// máximo seguro 200 (mesmo que o cliente peça mais). Essa era a maior
// causa de lentidão do sistema: antes, essa rota trazia TODOS os
// pedidos que a empresa já fez, sempre — e só piorava com o tempo.
const PEDIDOS_LIMITE_PADRAO = 30;
const PEDIDOS_LIMITE_MAXIMO = 200;

router.get("/pedidos", async (req, res) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.page) || 1);
    const limite = Math.min(PEDIDOS_LIMITE_MAXIMO, Math.max(1, parseInt(req.query.limit) || PEDIDOS_LIMITE_PADRAO));

    const filtro = { empresaId: req.empresaId };

    // Por padrão NÃO inclui excluídos (é o que "Pedidos Recebidos" espera).
    // "Histórico de Vendas" manda incluirExcluidos=true porque precisa ver
    // tudo, inclusive excluídos, como trilha de auditoria/controle de fraude.
    if (req.query.incluirExcluidos !== "true") filtro.excluido = { $ne: true };

    if (req.query.status) filtro.status = req.query.status;
    if (req.query.origem) filtro.origem = req.query.origem;

    if (req.query.dataInicio || req.query.dataFim) {
      filtro.data = {};
      if (req.query.dataInicio) filtro.data.$gte = new Date(`${req.query.dataInicio}T00:00:00.000Z`);
      if (req.query.dataFim)    filtro.data.$lte = new Date(`${req.query.dataFim}T23:59:59.999Z`);
    }

    const [itens, total] = await Promise.all([
      Pedido.find(filtro)
        .sort({ data: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .lean(),
      Pedido.countDocuments(filtro),
    ]);

    ok(res, { itens, pagina, limite, total, totalPaginas: Math.max(1, Math.ceil(total / limite)) });
  } catch (e) { err(res, e.message); }
});

// GET /api/pedidos/contagem — retorna só a QUANTIDADE de pedidos.
// Usada pelo polling do admin (a cada 12s) para checar se chegou pedido
// novo sem precisar baixar a lista inteira do histórico toda vez — é uma
// consulta muito mais leve (countDocuments) e a lista completa só é
// buscada quando o número realmente muda.
router.get("/pedidos/contagem", async (req, res) => {
  try { ok(res, { total: await Pedido.countDocuments({ empresaId: req.empresaId }) }); }
  catch (e) { err(res, e.message); }
});

// GET /api/pedidos/novos?apos=<ISO> — Etapa 5: devolve só os pedidos criados
// depois do timestamp informado (não-excluídos), junto com os produtos e
// estoques-base que ELES tocaram (busca só pelos ids envolvidos, não a
// coleção inteira). Usado pelo polling do admin em vez de re-buscar os
// 200 pedidos + todo o catálogo a cada novo pedido recebido.
router.get("/pedidos/novos", async (req, res) => {
  try {
    const apos = req.query.apos ? new Date(req.query.apos) : new Date(0);
    const pedidos = await Pedido.find({ empresaId: req.empresaId, excluido: { $ne: true }, data: { $gt: apos } })
      .sort({ data: 1 })
      .limit(50) // segurança — entre um poll e outro não deveria chegar perto disso
      .lean();

    const produtoIds = [...new Set(pedidos.flatMap(p => (p.itens || []).map(i => i.produtoId).filter(Boolean)))];
    const produtos = produtoIds.length
      ? await Produto.find({ empresaId: req.empresaId, id: { $in: produtoIds } }).lean()
      : [];

    const estoqueBaseIds = [...new Set(produtos.filter(p => p.usaEstoqueBase && p.estoqueBaseId).map(p => p.estoqueBaseId))];
    const estoquesBase = estoqueBaseIds.length
      ? await EstoqueBase.find({ empresaId: req.empresaId, id: { $in: estoqueBaseIds } }).lean()
      : [];

    ok(res, { pedidos, produtos, estoquesBase });
  } catch (e) { err(res, e.message); }
});

// POST /api/pedidos — cria pedido e desconta estoque automaticamente
router.post("/pedidos", async (req, res) => {
  try {
    const errosEstoque = await _validarEstoqueSuficiente(req.empresaId, req.body.itens || []);
    if (errosEstoque.length) return err(res, "Estoque insuficiente: " + errosEstoque.join(" | "), 409);

    const numeroPedido = await proximoNumeroPedido(req.empresaId);
    const pedido = await Pedido.create({ ...req.body, empresaId: req.empresaId, numeroPedido });
    const afetados = await _descontarEstoque(req.empresaId, pedido.itens);
    // Etapa 3: devolve o pedido criado junto com o que foi alterado no
    // estoque — o frontend usa isso pra atualizar a tela sem precisar
    // baixar produtos/estoque-base inteiros de novo.
    ok(res, { pedido, ...afetados });
  } catch (e) { err(res, e.message); }
});

// PUT /api/pedidos/:id — edita itens/total do pedido e reconcilia estoque
router.put("/pedidos/:id", async (req, res) => {
  try {
    const pedidoAntigo = await Pedido.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!pedidoAntigo) return err(res, "Pedido não encontrado", 404);

    // Reverte estoque dos itens antigos
    const afetadosRepor = await _reporEstoque(req.empresaId, pedidoAntigo.itens || []);

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
    const afetadosDescontar = await _descontarEstoque(req.empresaId, pedidoAntigo.itens || []);

    // Etapa 3: junta o que foi tocado nas duas operações (repor + descontar)
    // e devolve junto com o pedido — evita o frontend ter que recarregar
    // produtos/estoque-base inteiros depois de editar um pedido.
    ok(res, { pedido: pedidoAntigo, ..._mergeAfetados(afetadosRepor, afetadosDescontar) });
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
    const afetados = await _reporEstoque(req.empresaId, pedido.itens);

    pedido.excluido = true;
    pedido.dataExclusao = new Date().toISOString();
    await pedido.save();

    // Etapa 3: devolve junto o que foi reposto no estoque, pra "Pedidos
    // Recebidos" não precisar recarregar produtos/estoque-base inteiros.
    ok(res, { pedido, ...afetados });
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
    const agora = new Date();

    // Limites de dia/mês/ano em UTC — equivalente a comparar o prefixo da
    // string ISO como era feito antes (ex: "2025-06-12"), só que sem
    // precisar converter cada pedido de volta pra string.
    const inicioDia  = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
    const inicioMes  = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const inicioAno  = new Date(Date.UTC(agora.getUTCFullYear(), 0, 1));
    const fimDia  = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);
    const fimMes  = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
    const fimAno  = new Date(Date.UTC(agora.getUTCFullYear() + 1, 0, 1));

    // Etapa 4: em vez de trazer TODOS os pedidos da empresa pra memória só
    // pra somar/contar por período, deixa o próprio MongoDB fazer essa
    // conta (aggregation) — o servidor recebe só os 6 números já prontos,
    // não importa se a empresa tem 100 ou 100 mil pedidos no histórico.
    const _faixa = (inicio, fim) => ({ $and: [{ $gte: ["$data", inicio] }, { $lt: ["$data", fim] }] });

    const [agregado, produtos, estoquesBases] = await Promise.all([
      Pedido.aggregate([
        { $match: { empresaId: req.empresaId, excluido: { $ne: true } } },
        { $group: {
            _id: null,
            totalPedidos:      { $sum: 1 },
            faturamentoDia:    { $sum: { $cond: [_faixa(inicioDia, fimDia), "$total", 0] } },
            pedidosDia:        { $sum: { $cond: [_faixa(inicioDia, fimDia), 1, 0] } },
            faturamentoMes:    { $sum: { $cond: [_faixa(inicioMes, fimMes), "$total", 0] } },
            pedidosMes:        { $sum: { $cond: [_faixa(inicioMes, fimMes), 1, 0] } },
            faturamentoAno:    { $sum: { $cond: [_faixa(inicioAno, fimAno), "$total", 0] } },
            pedidosAno:        { $sum: { $cond: [_faixa(inicioAno, fimAno), 1, 0] } },
        } },
      ]),
      Produto.find({ empresaId: req.empresaId }).lean(),
      EstoqueBase.find({ empresaId: req.empresaId }).lean(),
    ]);

    // Empresa sem nenhum pedido ainda → aggregation não devolve documento,
    // usamos zeros pra tudo (mesmo comportamento de antes).
    const stats = agregado[0] || {
      totalPedidos: 0, faturamentoDia: 0, pedidosDia: 0,
      faturamentoMes: 0, pedidosMes: 0, faturamentoAno: 0, pedidosAno: 0,
    };

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
      faturamento: { dia: stats.faturamentoDia, mes: stats.faturamentoMes, ano: stats.faturamentoAno },
      pedidos:     { dia: stats.pedidosDia, mes: stats.pedidosMes, ano: stats.pedidosAno, total: stats.totalPedidos },
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
// PERFORMANCE — Carregamento em lote dos documentos necessários
// para processar os itens de um pedido.
// ============================================================
// Antes, cada uma das 3 funções abaixo fazia 1 consulta ao banco POR
// ITEM (Produto.findOne dentro de um loop) — em um pedido com vários
// itens/complementos isso virava dezenas de idas e voltas sequenciais
// ao banco, uma esperando a outra terminar. Em um banco gratuito
// (latência maior, recursos compartilhados) isso é a causa mais provável
// de lentidão perceptível ao finalizar pedidos. Agora, buscamos todos os
// produtos/complementos/estoques-base envolvidos em UMA única consulta
// cada (usando $in), processamos tudo em memória, e salvamos em paralelo
// só os documentos realmente modificados.
// ============================================================
async function _carregarDocsPedido(empresaId, itens = []) {
  const produtoIds = [...new Set(itens.map(i => i.produtoId).filter(Boolean))];
  const complementoIds = [...new Set(itens.flatMap(i => (i.complementos || []).map(c => c.id)).filter(Boolean))];

  const [produtosArr, complementosArr] = await Promise.all([
    produtoIds.length ? Produto.find({ empresaId, id: { $in: produtoIds } }) : Promise.resolve([]),
    complementoIds.length ? Complemento.find({ empresaId, id: { $in: complementoIds } }) : Promise.resolve([]),
  ]);

  const estoqueBaseIds = new Set();
  produtosArr.forEach(p => { if (p.usaEstoqueBase && p.estoqueBaseId) estoqueBaseIds.add(p.estoqueBaseId); });
  complementosArr.forEach(c => { if (c.usaEstoqueBase && c.estoqueBaseId) estoqueBaseIds.add(c.estoqueBaseId); });

  const estoquesBaseArr = estoqueBaseIds.size
    ? await EstoqueBase.find({ empresaId, id: { $in: [...estoqueBaseIds] } })
    : [];

  return {
    produtosMap:     new Map(produtosArr.map(p => [p.id, p])),
    complementosMap: new Map(complementosArr.map(c => [c.id, c])),
    estoqueBaseMap:  new Map(estoquesBaseArr.map(e => [e.id, e])),
  };
}

// ============================================================
// FUNÇÃO INTERNA — valida se há estoque suficiente ANTES de criar o
// pedido. Sem essa checagem, era possível vender mais do que o
// disponível (ex: 3 unidades de um tamanho com só 2 em estoque), o que
// registrava uma venda "fantasma" no histórico e deixava o total e a
// soma por tamanho dessincronizados (total descontava a quantidade
// pedida inteira, enquanto o tamanho ficava travado em 0 sem poder ir
// negativo). Retorna uma lista de mensagens de erro (vazia = tudo ok).
// ============================================================
async function _validarEstoqueSuficiente(empresaId, itens = []) {
  if (!itens.length) return [];
  const { produtosMap } = await _carregarDocsPedido(empresaId, itens);
  const erros = [];
  for (const item of itens) {
    const prod = produtosMap.get(item.produtoId);
    if (!prod) continue; // produto removido — deixa passar, tratado em outro lugar
    if (prod.usaEstoqueBase) continue; // mecanismo separado (matéria-prima), não validado aqui

    if (item.tamanho && Array.isArray(prod.tamanhos) && prod.tamanhos.length) {
      // Só valida por tamanho quando o produto tem Estoque Total definido
      // (não infinito) — mesma regra usada para "bloquear" tamanho na loja.
      const estoqueControlado = prod.estoque !== "" && prod.estoque !== undefined && prod.estoque !== null;
      if (estoqueControlado) {
        const tam = prod.tamanhos.find(t => t.volume === item.tamanho);
        const disponivel = tam ? Number(tam.estoque || 0) : 0;
        if (disponivel < item.quantidade) {
          erros.push(`${prod.nome} (${item.tamanho}): apenas ${disponivel} disponível(is), pedido pede ${item.quantidade}`);
        }
      }
    } else if (prod.estoque !== "" && prod.estoque !== undefined && prod.estoque !== null) {
      const disponivel = Number(prod.estoque);
      if (disponivel < item.quantidade) {
        erros.push(`${prod.nome}: apenas ${disponivel} disponível(is), pedido pede ${item.quantidade}`);
      }
    }
  }
  return erros;
}

// ============================================================
// FUNÇÃO INTERNA — desconta estoque ao criar pedido
// ============================================================
// ============================================================
// Estoque zerado → pausa automática (integrada com pausa manual)
// ============================================================
// Um produto é considerado "esgotado" quando:
//  - tem tamanhos cadastrados: TODOS os tamanhos estão com estoque <= 0;
//  - não tem tamanhos: o Estoque Total é controlado (não infinito) e
//    chegou a 0.
// Produtos com Estoque-Base (matéria-prima compartilhada) ficam de fora
// — esse mecanismo é outro e não muda o "ativo" do produto.
function _produtoEstaEsgotado(prod) {
  if (prod.usaEstoqueBase) return false;
  if (Array.isArray(prod.tamanhos) && prod.tamanhos.length > 0) {
    return prod.tamanhos.every(t => Number(t.estoque || 0) <= 0);
  }
  const estoqueFinito = prod.estoque !== "" && prod.estoque !== null && prod.estoque !== undefined;
  if (!estoqueFinito) return false; // estoque ilimitado nunca esgota
  return Number(prod.estoque) <= 0;
}

// Chamada sempre que o estoque de um produto muda (venda, cancelamento,
// edição manual do estoque). Pausa sozinho quando esgota, reativa sozinho
// quando volta a ter estoque — mas SÓ reativa se foi o próprio sistema
// quem pausou (pausadoAutomaticamente:true). Uma pausa feita manualmente
// pelo admin (botão "Pausar") nunca é desfeita por aqui; só o admin
// reativa clicando de novo.
function _sincronizarPausaAutomatica(prod) {
  if (prod.usaEstoqueBase) return;
  const esgotado = _produtoEstaEsgotado(prod);
  if (esgotado && prod.ativo) {
    prod.ativo = false;
    prod.pausadoAutomaticamente = true;
  } else if (!esgotado && !prod.ativo && prod.pausadoAutomaticamente) {
    prod.ativo = true;
    prod.pausadoAutomaticamente = false;
  }
}

async function _descontarEstoque(empresaId, itens = []) {
  if (!itens.length) return;
  const { produtosMap, complementosMap, estoqueBaseMap } = await _carregarDocsPedido(empresaId, itens);
  const produtosTocados = new Set();
  const complementosTocados = new Set();
  const estoquesBaseTocados = new Set();

  for (const item of itens) {
    const prod = produtosMap.get(item.produtoId);
    if (!prod) continue;
    produtosTocados.add(prod);

    // Incrementa contador de vendas
    prod.vendas = (prod.vendas || 0) + item.quantidade;

    if (prod.usaEstoqueBase && prod.estoqueBaseId) {
      // item.unidade contém o tamanho selecionado pelo cliente (ex: "400ML", "700ml", "1L")
      // ou a unidade base do produto se nenhum tamanho foi selecionado
      const unidade = item.unidade || prod.unidade || "";
      const consumoKgL = _converterParaKgOuL(item.quantidade, unidade);

      const eb = estoqueBaseMap.get(prod.estoqueBaseId);
      if (eb) {
        eb.quantidade = _round3(Math.max(0, eb.quantidade - consumoKgL));
        eb.movimentacoes.push({
          tipo: "saida", quantidade: consumoKgL,
          descricao: `Venda: ${item.quantidade}x ${prod.nome} (${unidade})`,
          pedidoId: item.id || "", data: new Date().toISOString()
        });
        estoquesBaseTocados.add(eb);
      }
    } else if (prod.estoque !== "" && prod.estoque !== undefined && prod.estoque !== null) {
      prod.estoque = Math.max(0, Number(prod.estoque) - item.quantidade);
    }

    // ── Estoque por Tamanho (produtos com "Tamanhos por Volume" ou
    // "Tamanhos por Unidade" cadastrados) ─────────────────────────
    // Desconta a quantidade específica do tamanho vendido (ex: comprou "P"
    // → desconta de tamanhos.estoque onde volume === "P"), em paralelo ao
    // desconto do total acima — mantendo os dois sempre sincronizados.
    // Não se aplica a produtos com Estoque-Base (mecanismo separado).
    if (!prod.usaEstoqueBase && Array.isArray(prod.tamanhos) && prod.tamanhos.length && item.tamanho) {
      const tam = prod.tamanhos.find(t => t.volume === item.tamanho);
      if (tam) {
        tam.estoque = Math.max(0, Number(tam.estoque || 0) - item.quantidade);
        prod.markModified("tamanhos");
      }
    }

    // Pausa automática se o produto esgotou (considera tamanhos e estoque
    // total, e nunca sobrescreve uma pausa manual) — ver _sincronizarPausaAutomatica.
    _sincronizarPausaAutomatica(prod);

    for (const comp of (item.complementos || [])) {
      const c = complementosMap.get(comp.id);
      if (!c) continue;
      complementosTocados.add(c);

      // Desconta estoque simples do complemento
      if (c.estoque !== "" && c.estoque !== undefined) {
        c.estoque = Math.max(0, Number(c.estoque) - item.quantidade);
      }
      // Desconta do Estoque-Base se configurado
      if (c.usaEstoqueBase && c.estoqueBaseId && c.consumoQtd > 0) {
        const fator = _converterFatorParaKgOuL(c.consumoQtd, c.consumoUnidade || "g");
        const totalConsumo = fator * item.quantidade;
        const eb = estoqueBaseMap.get(c.estoqueBaseId);
        if (eb) {
          eb.quantidade = _round3(Math.max(0, eb.quantidade - totalConsumo));
          eb.movimentacoes.push({
            tipo: "saida", quantidade: totalConsumo,
            descricao: `Complemento: ${item.quantidade}x ${c.nome} (${c.consumoQtd}${c.consumoUnidade})`,
            pedidoId: item.id || "", data: new Date().toISOString()
          });
          estoquesBaseTocados.add(eb);
        }
      }
    }
  }

  await Promise.all([
    ...[...produtosTocados].map(p => p.save()),
    ...[...complementosTocados].map(c => c.save()),
    ...[...estoquesBaseTocados].map(e => e.save()),
  ]);

  // Etapa 3: devolve os documentos alterados (em vez de nada) pra quem
  // chamou essa função poder incluir na resposta da API — assim o
  // frontend consegue atualizar só o que mudou, sem baixar produtos e
  // estoque-base inteiros de novo a cada venda.
  return {
    produtos:     [...produtosTocados].map(p => p.toObject()),
    complementos: [...complementosTocados].map(c => c.toObject()),
    estoquesBase: [...estoquesBaseTocados].map(e => e.toObject()),
  };
}

// ============================================================
// FUNÇÃO INTERNA — repõe estoque ao cancelar/excluir pedido
// ============================================================
// ============================================================
// FUNÇÃO INTERNA — junta dois resultados de {produtos,complementos,
// estoquesBase} por id, mantendo sempre a versão mais recente (a "b",
// vinda da segunda chamada). Usado na edição de pedido, que primeiro
// repõe o estoque dos itens antigos e depois desconta o dos novos.
// ============================================================
function _mergeAfetados(a, b) {
  const juntar = (lista1 = [], lista2 = []) => {
    const porId = new Map(lista1.map(x => [x.id, x]));
    lista2.forEach(x => porId.set(x.id, x));
    return [...porId.values()];
  };
  return {
    produtos:     juntar(a?.produtos, b?.produtos),
    complementos: juntar(a?.complementos, b?.complementos),
    estoquesBase: juntar(a?.estoquesBase, b?.estoquesBase),
  };
}

async function _reporEstoque(empresaId, itens = []) {
  if (!itens.length) return;
  const { produtosMap, complementosMap, estoqueBaseMap } = await _carregarDocsPedido(empresaId, itens);
  const produtosTocados = new Set();
  const complementosTocados = new Set();
  const estoquesBaseTocados = new Set();

  for (const item of itens) {
    const prod = produtosMap.get(item.produtoId);
    if (!prod) continue;
    produtosTocados.add(prod);

    prod.vendas = Math.max(0, (prod.vendas || 0) - item.quantidade);

    if (prod.usaEstoqueBase && prod.estoqueBaseId) {
      const unidade = item.unidade || prod.unidade || "";
      const consumoKgL = _converterParaKgOuL(item.quantidade, unidade);

      const eb = estoqueBaseMap.get(prod.estoqueBaseId);
      if (eb) {
        eb.quantidade = _round3(eb.quantidade + consumoKgL);
        eb.movimentacoes.push({
          tipo: "entrada", quantidade: consumoKgL,
          descricao: `Cancelamento: ${item.quantidade}x ${prod.nome}`,
          pedidoId: item.id || "", data: new Date().toISOString()
        });
        estoquesBaseTocados.add(eb);
      }
    } else if (prod.estoque !== "" && prod.estoque !== undefined) {
      prod.estoque = Number(prod.estoque) + item.quantidade;
    }

    // ── Estoque por Tamanho — repõe a quantidade do tamanho cancelado,
    // em paralelo à reposição do total acima (mesma regra do desconto). ──
    if (!prod.usaEstoqueBase && Array.isArray(prod.tamanhos) && prod.tamanhos.length && item.tamanho) {
      const tam = prod.tamanhos.find(t => t.volume === item.tamanho);
      if (tam) {
        tam.estoque = Number(tam.estoque || 0) + item.quantidade;
        prod.markModified("tamanhos");
      }
    }

    // Reativa automaticamente se o estoque voltou (só quando a pausa
    // atual foi automática — nunca sobrescreve uma pausa manual do admin).
    _sincronizarPausaAutomatica(prod);

    for (const comp of (item.complementos || [])) {
      const c = complementosMap.get(comp.id);
      if (!c) continue;
      complementosTocados.add(c);

      if (c.estoque !== "" && c.estoque !== undefined) {
        c.estoque = Number(c.estoque) + item.quantidade;
      }
      // Repõe no Estoque-Base se configurado
      if (c.usaEstoqueBase && c.estoqueBaseId && c.consumoQtd > 0) {
        const fator = _converterFatorParaKgOuL(c.consumoQtd, c.consumoUnidade || "g");
        const totalConsumo = fator * item.quantidade;
        const eb = estoqueBaseMap.get(c.estoqueBaseId);
        if (eb) {
          eb.quantidade = _round3(eb.quantidade + totalConsumo);
          eb.movimentacoes.push({
            tipo: "entrada", quantidade: totalConsumo,
            descricao: `Cancelamento complemento: ${item.quantidade}x ${c.nome}`,
            pedidoId: item.id || "", data: new Date().toISOString()
          });
          estoquesBaseTocados.add(eb);
        }
      }
    }
  }

  await Promise.all([
    ...[...produtosTocados].map(p => p.save()),
    ...[...complementosTocados].map(c => c.save()),
    ...[...estoquesBaseTocados].map(e => e.save()),
  ]);

  return {
    produtos:     [...produtosTocados].map(p => p.toObject()),
    complementos: [...complementosTocados].map(c => c.toObject()),
    estoquesBase: [...estoquesBaseTocados].map(e => e.toObject()),
  };
}

module.exports = router;
