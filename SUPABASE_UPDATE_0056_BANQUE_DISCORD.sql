-- ══════════════════════════════════════════════════════════════
-- PROJECT 112 — 0056 : Banque du joueur, pilotée depuis Discord.
--
-- Aucune table "banque" n'existait encore : ce fichier ajoute un solde
-- (`balance`) sur `profiles` et un historique (`bank_transactions`).
-- Écrit dans le même style que SUPABASE_UPDATE_0055_SUPPORT_DISCORD.sql :
-- la seule écriture possible passe par une fonction `security definer`
-- (`adjust_player_balance`), atomique (transaction annulée si le solde
-- deviendrait négatif), qui journalise chaque mouvement. AUCUN grant vers
-- `authenticated` : contrairement aux RPC de 0055, celle-ci n'est appelée
-- QUE par le bot Discord (clé service_role) — le jeu ne doit jamais pouvoir
-- modifier un solde lui-même, seulement le lire.
-- ══════════════════════════════════════════════════════════════

-- ── Solde ─────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists balance bigint not null default 0;

alter table public.profiles
  drop constraint if exists profiles_balance_non_negative;
alter table public.profiles
  add constraint profiles_balance_non_negative check (balance >= 0);

-- La policy "read own profile" existante (0001_access_control.sql) couvre
-- déjà cette nouvelle colonne : RLS s'applique par ligne, pas par colonne.

-- ── Historique des mouvements ────────────────────────────────
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount <> 0),   -- positif = crédit, négatif = débit
  reason text,
  actor_discord_id text not null,               -- qui a fait l'opération côté Discord
  balance_after bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists bank_transactions_profile_created_idx
  on public.bank_transactions(profile_id, created_at desc);

alter table public.bank_transactions enable row level security;
drop policy if exists "read own bank transactions" on public.bank_transactions;
create policy "read own bank transactions"
on public.bank_transactions for select
to authenticated
using (profile_id = auth.uid());
-- Aucun INSERT/UPDATE/DELETE client : uniquement via adjust_player_balance
-- (security definer) appelée par le bot en service_role.

-- ── Fonction d'écriture atomique (bot uniquement) ────────────
create or replace function public.adjust_player_balance(
  p_profile_id uuid,
  p_amount bigint,
  p_reason text,
  p_actor_discord_id text
)
returns table (balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
begin
  if p_amount = 0 then
    raise exception 'Le montant ne peut pas être nul';
  end if;

  update public.profiles
  set balance = balance + p_amount,
      updated_at = now()
  where id = p_profile_id
  returning public.profiles.balance into v_new_balance;

  if not found then
    raise exception 'Joueur introuvable (profil %)', p_profile_id;
  end if;

  if v_new_balance < 0 then
    -- La mise à jour ci-dessus est annulée avec toute la transaction
    -- (exception non interceptée = rollback complet de l'appel RPC).
    raise exception 'Solde insuffisant pour retirer ce montant';
  end if;

  insert into public.bank_transactions (profile_id, amount, reason, actor_discord_id, balance_after)
  values (p_profile_id, p_amount, p_reason, p_actor_discord_id, v_new_balance);

  return query select v_new_balance;
end;
$$;

-- IMPORTANT : pas de "grant ... to authenticated" ici (contrairement aux RPC
-- de la mise à jour 0055). Seul le bot, via la clé SERVICE_ROLE_KEY, doit
-- pouvoir appeler cette fonction — le service_role contourne de toute façon
-- les grants explicites, donc n'accorder l'exécution à personne d'autre
-- suffit à empêcher le jeu (client authenticated) de modifier un solde.

-- ── Realtime (le jeu peut afficher le solde en temps réel) ────
do $$ begin
  alter publication supabase_realtime add table public.bank_transactions;
exception when duplicate_object then null; end $$;
