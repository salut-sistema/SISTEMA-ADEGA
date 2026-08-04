// Uso (PowerShell):
// $env:EMPRESA_NOME='Minha Adega'; $env:EMPRESA_LOGIN='minhaadega';
// $env:EMPRESA_SENHA='uma-senha-forte'; $env:EMPRESA_SLUG='minha-adega'; npm run criar-empresa
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Empresa } = require("./models");

async function main() {
  const { EMPRESA_NOME: nome, EMPRESA_LOGIN: login, EMPRESA_SENHA: senha, EMPRESA_SLUG: slug, EMPRESA_VENCIMENTO: vencimento = "", EMPRESA_ENDERECO: endereco = "" } = process.env;
  if (![nome, login, senha, slug].every(Boolean)) throw new Error("Informe EMPRESA_NOME, EMPRESA_LOGIN, EMPRESA_SENHA e EMPRESA_SLUG.");
  await mongoose.connect(process.env.MONGODB_URI);
  const empresaId = `${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
  await Empresa.create({ empresaId, nome, login, senhaHash: await bcrypt.hash(senha, 12), slug, vencimento: vencimento || null, endereco, ativo: true });
  console.log(`Empresa criada: ${nome} (${empresaId})`);
  await mongoose.disconnect();
}
main().catch(async e => { console.error(e.message); await mongoose.disconnect(); process.exit(1); });
