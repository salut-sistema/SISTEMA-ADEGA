// ============================================================
// routes/index.js — Todas as rotas da API (Multi-Tenant)
// Todas as operações filtradas por empresaId.
// Nenhuma consulta é feita sem o filtro de empresa.
// ============================================================
const express = require("express");
const router  = express.Router();
const { Produto, Categoria, Complemento, Pedido, Config } = require("../models");
const { authMiddleware, EMPRESAS, empresaValida } = require("../middleware/auth");

const ok  = (res, data)        => res.json({ sucesso: true, data });
const err = (res, msg, st=500) => res.status(st).json({ sucesso: false, erro: msg });

// ── LOGIN DA EMPRESA ─────────────────────────────────────────
// POST /api/login  { login, senha }
// Retorna o token (base64) e dados da empresa
router.post("/login", (req, res) => {
  const { login, senha } = req.body || {};
  if (!login || !senha)
    return err(res, "Login e senha obrigatórios", 400);

  const empresa = EMPRESAS.find(e => e.login === login && e.senha === senha);
  if (!empresa)
    return err(res, "Credenciais inválidas", 401);
  if (!empresaValida(empresa))
    return err(res, "Empresa bloqueada ou com acesso expirado", 403);

  const token = Buffer.from(`${empresa.login}:${empresa.senha}`).toString("base64");
  ok(res, {
    token,
    empresaId:  empresa.empresaId,
    nome:       empresa.nome,
    slug:       empresa.slug,
  });
});

// ── ROTA PÚBLICA: buscar empresa pelo slug (para a loja) ─────
// GET /api/loja/:slug  — sem autenticação, retorna config pública
router.get("/loja/:slug", async (req, res) => {
  try {
    const empresa = EMPRESAS.find(e => e.slug === req.params.slug);
    if (!empresa || !empresaValida(empresa))
      return err(res, "Loja não encontrada", 404);

    const config = await Config.findOne({ empresaId: empresa.empresaId }).lean() || {};
    const categorias = await Categoria.find({ empresaId: empresa.empresaId, ativo: true }).sort({ ordem: 1 }).lean();
    const produtos   = await Produto.find({ empresaId: empresa.empresaId, ativo: true }).sort({ dataCriacao: 1 }).lean();

    ok(res, {
      empresaId:  empresa.empresaId,
      nome:       empresa.nome,
      slug:       empresa.slug,
      config,
      categorias,
      produtos,
    });
  } catch(e) { err(res, e.message); }
});

// ── A partir daqui: todas as rotas exigem autenticação ───────
router.use(authMiddleware);

// ── PRODUTOS ─────────────────────────────────────────────────
router.get("/produtos", async (req, res) => {
  try { ok(res, await Produto.find({ empresaId: req.empresaId }).sort({ dataCriacao: 1 }).lean()); }
  catch(e) { err(res, e.message); }
});

router.post("/produtos", async (req, res) => {
  try { ok(res, await Produto.create({ ...req.body, empresaId: req.empresaId })); }
  catch(e) { err(res, e.message); }
});

router.put("/produtos/:id", async (req, res) => {
  try {
    const p = await Produto.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id },
      req.body,
      { new: true }
    );
    if (!p) return err(res, "Produto não encontrado", 404);
    ok(res, p);
  } catch(e) { err(res, e.message); }
});

