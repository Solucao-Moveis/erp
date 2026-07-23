/**
 * Gera uma planilha (uma linha por item pai) com código, imagem (miniatura
 * embutida na célula), descrição e situação — pra o time poder acrescentar
 * colunas próprias por cima. Item sem imagem cadastrada em
 * codi.produtos_imagens fica com a situação "Em busca de imagem".
 *
 * Uso:
 *   node gerar-excel-itens.mjs
 *
 * Variáveis de ambiente necessárias (em .env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.join(__dirname, 'Itens-Pais.xlsx');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'codi' } }
);

// Canvas fixo (140x100, fundo branco) — garante que toda imagem embutida tenha
// exatamente as mesmas dimensões, sem esticar/distorcer e sem depender do
// aspecto de cada render pra caber direito na linha.
const IMG_W = 140;
const IMG_H = 100;

async function baixarComoPngBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return sharp(buf)
    .resize(IMG_W, IMG_H, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

async function main() {
  const { data: bom, error: bomErr } = await sb.from('bom_estrutura').select('produto_raiz').limit(100000);
  if (bomErr) throw bomErr;
  const codigosPais = [...new Set(bom.map(r => r.produto_raiz))];

  const { data: produtos, error: prodErr } = await sb
    .from('produtos')
    .select('codigo, nome')
    .in('codigo', codigosPais);
  if (prodErr) throw prodErr;
  produtos.sort((a, b) => a.codigo.localeCompare(b.codigo));

  const { data: imagens, error: imgErr } = await sb.from('produtos_imagens').select('codigo_item, url');
  if (imgErr) throw imgErr;
  const mapaImagens = new Map(imagens.map(i => [i.codigo_item, i.url]));

  console.log(`${produtos.length} itens pais. ${imagens.length} com imagem cadastrada.`);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Itens Pais');

  ws.columns = [
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Imagem', key: 'imagem', width: 24 },
    { header: 'Descrição', key: 'descricao', width: 42 },
    { header: 'Situação', key: 'situacao', width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).height = 20;

  const ROW_H = 110; // pt (~147px) — folga clara acima/abaixo da miniatura de 93px

  for (const [i, p] of produtos.entries()) {
    const rowNumber = i + 2;
    const row = ws.addRow({
      codigo: p.codigo,
      imagem: '',
      descricao: p.nome ?? '—',
      situacao: mapaImagens.has(p.codigo) ? 'OK' : 'Em busca de imagem',
    });
    row.height = ROW_H;
    row.alignment = { vertical: 'middle' };

    const url = mapaImagens.get(p.codigo);
    if (url) {
      try {
        const png = await baixarComoPngBuffer(url);
        if (png) {
          const imgId = wb.addImage({ buffer: png, extension: 'png' });
          ws.addImage(imgId, {
            tl: { col: 1.15, row: rowNumber - 1 + 0.1 },
            ext: { width: 130, height: 93 },
            editAs: 'oneCell',
          });
        }
      } catch (e) {
        console.warn(`  ⚠ falha ao baixar imagem de ${p.codigo}: ${e.message}`);
      }
    }
  }

  ws.getColumn('situacao').eachCell((cell, rowNum) => {
    if (rowNum === 1) return;
    if (cell.value === 'Em busca de imagem') {
      cell.font = { italic: true, color: { argb: 'FF999999' } };
    }
  });

  await wb.xlsx.writeFile(SAIDA);
  console.log(`Planilha salva em: ${SAIDA}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
