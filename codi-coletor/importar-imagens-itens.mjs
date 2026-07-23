/**
 * Sobe a imagem de cada item pai (produto_raiz do BOM) pro Supabase Storage
 * e grava a URL em codi.produtos_imagens.
 *
 * Fonte: pasta de rede mapeada com uma subpasta por item, padrão
 * "<código> - <nome>", contendo (entre outros arquivos técnicos) uma imagem
 * do produto nomeada "<código> <nome>.png/.jpg". Ignora arquivos que
 * começam com "Processos" (fotos de processo, não do produto).
 *
 * Uso:
 *   node importar-imagens-itens.mjs
 *
 * Variáveis de ambiente necessárias (em .env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PASTA_IMAGENS_ITENS  (default: caminho da rede abaixo)
 *
 * Pré-requisito: rodar migracao/codi_produtos_imagens.sql no Supabase
 * antes (cria a tabela codi.produtos_imagens).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const PASTA_ITENS = process.env.PASTA_IMAGENS_ITENS
  || 'X:\\1. PROJETOS TECNICOS FABRICAÇÃO 16-07-2013';

const BUCKET = 'produtos-imagens';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'codi' } }
);

function extensaoImagem(nome) {
  const m = /\.(png|jpg|jpeg)$/i.exec(nome);
  return m ? m[1].toLowerCase() : null;
}

function contentTypeDe(ext) {
  return ext === 'png' ? 'image/png' : 'image/jpeg';
}

function acharPastaDoItem(pastas, codigo) {
  return pastas.find(p => p.startsWith(codigo + ' ') || p.startsWith(codigo + '-'));
}

function acharImagem(pastaCompleta, codigo) {
  const arquivos = fs.readdirSync(pastaCompleta);
  let candidatas = arquivos.filter(f => extensaoImagem(f) && !/^processos/i.test(f));
  if (candidatas.length > 1) {
    const comPrefixo = candidatas.filter(f => f.startsWith(codigo));
    if (comPrefixo.length >= 1) candidatas = comPrefixo;
  }
  return candidatas;
}

async function garantirBucket() {
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) throw error;
  if (buckets.some(b => b.name === BUCKET)) return;
  const { error: createErr } = await sb.storage.createBucket(BUCKET, { public: true });
  if (createErr) throw createErr;
  console.log(`Bucket "${BUCKET}" criado.`);
}

async function main() {
  console.log(`Pasta de origem: ${PASTA_ITENS}`);
  if (!fs.existsSync(PASTA_ITENS)) {
    console.error('Pasta de rede não encontrada/acessível. Confira o mapeamento da unidade.');
    process.exit(1);
  }

  await garantirBucket();

  const { data: bom, error: bomErr } = await sb.from('bom_estrutura').select('produto_raiz').limit(100000);
  if (bomErr) throw bomErr;
  const codigosPais = [...new Set(bom.map(r => r.produto_raiz))];

  const { data: produtos, error: prodErr } = await sb.from('produtos').select('codigo, nome').in('codigo', codigosPais);
  if (prodErr) throw prodErr;

  const pastas = fs.readdirSync(PASTA_ITENS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const pendencias = [];
  let subidas = 0;

  for (const item of produtos) {
    const { codigo, nome } = item;
    const pasta = acharPastaDoItem(pastas, codigo);
    if (!pasta) {
      pendencias.push({ codigo, nome, motivo: 'sem pasta correspondente na rede' });
      continue;
    }

    const pastaCompleta = path.join(PASTA_ITENS, pasta);
    const candidatas = acharImagem(pastaCompleta, codigo);

    if (candidatas.length === 0) {
      pendencias.push({ codigo, nome, motivo: `sem imagem de produto em "${pasta}"` });
      continue;
    }
    if (candidatas.length > 1) {
      pendencias.push({ codigo, nome, motivo: `ambíguo em "${pasta}": ${candidatas.join(' | ')}` });
      continue;
    }

    const arquivo = candidatas[0];
    const ext = extensaoImagem(arquivo);
    const caminhoArquivo = path.join(pastaCompleta, arquivo);
    const buffer = fs.readFileSync(caminhoArquivo);
    const nomeStorage = `${codigo}.${ext}`;

    const { error: upErr } = await sb.storage.from(BUCKET).upload(nomeStorage, buffer, {
      contentType: contentTypeDe(ext),
      upsert: true,
    });
    if (upErr) {
      pendencias.push({ codigo, nome, motivo: `falha no upload: ${upErr.message}` });
      continue;
    }

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(nomeStorage);
    const { error: dbErr } = await sb.from('produtos_imagens').upsert({
      codigo_item: codigo,
      url: pub.publicUrl,
      atualizado_em: new Date().toISOString(),
    });
    if (dbErr) {
      pendencias.push({ codigo, nome, motivo: `falha ao gravar no banco: ${dbErr.message}` });
      continue;
    }

    subidas++;
    console.log(`✓ ${codigo} — ${nome}  (${arquivo})`);
  }

  console.log(`\n${subidas} imagens subidas com sucesso.`);
  console.log(`${pendencias.length} itens pendentes (revisão manual):`);
  for (const p of pendencias) {
    console.log(`  - ${p.codigo} — ${p.nome}: ${p.motivo}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
