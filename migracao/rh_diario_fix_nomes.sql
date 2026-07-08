-- ═══════════════════════════════════════════════════════════════════════
-- RH — Corrige nomes abreviados no diario para bater com o cadastro
-- Rodar DEPOIS do rh_colaboradores_seed.sql
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- mapeamento: nome abreviado → nome completo (igual ao Excel / cadastro)
  nome_map jsonb := '{
    "Arilson Santana": "ARILSON SANTANA AZEVEDO",
    "Arilson":         "ARILSON SANTANA AZEVEDO",
    "Ketlen Rocha":    "KETLEN ROCHA DIAS",
    "Nathalia Vieira": "NATHALIA VIEIRA DA SILVA",
    "Avesta":          "AVESTA SHOKRIAN DOS SANTOS",
    "Ricardo":         "RICARDO MARTINS SANTIAGO",
    "Carlos Henrique": "CARLOS HENRIQUE BARBOSA MARQUES",
    "Vitor Renan":     "VITOR RENAN SILVA DA CONCEICAO"
  }';

  -- "João Santana" não consta no Excel — verifique manualmente:
  --   se for JOAO TOMAZ DOS SANTOS (Solda), adicione à lista acima:
  --   "João Santana": "JOAO TOMAZ DOS SANTOS"

  r              RECORD;
  setor_key      text;
  lista          jsonb;
  item           jsonb;
  new_lista      jsonb;
  new_ausentes   jsonb;
BEGIN
  FOR r IN
    SELECT id, payload
    FROM rh.diario
    WHERE payload ? 'ausentes'
  LOOP
    new_ausentes := r.payload -> 'ausentes';

    FOR setor_key IN
      SELECT jsonb_object_keys(r.payload -> 'ausentes')
    LOOP
      lista := r.payload -> 'ausentes' -> setor_key;
      new_lista := '[]'::jsonb;

      FOR item IN SELECT * FROM jsonb_array_elements(lista) LOOP
        IF nome_map ? (item ->> 'nome') THEN
          item := jsonb_set(item, '{nome}',
                    to_jsonb(nome_map ->> (item ->> 'nome')));
        END IF;
        new_lista := new_lista || jsonb_build_array(item);
      END LOOP;

      new_ausentes := jsonb_set(new_ausentes, ARRAY[setor_key], new_lista);
    END LOOP;

    UPDATE rh.diario
    SET payload = jsonb_set(r.payload, '{ausentes}', new_ausentes)
    WHERE id = r.id;
  END LOOP;

  RAISE NOTICE 'Nomes corrigidos no diario.';
END $$;
