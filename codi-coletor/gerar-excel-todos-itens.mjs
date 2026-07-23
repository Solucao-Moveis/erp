/**
 * Gera uma planilha com TODAS as pastas de item da rede (não só os itens pais
 * já cadastrados no ERP), uma linha por pasta, marcando na coluna "Origem"
 * se aquele código já é um item pai do sistema ("Sistema ERP") ou se só
 * existe na pasta de projetos técnicos ("Pasta").
 *
 * Lê as imagens direto da pasta de rede (não depende do Supabase Storage
 * nem da tabela codi.produtos_imagens) — mais rápido e cobre tudo, inclusive
 * o que nunca foi importado pro sistema.
 *
 * Uso:
 *   node gerar-excel-todos-itens.mjs
 *
 * Variáveis de ambiente necessárias (em .env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PASTA_IMAGENS_ITENS  (default: caminho da rede abaixo)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.join(__dirname, 'Itens-Todos-Pasta.xlsx');

const PASTA_ITENS = process.env.PASTA_IMAGENS_ITENS
  || 'X:\\1. PROJETOS TECNICOS FABRICAÇÃO 16-07-2013';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'codi' } }
);

const IMG_W = 140;
const IMG_H = 100;

function extensaoImagem(nome) {
  return /\.(png|jpg|jpeg)$/i.test(nome);
}

function acharImagem(pastaCompleta, codigo) {
  const arquivos = fs.readdirSync(pastaCompleta);
  let candidatas = arquivos.filter(f => extensaoImagem(f) && !/^processos/i.test(f));
  if (candidatas.length > 1 && codigo) {
    const comPrefixo = candidatas.filter(f => f.startsWith(codigo));
    if (comPrefixo.length >= 1) candidatas = comPrefixo;
  }
  candidatas.sort();
  return candidatas[0] ?? null;
}

function parsePasta(nomePasta) {
  const m = /^(\d+)\s*[-–]\s*(.+)$/.exec(nomePasta);
  if (m) return { codigo: m[1], nomeDaPasta: m[2].trim() };
  return { codigo: null, nomeDaPasta: nomePasta };
}

async function pngBufferDoArquivo(caminho) {
  const buf = fs.readFileSync(caminho);
  return sharp(buf)
    .resize(IMG_W, IMG_H, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(PASTA_ITENS)) {
    console.error('Pasta de rede não encontrada/acessível. Confira o mapeamento da unidade.');
    process.exit(1);
  }

  const { data: bom, error: bomErr } = await sb.from('bom_estrutura').select('produto_raiz').limit(100000);
  if (bomErr) throw bomErr;
  const codigosPais = new Set(bom.map(r => r.produto_raiz));

  const pastas = fs.readdirSync(PASTA_ITENS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const codigosExtraidos = pastas.map(p => parsePasta(p).codigo).filter(Boolean);
  const { data: produtos, error: prodErr } = await sb
    .from('produtos')
    .select('codigo, nome')
    .in('codigo', codigosExtraidos);
  if (prodErr) throw prodErr;
  const nomesProdutos = new Map(produtos.map(p => [p.codigo, p.nome]));

  console.log(`${pastas.length} pastas encontradas. ${codigosPais.size} itens pais no sistema ERP.`);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Itens (pasta completa)');

  ws.columns = [
    { header: 'Código', key: 'codigo', width: 14 },
    { header: 'Imagem', key: 'imagem', width: 24 },
    { header: 'Descrição', key: 'descricao', width: 42 },
    { header: 'Situação', key: 'situacao', width: 20 },
    { header: 'Origem', key: 'origem', width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).height = 20;

  const ROW_H = 110;
  let comImagem = 0, semImagem = 0, sistemaErp = 0, soPasta = 0;

  for (const [i, nomePasta] of pastas.entries()) {
    const { codigo, nomeDaPasta } = parsePasta(nomePasta);
    const rowNumber = i + 2;
    const origem = codigo && codigosPais.has(codigo) ? 'Sistema ERP' : 'Pasta';
    if (origem === 'Sistema ERP') sistemaErp++; else soPasta++;

    const descricao = (codigo && nomesProdutos.get(codigo)) || nomeDaPasta;

    const pastaCompleta = path.join(PASTA_ITENS, nomePasta);
    const arquivoImagem = acharImagem(pastaCompleta, codigo);

    const row = ws.addRow({
      codigo: codigo ?? '—',
      imagem: '',
      descricao,
      situacao: arquivoImagem ? 'OK' : 'Em busca de imagem',
      origem,
    });
    row.height = ROW_H;
    row.alignment = { vertical: 'middle' };

    if (arquivoImagem) {
      try {
        const png = await pngBufferDoArquivo(path.join(pastaCompleta, arquivoImagem));
        const imgId = wb.addImage({ buffer: png, extension: 'png' });
        ws.addImage(imgId, {
          tl: { col: 1.15, row: rowNumber - 1 + 0.1 },
          ext: { width: 130, height: 93 },
          editAs: 'oneCell',
        });
        comImagem++;
      } catch (e) {
        console.warn(`  ⚠ falha ao processar imagem de "${nomePasta}": ${e.message}`);
        semImagem++;
      }
    } else {
      semImagem++;
    }
  }

  ws.getColumn('situacao').eachCell((cell, rowNum) => {
    if (rowNum === 1) return;
    if (cell.value === 'Em busca de imagem') {
      cell.font = { italic: true, color: { argb: 'FF999999' } };
    }
  });
  ws.getColumn('origem').eachCell((cell, rowNum) => {
    if (rowNum === 1) return;
    if (cell.value === 'Sistema ERP') {
      cell.font = { bold: true, color: { argb: 'FF1B7A43' } };
    } else {
      cell.font = { color: { argb: 'FF888888' } };
    }
  });

  await wb.xlsx.writeFile(SAIDA);
  console.log(`\n${comImagem} com imagem, ${semImagem} sem imagem.`);
  console.log(`${sistemaErp} marcados "Sistema ERP", ${soPasta} marcados "Pasta".`);
  console.log(`Planilha salva em: ${SAIDA}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
