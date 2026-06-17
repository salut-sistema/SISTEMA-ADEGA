// ============================================================
//  server.js — Servidor Express + MongoDB para Sistema de Adega (Multi-Tenant)
// ============================================================

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const cors      = require("cors");
const routes    = require("./routes/index");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "X-Empresa-Token"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rotas da API ─────────────────────────────────────────────
app.use("/api", routes);

// ── Rota de status ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "online",
    servico: "Adega SaaS API (Multi-Tenant)",
    versao: "2.0.0",
    mongodb: mongoose.connection.readyState === 1 ? "conectado" : "desconectado",
  });
});

// ── Conexão com MongoDB ───────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB conectado com sucesso!");
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
      console.log(`📡 API disponível em http://localhost:${PORT}/api`);
      console.log(`🏪 Multi-tenant ativo — isolamento por empresaId`);
    });
  })
  .catch((error) => {
    console.error("❌ Erro ao conectar no MongoDB:", error.message);
    process.exit(1);
  });
