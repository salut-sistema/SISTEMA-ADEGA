// ============================================================
// server.js — Servidor Express + MongoDB (Multi-Tenant SaaS)
// Preparado para deploy no Render.com
// ============================================================
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const routes   = require("./routes/index");

const app  = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// 🔍 MONITOR TEMPORÁRIO DE MEMÓRIA — SÓ PARA DIAGNÓSTICO
// ============================================================
// Objetivo: descobrir, pelos logs do Render, em que momento o uso de
// memória do processo Node sobe e se aproxima do limite do plano Free
// (512MB). Não muda nenhuma rota, nenhuma funcionalidade, não aumenta
// nem diminui nenhum limite de memória, não mexe no MongoDB — só lê e
// imprime números no console, em intervalos regulares.
//
// Pode ser removido a qualquer momento apagando este bloco (entre os
// comentários de INÍCIO e FIM) sem afetar nada mais no sistema.
const MONITOR_MEMORIA_LIMITE_MB = 512;     // limite do plano Free do Render
const MONITOR_MEMORIA_INTERVALO_MS = 30000; // a cada 30 segundos

function _logMemoria(momento = "") {
  const uso = process.memoryUsage();
  const paraMB = (bytes) => (bytes / 1024 / 1024).toFixed(1);
  const percentualDoLimite = ((uso.rss / (MONITOR_MEMORIA_LIMITE_MB * 1024 * 1024)) * 100).toFixed(1);

  console.log(
    `📊 [Monitor de Memória${momento ? " — " + momento : ""}] ` +
    `RSS: ${paraMB(uso.rss)}MB | heapUsed: ${paraMB(uso.heapUsed)}MB | ` +
    `heapTotal: ${paraMB(uso.heapTotal)}MB | ~${percentualDoLimite}% do limite de ${MONITOR_MEMORIA_LIMITE_MB}MB`
  );
}

// Mensagem assim que o processo sobe (antes até de conectar no banco) —
// útil pra saber qual é o "chão" de memória do sistema, ainda sem nenhuma
// requisição atendida.
_logMemoria("processo iniciando");

// Log contínuo, em intervalos regulares, enquanto o servidor estiver no ar.
setInterval(() => _logMemoria(), MONITOR_MEMORIA_INTERVALO_MS);
// ============================================================
// 🔍 FIM DO MONITOR TEMPORÁRIO DE MEMÓRIA
// ============================================================

// ── CORS ─────────────────────────────────────────────────────
// Em produção, FRONTEND_URL deve ser a URL da Vercel
// Ex: FRONTEND_URL=https://minha-adega.vercel.app
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map(u => u.trim())
  : ["*"];

app.use(cors({
  origin: (origin, cb) => {
    // Permite qualquer origem se FRONTEND_URL=* ou em desenvolvimento
    if (allowedOrigins.includes("*") || !origin) return cb(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error("CORS bloqueado"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Empresa-Token"],
  credentials: true,
}));

// ── Body parsers ──────────────────────────────────────────────
// Limite de 10mb para suportar imagens em base64
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Rotas da API ──────────────────────────────────────────────
app.use("/api", routes);

// ── Rota de status (health check para o Render) ───────────────
app.get("/", (req, res) => {
  res.json({
    status:  "online",
    servico: "Adega SaaS API",
    versao:  "3.0.0",
    mongodb: mongoose.connection.readyState === 1 ? "conectado" : "desconectado",
  });
});

// ── Conexão com MongoDB Atlas ─────────────────────────────────
const { migrarDatasPedidos } = require("./migrations/migrar-data-pedidos");
const { migrarMovimentacoesEstoqueBase } = require("./migrations/migrar-movimentacoes-estoque-base");
const { Pedido, EstoqueBase, MovimentacaoEstoqueBase } = require("./models");

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("✅ MongoDB conectado!");

    // Migração idempotente (ver migrations/migrar-data-pedidos.js): depois
    // da primeira vez que converte tudo, essa checagem fica praticamente
    // instantânea nos deploys seguintes. Se falhar por qualquer motivo, o
    // servidor sobe normalmente mesmo assim (não trava o negócio por causa
    // de uma migração — só avisa no log pra investigar).
    try {
      const resultado = await migrarDatasPedidos(Pedido);
      if (!resultado.jaEstavaAtualizado) {
        console.log(`🔄 Migração de datas: ${resultado.migrados} pedido(s) convertido(s) para o novo formato.`);
      }
    } catch (e) {
      console.error("⚠️  Falha ao rodar migração de datas (servidor segue normalmente):", e.message);
    }

    try {
      const resultado = await migrarMovimentacoesEstoqueBase(EstoqueBase, MovimentacaoEstoqueBase);
      if (!resultado.jaEstavaAtualizado) {
        console.log(`🔄 Migração de estoque-base: ${resultado.movimentacoes} movimentação(ões) de ${resultado.migrados} estoque(s)-base movida(s) para a coleção própria.`);
      }
    } catch (e) {
      console.error("⚠️  Falha ao rodar migração de estoque-base (servidor segue normalmente):", e.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor em http://localhost:${PORT}`);
      console.log(`📡 API em http://localhost:${PORT}/api`);
      // Segundo ponto de referência do monitor de memória (ver bloco no
      // topo do arquivo) — compara com o log de "processo iniciando" pra
      // ver quanto a conexão com o Mongo + as migrações consumiram.
      _logMemoria("servidor pronto e escutando");
    });
  })
  .catch(e => {
    console.error("❌ Erro ao conectar no MongoDB:", e.message);
    process.exit(1);
  });
