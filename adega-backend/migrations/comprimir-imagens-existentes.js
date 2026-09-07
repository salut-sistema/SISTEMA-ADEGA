// ============================================================
// migrations/comprimir-imagens-existentes.js
// ============================================================
// SCRIPT MANUAL — não roda sozinho, e o server.js NÃO chama esse
// arquivo em nenhum momento. Você que decide quando rodar.
//
// O QUE FAZ:
// Comprime/redimensiona as fotos de PRODUTO que já estão salvas no
// banco (cadastradas antes do Passo 1, quando ainda não existia
// compressão no upload) — mesmo tratamento que já aplicamos nas fotos
// novas, só que aplicado de uma vez nas que já existem.
//
// SEGURANÇA:
//  - Só mexe no campo "imagem" de Produto. Não toca em nenhum outro
//    campo, nem em nenhuma outra coleção (Pedido, Categoria, etc.).
//  - Só grava a versão nova se ela ficar REALMENTE menor que a atual
//    (nunca piora uma imagem).
//  - Pula imagens que já são pequenas (não desperdiça tempo reprocessando
//    o que já está bom).
//  - Pula o que não for um base64 reconhecível (ex: já é uma URL externa).
//  - Pode ser interrompido (Ctrl+C) e rodado de novo depois sem problema
//    — cada produto é processado e salvo individualmente.
//
// COMO RODAR (uma vez, do seu computador — não precisa subir isso pro
// Render, é só uma ferramenta de manutenção):
//
//   1) cd adega-backend
//   2) npm install sharp        (só local, não precisa mexer no package.json
//                                 nem redeployar o servidor por causa disso)
//   3) node migrations/comprimir-imagens-existentes.js
//
// O script usa o MESMO MONGODB_URI do seu arquivo .env — ou seja, ele
// conecta direto no banco de produção (o mesmo que o Render usa) e
// atualiza os produtos por lá. Depois de rodar, é só isso: nada precisa
// ser reiniciado no Render, a próxima vez que alguém abrir a loja ou o
// admin já vai receber as fotos no tamanho novo, menor.
// ============================================================

require("dotenv").config();

// Corrige um problema conhecido do Node.js no Windows: em algumas versões,
// o Node não usa o DNS configurado no sistema operacional pra resolver o
// endereço do MongoDB Atlas, e dá erro "querySrv ECONNREFUSED" mesmo com
// a internet funcionando normalmente. Forçando servidores DNS confiáveis
// aqui, direto no código, resolve isso sem depender de nenhuma
// configuração externa do Windows.
require("node:dns").setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require("mongoose");

let sharp;
try {
  sharp = require("sharp");
} catch (e) {
  console.error("❌ O pacote 'sharp' não está instalado nesta pasta.");
  console.error("   Rode primeiro:  npm install sharp");
  process.exit(1);
}

const { Produto } = require("../models");

const LARGURA_MAX = 800;              // mesmo valor usado no Passo 1 (upload novo)
const QUALIDADE_JPEG = 82;            // mesmo valor usado no Passo 1
const TAMANHO_MINIMO_PARA_COMPRIMIR = 150 * 1024; // 150KB — abaixo disso, nem mexe

// Comprime uma imagem em base64 (data URL) e devolve o novo data URL.
// Devolve null se não for um data URL reconhecível (ex: já é uma URL
// externa tipo https://..., que não precisa e nem dá pra comprimir aqui).
async function comprimirBase64(base64Original) {
  const match = /^data:image\/\w+;base64,(.+)$/.exec(base64Original);
  if (!match) return null;

  const bufferOriginal = Buffer.from(match[1], "base64");
  const bufferComprimido = await sharp(bufferOriginal)
    .resize({ width: LARGURA_MAX, withoutEnlargement: true }) // nunca aumenta
    .jpeg({ quality: QUALIDADE_JPEG })
    .toBuffer();

  return `data:image/jpeg;base64,${bufferComprimido.toString("base64")}`;
}

async function main() {
  console.log("Conectando ao banco...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Conectado. Buscando produtos com imagem em base64...\n");

  // Só traz o necessário (id, nome, imagem) — não precisa do produto
  // inteiro só pra essa checagem/atualização.
  const produtos = await Produto.find({ imagem: { $regex: "^data:image" } })
    .select("_id id nome imagem")
    .lean();

  console.log(`Encontrados ${produtos.length} produto(s) com foto em base64.\n`);

  let comprimidos = 0, jaPequenos = 0, erros = 0, semGanho = 0;
  let economizadoBytes = 0;

  for (const p of produtos) {
    const tamanhoAtual = Buffer.byteLength(p.imagem, "utf8");

    if (tamanhoAtual < TAMANHO_MINIMO_PARA_COMPRIMIR) {
      jaPequenos++;
      continue;
    }

    try {
      const novaImagem = await comprimirBase64(p.imagem);
      if (!novaImagem) { jaPequenos++; continue; }

      const novoTamanho = Buffer.byteLength(novaImagem, "utf8");

      if (novoTamanho < tamanhoAtual) {
        await Produto.updateOne({ _id: p._id }, { $set: { imagem: novaImagem } });
        economizadoBytes += (tamanhoAtual - novoTamanho);
        comprimidos++;
        console.log(`✅ ${p.nome}: ${(tamanhoAtual / 1024).toFixed(0)}KB → ${(novoTamanho / 1024).toFixed(0)}KB`);
      } else {
        semGanho++;
      }
    } catch (e) {
      erros++;
      console.error(`❌ Erro no produto "${p.nome}" (id ${p.id}): ${e.message}`);
    }
  }

  console.log("\n========== RESUMO ==========");
  console.log(`Comprimidos com sucesso : ${comprimidos}`);
  console.log(`Já estavam pequenos     : ${jaPequenos}`);
  console.log(`Sem ganho (mantidos)    : ${semGanho}`);
  console.log(`Erros                   : ${erros}`);
  console.log(`Economia total          : ${(economizadoBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log("=============================\n");

  await mongoose.disconnect();
  console.log("Concluído. Pode fechar o terminal.");
}

main().catch(e => {
  console.error("Erro fatal:", e.message);
  process.exit(1);
});
