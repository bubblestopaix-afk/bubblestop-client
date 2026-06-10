-- ============================================
-- SCHÉMA V2 — synchro catalogue + ouverture
-- À coller dans Supabase > SQL Editor > Run
-- (après schema.sql déjà exécuté)
-- ============================================

-- Carte publiée par la caisse (catalogue + overrides fusionnés).
-- Écrite uniquement par le POS (clé service_role), lue par l'appli.
create table public.catalogue_cloud (
  id text primary key,             -- 'principal'
  data jsonb not null,             -- { categories: [...], toppings: [...] }
  updated_at timestamptz not null default now()
);

-- Configuration boutique (commandes en ligne ouvertes/fermées)
create table public.boutique_config (
  id text primary key,             -- 'principal'
  commandes_ouvertes boolean not null default true,
  message_fermeture text,          -- affiché dans l'appli quand fermé
  updated_at timestamptz not null default now()
);
insert into public.boutique_config (id) values ('principal');

-- Lecture publique (la carte et l'état d'ouverture ne sont pas des secrets) ;
-- aucune policy d'écriture → seule la clé service_role (caisse) peut modifier.
alter table public.catalogue_cloud enable row level security;
alter table public.boutique_config enable row level security;
create policy "catalogue: lecture publique" on public.catalogue_cloud
  for select using (true);
create policy "config: lecture publique" on public.boutique_config
  for select using (true);

-- ============================================
-- Blocage serveur : refus des commandes quand
-- la boutique est fermée (vraie protection,
-- pas seulement un message dans l'appli).
-- ============================================
create or replace function public.verifier_ouverture()
returns trigger
language plpgsql
security definer
as $$
begin
  if exists (
    select 1 from public.boutique_config
    where id = 'principal' and commandes_ouvertes = false
  ) then
    raise exception 'BOUTIQUE_FERMEE';
  end if;
  return new;
end;
$$;

create trigger commandes_verifier_ouverture
  before insert on public.commandes
  for each row execute function public.verifier_ouverture();
