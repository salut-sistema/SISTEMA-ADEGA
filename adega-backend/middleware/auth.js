// ============================================================
// middleware/auth.js — Autenticação e isolamento multi-tenant
// Valida o token da empresa e injeta empresaId em req.empresaId
// ============================================================
const { EMPRESAS } = require("../empresasConfig");

// Verifica se empresa está ativa e no prazo
function empresaValida(empresa) {
  if (!empresa.ativo) return false;
  if (empresa.vencimento) {
    // Compara datas usando Date para evitar problemas de fuso horário
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(empresa.vencimento + "T00:00:00");
    // Bloqueia se hoje é APÓS o dia de vencimento (vencimento = último dia de acesso)
    if (hoje > venc) return false;
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
