// ============================================================
// migrations/migrar-movimentacoes-estoque-base.js
// ============================================================
// Etapa 6: move o histórico que vivia embutido em
// EstoqueBase.movimentacoes (um array que só crescia dentro do próprio
// documento) para a nova coleção própria MovimentacaoEstoqueBase.
//
// SEGURA PARA RODAR VÁRIAS VEZES (idempotente): só processa documentos
// de EstoqueBase que ainda têm o campo "movimentacoes" antigo com pelo
// menos 1 item. Depois de migrado, o campo é removido do documento —
// então, depois da primeira vez, essa checagem fica praticamente
// instantânea nos deploys seguintes (mesmo padrão da migração de datas).
//
// Também pode ser rodada manualmente, uma única vez, com:
//   node migrations/migrar-movimentacoes-estoque-base.js
// ============================================================

async function migrarMovimentacoesEstoqueBase(EstoqueBaseModel, MovimentacaoEstoqueBaseModel) {
  const colecao = EstoqueBaseModel.collection;

  // Verificação rápida: existe algum EstoqueBase com o array antigo
  // ainda presente e não-vazio?
  const existeAntigo = await colecao.findOne(
    { movimentacoes: { $exists: true, $not: { $size: 0 } } },
    { projection: { _id: 1 } }
  );

  if (!existeAntigo) {
    // Mesmo sem nada pra migrar, garante que o campo antigo (se existir
    // vazio em algum documento) seja removido — limpeza de sobra.
    await colecao.updateMany({ movimentacoes: { $exists: true } }, { $unset: { movimentacoes: "" } });
    return { migrados: 0, jaEstavaAtualizado: true };
  }

  const cursor = colecao.find(
    { movimentacoes: { $exists: true, $not: { $size: 0 } } },
    { projection: { id: 1, empresaId: 1, movimentacoes: 1 } }
  );

  let totalDocumentos = 0;
  let totalMovimentacoes = 0;

  while (await cursor.hasNext()) {
    const eb = await cursor.next();
    const registros = (eb.movimentacoes || []).map(m => ({
      empresaId:     eb.empresaId,
      estoqueBaseId: eb.id,
      tipo:          m.tipo,
      quantidade:    m.quantidade,
      descricao:     m.descricao || "",
      pedidoId:      m.pedidoId || "",
      // O campo antigo guardava a data como string ISO — o schema novo
      // já converte automaticamente pra Date real na inserção.
      data:          m.data ? new Date(m.data) : new Date(),
    }));

    if (registros.length) {
      await MovimentacaoEstoqueBaseModel.insertMany(registros, { ordered: false });
      totalMovimentacoes += registros.length;
    }
    totalDocumentos++;
  }

  // Remove o array embutido de TODOS os documentos (inclusive os que já
  // estavam vazios) — é isso que faz o EstoqueBase ficar leve dali em diante.
  await colecao.updateMany({ movimentacoes: { $exists: true } }, { $unset: { movimentacoes: "" } });

  return { migrados: totalDocumentos, movimentacoes: totalMovimentacoes, jaEstavaAtualizado: false };
}

module.exports = { migrarMovimentacoesEstoqueBase };

// Permite rodar manualmente: node migrations/migrar-movimentacoes-estoque-base.js
if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const { EstoqueBase, MovimentacaoEstoqueBase } = require("../models");

  (async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Conectado ao banco. Verificando estoques-base com histórico embutido...");
      const resultado = await migrarMovimentacoesEstoqueBase(EstoqueBase, MovimentacaoEstoqueBase);
      if (resultado.jaEstavaAtualizado) {
        console.log("Nada a migrar — todos os estoques-base já usam a coleção própria.");
      } else {
        console.log(`Migração concluída: ${resultado.movimentacoes} movimentação(ões) de ${resultado.migrados} estoque(s)-base movida(s) para a nova coleção.`);
      }
    } catch (e) {
      console.error("Erro na migração:", e.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
