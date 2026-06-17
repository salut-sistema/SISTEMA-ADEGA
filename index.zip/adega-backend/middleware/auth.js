// ============================================================
// middleware/auth.js — Autenticação e isolamento multi-tenant
// Valida o token da empresa e injeta empresaId em req.empresaId
// ============================================================
const EMPRESAS = require("../empresas.config");

// Verifica se empresa está ativa e no prazo
function empresaValida(empresa) {
  if (!empresa.ativo) return false;
  if (empresa.vencimento) {
    const hoje = new Date().toISOString().split("T")[0];
    if (hoje > empresa.vencimento) return false;
  }
  return true;
}

// ── Middleware de autenticação via header X-Empresa-Token ────
// O token é: base64(login:senha) — mesmo padrão Basic Auth
function authMiddleware(req, res, next) {
  const token = req.headers["x-empresa-token"];
  if (!token) {
    return res.status(401).json({ sucesso: false, erro: "Token de empresa obrigatório" });
  }

  let login, senha;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    [login, senha] = decoded.split(":");
  } catch {
    return res.status(401).json({ sucesso: false, erro: "Token inválido" });
  }

  const empresa = EMPRESAS.find(e => e.login === login && e.senha === senha);
  if (!empresa) {
    return res.status(401).json({ sucesso: false, erro: "Credenciais inválidas" });
  }
  if (!empresaValida(empresa)) {
    return res.status(403).json({ sucesso: false, erro: "Empresa bloqueada ou com acesso expirado" });
  }

  req.empresaId = empresa.empresaId;
  req.empresaNome = empresa.nome;
  next();
}

module.exports = { authMiddleware, empresaValida, EMPRESAS };