router.delete("/produtos/:id", async (req, res) => {
  try {
    await Produto.deleteOne({ empresaId: req.empresaId, id: req.params.id });
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

router.patch("/produtos/:id/pausar", async (req, res) => {
  try {
    const p = await Produto.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!p) return err(res, "Produto não encontrado", 404);
    p.ativo = !p.ativo;
    await p.save();
    ok(res, p);
  } catch(e) { err(res, e.message); }
});

// ── CATEGORIAS ───────────────────────────────────────────────
router.get("/categorias", async (req, res) => {
  try { ok(res, await Categoria.find({ empresaId: req.empresaId }).sort({ ordem: 1 }).lean()); }
  catch(e) { err(res, e.message); }
});

router.post("/categorias", async (req, res) => {
  try { ok(res, await Categoria.create({ ...req.body, empresaId: req.empresaId })); }
  catch(e) { err(res, e.message); }
});

router.put("/categorias/:id", async (req, res) => {
  try {
    const c = await Categoria.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id },
      req.body,
      { new: true }
    );
    if (!c) return err(res, "Categoria não encontrada", 404);
    ok(res, c);
  } catch(e) { err(res, e.message); }
});

router.delete("/categorias/:id", async (req, res) => {
  try {
    await Categoria.deleteOne({ empresaId: req.empresaId, id: req.params.id });
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

router.patch("/categorias/:id/pausar", async (req, res) => {
  try {
    const c = await Categoria.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!c) return err(res, "Categoria não encontrada", 404);
    c.ativo = !c.ativo;
    await c.save();
    ok(res, c);
  } catch(e) { err(res, e.message); }
});

// ── COMPLEMENTOS ─────────────────────────────────────────────
router.get("/complementos", async (req, res) => {
  try { ok(res, await Complemento.find({ empresaId: req.empresaId }).lean()); }
  catch(e) { err(res, e.message); }
});

router.post("/complementos", async (req, res) => {
  try { ok(res, await Complemento.create({ ...req.body, empresaId: req.empresaId })); }
  catch(e) { err(res, e.message); }
});

router.put("/complementos/:id", async (req, res) => {
  try {
    const c = await Complemento.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id },
      req.body,
      { new: true }
    );
    if (!c) return err(res, "Complemento não encontrado", 404);
    ok(res, c);
  } catch(e) { err(res, e.message); }
});

