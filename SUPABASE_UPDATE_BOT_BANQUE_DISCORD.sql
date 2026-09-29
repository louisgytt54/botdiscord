-- ══════════════════════════════════════════════════════════════
-- BOT DISCORD — Commande /banque : ajout/retrait de crédits depuis Discord.
--
-- N'utilise PAS de numéro de la séquence SUPABASE_UPDATE_00XX du jeu (pour
-- éviter toute collision avec sa numérotation) : ce fichier est propre au
-- bot et vient se brancher sur le système économique DÉJÀ existant :
--   · public.player_wallets(user_id, credits, updated_at)  — 0017
--   · public.player_transactions(...)                       — 0004
-- Il n'ajoute AUCUNE nouvelle table de solde/portefeuille.
--
-- Seule addition : une fonction security definer atomique, appelée
-- uniquement par le bot (clé SERVICE_ROLE_KEY, jamais grantée à
-- `authenticated`) qui crédite/débite `player_wallets.credits` et
-- journalise l'opération dans `player_transactions` comme n'importe quelle
-- autre transaction du jeu.
-- ══════════════════════════════════════════════════════════════

-- "create or replace" ne peut pas changer le type de retour d'une fonction
-- existante (ici le nom de la colonne de sortie change) : on la supprime
-- d'abord si une version précédente a déjà été exécutée.
drop function if exists public.bank_admin_adjust_wallet(uuid, bigint, text, text);

create or replace function public.bank_admin_adjust_wallet(
  p_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_actor_discord_id text
)
returns table (new_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current bigint;
  v_new_credits bigint;
begin
  if p_amount = 0 then
    raise exception 'Le montant ne peut pas être nul';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Joueur introuvable';
  end if;

  -- Crée le portefeuille s'il n'existe pas encore (ne devrait normalement
  -- pas arriver, 0017 initialise tous les joueurs existants), sans écraser
  -- un portefeuille déjà là.
  insert into public.player_wallets (user_id, credits)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  -- Référence qualifiée (public.player_wallets.credits) : le nom de
  -- colonne "credits" tout court était auparavant ambigu avec le nom du
  -- paramètre de sortie de la fonction (RETURNS TABLE), d'où l'erreur
  -- "column reference is ambiguous" — la colonne de sortie s'appelle
  -- maintenant new_balance pour écarter toute ambiguïté future.
  select public.player_wallets.credits into v_current
  from public.player_wallets
  where user_id = p_user_id
  for update;

  v_new_credits := v_current + p_amount;

  if v_new_credits < 0 then
    raise exception 'Solde insuffisant : % crédits disponibles, % demandés', v_current, -p_amount;
  end if;

  update public.player_wallets
  set credits = v_new_credits, updated_at = now()
  where user_id = p_user_id;

  insert into public.player_transactions (
    user_id, transaction_id, type, amount, description, reference, balance_after
  ) values (
    p_user_id,
    'discord-' || gen_random_uuid()::text,
    case when p_amount > 0 then 'ADMIN_CREDIT' else 'ADMIN_DEBIT' end,
    p_amount,
    p_reason,
    'discord:' || p_actor_discord_id,
    v_new_credits
  );

  return query select v_new_credits;
end;
$$;

-- IMPORTANT : pas de "grant ... to authenticated". Seul le bot, via la clé
-- SERVICE_ROLE_KEY, doit pouvoir appeler cette fonction — le jeu (client
-- authenticated) ne doit jamais pouvoir créditer/débiter un portefeuille
-- par ce chemin.

notify pgrst, 'reload schema';
