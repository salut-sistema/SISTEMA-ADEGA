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
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB conectado!");
    app.listen(PORT, () => {
      console.log(`🚀 Servidor em http://localhost:${PORT}`);
      console.log(`📡 API em http://localhost:${PORT}/api`);
    });
  })
  .catch(e => {
    console.error("❌ Erro ao conectar no MongoDB:", e.message);
    process.exit(1);
  });