router.delete("/complementos/:id", async (req, res) => {
  try {
    await Complemento.deleteOne({ empresaId: req.empresaId, id: req.params.id });
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

router.patch("/complementos/:id/pausar", async (req, res) => {
  try {
    const c = await Complemento.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!c) return err(res, "Complemento não encontrado", 404);
    c.ativo = !c.ativo;
    await c.save();
    ok(res, c);
  } catch(e) { err(res, e.message); }
});

// ── PEDIDOS ──────────────────────────────────────────────────
router.get("/pedidos", async (req, res) => {
  try { ok(res, await Pedido.find({ empresaId: req.empresaId }).sort({ data: -1 }).lean()); }
  catch(e) { err(res, e.message); }
});

router.post("/pedidos", async (req, res) => {
  try {
    const pedido = await Pedido.create({ ...req.body, empresaId: req.empresaId });

    for (const item of (pedido.itens || [])) {
      const prod = await Produto.findOne({ empresaId: req.empresaId, id: item.produtoId });
      if (prod) {
        if (prod.estoque !== "" && prod.estoque !== undefined && prod.estoque !== null)
          prod.estoque = Math.max(0, Number(prod.estoque) - item.quantidade);
        prod.vendas = (prod.vendas || 0) + item.quantidade;
        await prod.save();
      }
      for (const comp of (item.complementos || [])) {
        const c = await Complemento.findOne({ empresaId: req.empresaId, id: comp.id });
        if (c && c.estoque !== "" && c.estoque !== undefined) {
          c.estoque = Math.max(0, Number(c.estoque) - item.quantidade);
          await c.save();
        }
      }
    }
    ok(res, pedido);
  } catch(e) { err(res, e.message); }
});

router.put("/pedidos/:id/status", async (req, res) => {
  try {
    const p = await Pedido.findOneAndUpdate(
      { empresaId: req.empresaId, id: req.params.id },
      { status: req.body.status },
      { new: true }
    );
    if (!p) return err(res, "Pedido não encontrado", 404);
    ok(res, p);
  } catch(e) { err(res, e.message); }
});

router.delete("/pedidos/:id", async (req, res) => {
  try {
    const pedido = await Pedido.findOne({ empresaId: req.empresaId, id: req.params.id });
    if (!pedido) return err(res, "Pedido não encontrado", 404);

    for (const item of (pedido.itens || [])) {
      const prod = await Produto.findOne({ empresaId: req.empresaId, id: item.produtoId });
      if (prod) {
        if (prod.estoque !== "" && prod.estoque !== undefined)
          prod.estoque = Number(prod.estoque) + item.quantidade;
        prod.vendas = Math.max(0, (prod.vendas || 0) - item.quantidade);
        await prod.save();
      }
      for (const comp of (item.complementos || [])) {
        const c = await Complemento.findOne({ empresaId: req.empresaId, id: comp.id });
        if (c && c.estoque !== "" && c.estoque !== undefined) {
          c.estoque = Number(c.estoque) + item.quantidade;
          await c.save();
        }
      }
    }
    await Pedido.deleteOne({ empresaId: req.empresaId, id: req.params.id });
    ok(res, { id: req.params.id });
  } catch(e) { err(res, e.message); }
});

// ── CONFIG ───────────────────────────────────────────────────
router.get("/config", async (req, res) => {
  try {
    ok(res, await Config.findOne({ empresaId: req.empresaId }).lean() || {});
  } catch(e) { err(res, e.message); }
});

router.post("/config", async (req, res) => {
  try {
    // Bloqueia alteração de senha pela rota de config (conforme requisito)
    const { senha: _removeSenha, ...dadosSemSenha } = req.body;
    const config = await Config.findOneAndUpdate(
      { empresaId: req.empresaId },
      { ...dadosSemSenha, empresaId: req.empresaId, chave: "principal" },
      { upsert: true, new: true }
    );
    ok(res, config);
  } catch(e) { err(res, e.message); }
});

// ── DASHBOARD ────────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  try {
    const agora   = new Date();
    const diaStr  = agora.toISOString().split("T")[0];          // "2025-06-12"
    const mesStr  = diaStr.substring(0, 7);                     // "2025-06"
    const anoStr  = diaStr.substring(0, 4);                     // "2025"

    const pedidos = await Pedido.find({ empresaId: req.empresaId }).lean();
    const produtos = await Produto.find({ empresaId: req.empresaId }).lean();

    const pedidosDia  = pedidos.filter(p => p.data && p.data.startsWith(diaStr));
    const pedidosMes  = pedidos.filter(p => p.data && p.data.startsWith(mesStr));
    const pedidosAno  = pedidos.filter(p => p.data && p.data.startsWith(anoStr));

    const soma = arr => arr.reduce((s, p) => s + (p.total || 0), 0);

    // Estoque baixo: produtos com estoque numérico <= 5
    const estoqueBaixo = produtos.filter(p =>
      p.estoque !== "" && p.estoque !== null && p.estoque !== undefined &&
      !isNaN(Number(p.estoque)) && Number(p.estoque) <= 5
    );

    // Validade próxima: nos próximos 30 dias
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    const validadeProxima = produtos.filter(p => {
      if (!p.validade) return false;
      const d = new Date(p.validade);
      return d >= agora && d <= limite;
    });

    // Mais vendidos
    const maisVendidos = [...produtos]
      .filter(p => p.vendas > 0)
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, 5)
      .map(p => ({ id: p.id, nome: p.nome, vendas: p.vendas }));

    ok(res, {
      faturamento: {
        dia:  soma(pedidosDia),
        mes:  soma(pedidosMes),
        ano:  soma(pedidosAno),
      },
      pedidos: {
        dia:   pedidosDia.length,
        mes:   pedidosMes.length,
        ano:   pedidosAno.length,
        total: pedidos.length,
      },
      estoqueBaixo,
      validadeProxima,
      maisVendidos,
    });
  } catch(e) { err(res, e.message); }
});

module.exports = router;
