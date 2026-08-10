// ============================================================
// migrations/migrar-data-pedidos.js
// ============================================================
// Converte o campo Pedido.data de String (formato antigo, ex:
// "2025-06-12T14:30:00.000Z") para Date real (novo tipo do schema).
//
// SEGURA PARA RODAR VÁRIAS VEZES (idempotente): primeiro verifica se
// existe algum documento com "data" ainda em formato string; se não
// existir nenhum, não faz nada (fica praticamente instantânea). Por
// isso é chamada automaticamente a cada start do servidor (ver
// server.js) sem custo relevante depois da primeira vez.
//
// Também pode ser rodada manualmente, uma única vez, com:
//   node migrations/migrar-data-pedidos.js
// ============================================================

async function migrarDatasPedidos(PedidoModel) {
  // Verificação rápida e barata: existe algum documento com "data"
  // gravado como string no banco? Usa o driver nativo (collection)
  // para o $type, porque o Mongoose já força o schema (Date) nas
  // buscas normais do Model.
  const colecao = PedidoModel.collection;
  const existeStringAntiga = await colecao.findOne(
    { data: { $type: "string" } },
    { projection: { _id: 1 } }
  );

  if (!existeStringAntiga) {
    return { migrados: 0, jaEstavaAtualizado: true };
  }

  // Converte em massa, no próprio banco, via pipeline de update
  // ($toDate é suportado a partir do MongoDB 4.2+). Só afeta os
  // documentos onde "data" ainda é string — os que já são Date
  // não são tocados.
  const resultado = await colecao.updateMany(
    { data: { $type: "string" } },
    [{ $set: { data: { $toDate: "$data" } } }]
  );

  return { migrados: resultado.modifiedCount || 0, jaEstavaAtualizado: false };
}

module.exports = { migrarDatasPedidos };

// Permite rodar manualmente: node migrations/migrar-data-pedidos.js
if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const { Pedido } = require("../models");

  (async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Conectado ao banco. Verificando pedidos com data em formato antigo...");
      const resultado = await migrarDatasPedidos(Pedido);
      if (resultado.jaEstavaAtualizado) {
        console.log("Nada a migrar — todos os pedidos já usam o novo formato de data.");
      } else {
        console.log(`Migração concluída: ${resultado.migrados} pedido(s) convertido(s).`);
      }
    } catch (e) {
      console.error("Erro na migração:", e.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
