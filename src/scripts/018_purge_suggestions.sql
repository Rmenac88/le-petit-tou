-- ==============================================================================
-- LE PETIT TOU — 018 : purge des suggestions d'adresses (D2-03)
--
-- À lancer APRÈS 007. Dans Supabase -> SQL Editor -> New query -> Run. Aucun secret à remplacer.
-- Résultat attendu : "Success. No rows returned" (ou une note si pg_cron n'est pas activée).
-- Relançable sans danger.
--
-- Pourquoi : les suggestions d'adresses (texte libre jusqu'à 1000 caractères, rattaché à
-- l'identifiant d'appareil) n'étaient jamais supprimées, alors que la politique de
-- confidentialité annonce 24 mois. Cette fonction les supprime au bout de 24 mois, quel que
-- soit leur statut. Elle s'exécute chaque nuit à 3 h 30, à côté de la purge existante.
-- ==============================================================================

begin;

create or replace function public.purge_old_suggestions(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0;
begin
  if to_regclass('public.place_suggestions') is not null then
    delete from public.place_suggestions where created_at < p_now - interval '24 months';
    get diagnostics v_count = row_count;
  end if;
  return v_count;
end;
$$;
revoke all on function public.purge_old_suggestions(timestamptz) from public, anon, authenticated;

do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron absente : active-la (Database > Extensions) puis relance ce script, ou lance select public.purge_old_suggestions(); de temps en temps.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'lpt-purge-suggestions';
  perform cron.schedule('lpt-purge-suggestions', '30 3 * * *', 'select public.purge_old_suggestions()');
exception when others then
  raise notice 'Planification impossible (%).', sqlerrm;
end
$$;

commit;
