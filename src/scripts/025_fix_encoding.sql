-- ==============================================================================
-- LE PETIT TOU — MIGRATION 025 : ACCENTS ABÎMÉS DANS LES FONCTIONS (NOTIFICATIONS « Nouvel √©v√©nement »)
--
-- Indépendante. Atomique (begin/commit) et rejouable. Ne touche aucune donnée de l appli (adresses, événements,
-- offres : vérifiées saines), seulement le TEXTE des fonctions abîmées et le titre des notifications déjà parties.
--
-- Cause : certains scripts (007, 010, 011, 012…) ont été collés dans le SQL Editor depuis un fichier lu comme du
-- « Mac Roman » au lieu de l UTF-8 : « é » est devenu « √© », « — » est devenu « ‚Äî », les emojis aussi.
-- Les notifications automatiques (événements, agenda, nouvelles adresses) et des messages du portail en héritent.
-- Réparation : chaque caractère abîmé est ramené à l octet d origine, puis le texte est relu en UTF-8 (inversion
-- exacte, vérifiée). Une fonction dont le texte ne s inverse pas proprement n est PAS modifiée (simple avertissement).
-- ==============================================================================

begin;

-- Les 128 caractères « Mac Roman » des octets 0x80 à 0xFF, dans l ordre (écrits en échappements Unicode)
create or replace function public._lpt_unmangle_macroman(p text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_tbl constant text := U&'\00C4\00C5\00C7\00C9\00D1\00D6\00DC\00E1\00E0\00E2\00E4\00E3\00E5\00E7\00E9\00E8\00EA\00EB\00ED\00EC\00EE\00EF\00F1\00F3\00F2\00F4\00F6\00F5\00FA\00F9\00FB\00FC\2020\00B0\00A2\00A3\00A7\2022\00B6\00DF\00AE\00A9\2122\00B4\00A8\2260\00C6\00D8\221E\00B1\2264\2265\00A5\00B5\2202\2211\220F\03C0\222B\00AA\00BA\03A9\00E6\00F8\00BF\00A1\00AC\221A\0192\2248\2206\00AB\00BB\2026\00A0\00C0\00C3\00D5\0152\0153\2013\2014\201C\201D\2018\2019\00F7\25CA\00FF\0178\2044\20AC\2039\203A\FB01\FB02\2021\00B7\201A\201E\2030\00C2\00CA\00C1\00CB\00C8\00CD\00CE\00CF\00CC\00D3\00D4\F8FF\00D2\00DA\00DB\00D9\0131\02C6\02DC\00AF\02D8\02D9\02DA\00B8\02DD\02DB\02C7';
  v_bytes bytea := ''::bytea;
  v_ch text;
  v_pos integer;
  i integer;
begin
  if p is null then
    return null;
  end if;
  for i in 1 .. length(p) loop
    v_ch := substr(p, i, 1);
    if ascii(v_ch) < 128 then
      v_bytes := v_bytes || convert_to(v_ch, 'UTF8');
    else
      v_pos := strpos(v_tbl, v_ch);
      if v_pos = 0 then
        raise exception 'caractere hors table : %', v_ch;
      end if;
      v_bytes := v_bytes || set_byte('\x00'::bytea, 0, 127 + v_pos);
    end if;
  end loop;
  return convert_from(v_bytes, 'UTF8');
end;
$$;
revoke all on function public._lpt_unmangle_macroman(text) from public, anon, authenticated;

do $$
declare
  r record;
  v_def text;
  v_new text;
  v_fixed integer := 0;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname <> '_lpt_unmangle_macroman'
       and p.prosrc ~ '(√|‚Ä|¬[«»·´ª ])'
  loop
    v_def := pg_get_functiondef(r.oid);
    begin
      v_new := public._lpt_unmangle_macroman(v_def);
    exception when others then
      raise notice '% : texte non réparable automatiquement, laissé tel quel (%).', r.proname, sqlerrm;
      continue;
    end;
    if v_new is distinct from v_def then
      execute v_new;
      v_fixed := v_fixed + 1;
    end if;
  end loop;
  raise notice '% fonction(s) réparée(s).', v_fixed;

  -- Titres et textes des notifications déjà enregistrées
  update public.push_outbox
     set title = public._lpt_unmangle_macroman(title),
         body = public._lpt_unmangle_macroman(body)
   where coalesce(title, '') || coalesce(body, '') ~ '(√|‚Ä|¬)';
exception when others then
  raise;
end
$$;

commit;

notify pgrst, 'reload schema';
