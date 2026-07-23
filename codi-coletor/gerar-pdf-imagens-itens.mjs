/**
 * Gera um PDF catálogo com código + imagem + descrição de todos os itens pais
 * (produto_raiz de codi.bom_estrutura). Item sem imagem cadastrada em
 * codi.produtos_imagens aparece com o texto "Em busca de imagem".
 *
 * Uso:
 *   node gerar-pdf-imagens-itens.mjs
 *
 * Variáveis de ambiente necessárias (em .env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { jsPDF } from 'jspdf';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.join(__dirname, 'Catalogo-Itens-Pais.pdf');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'codi' } }
);

/** Baixa, redimensiona (máx 500px no maior lado) e recomprime como JPEG — a imagem
 * original pode ter mais de 1MB (render em alta resolução), o que deixaria o PDF
 * de ~90 itens com dezenas de MB sem necessidade nenhuma pra exibição em card pequeno. */
async function baixarComoJpegBase64(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const jpeg = await sharp(buf)
    .flatten({ background: '#ffffff' })
    .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
  return jpeg.toString('base64');
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

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const M = 10;
  const COLS = 3;
  const GAP = 4;
  const cardW = (210 - 2 * M - (COLS - 1) * GAP) / COLS;
  const cardH = 62;
  const imgH = 42;
  const PAGE_BOTTOM = 287;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Catálogo de Itens Pais', M, M + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}   ·   ${produtos.length} itens`, M, M + 9);
  doc.setTextColor(0, 0, 0);

  let y = M + 15;
  let col = 0;

  for (const p of produtos) {
    if (y + cardH > PAGE_BOTTOM) {
      doc.addPage();
      y = M;
      col = 0;
    }
    const x = M + col * (cardW + GAP);

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.rect(x, y, cardW, cardH);

    const url = mapaImagens.get(p.codigo);
    if (url) {
      try {
        const b64 = await baixarComoJpegBase64(url);
        if (b64) {
          doc.addImage(`data:image/jpeg;base64,${b64}`, 'JPEG', x + 2, y + 2, cardW - 4, imgH, undefined, 'FAST');
        } else {
          throw new Error('download vazio');
        }
      } catch {
        doc.setDrawColor(230, 230, 230);
        doc.setFillColor(248, 248, 248);
        doc.rect(x + 2, y + 2, cardW - 4, imgH, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(160, 160, 160);
        doc.text('Em busca de imagem', x + cardW / 2, y + 2 + imgH / 2, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }
    } else {
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(248, 248, 248);
      doc.rect(x + 2, y + 2, cardW - 4, imgH, 'FD');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(160, 160, 160);
      doc.text('Em busca de imagem', x + cardW / 2, y + 2 + imgH / 2, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(p.codigo, x + 2, y + imgH + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const nomeLinhas = doc.splitTextToSize(p.nome ?? '—', cardW - 4);
    doc.text(nomeLinhas.slice(0, 2), x + 2, y + imgH + 11);

    col++;
    if (col >= COLS) {
      col = 0;
      y += cardH + GAP;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`${i}/${pageCount}`, 210 - M, 293, { align: 'right' });
  }

  fs.writeFileSync(SAIDA, Buffer.from(doc.output('arraybuffer')));
  console.log(`PDF salvo em: ${SAIDA}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
