-- ============================================
-- SCHÉMA BUBBLESTOP CLIENT — à coller dans
-- Supabase > SQL Editor > New query > Run
-- ============================================

-- Profil client (lié au compte auth Supabase)
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text,
  telephone text,
  numero_fidelite text unique, -- même numéro que le QR du POS
  prenom_sur_ticket boolean not null default true,
  created_at timestamptz not null default now()
);

-- Commandes (click & collect)
create table public.commandes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profils (id) on delete cascade,
  numero serial, -- numéro court affiché au client et en caisse
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'en_preparation', 'prete', 'recuperee', 'annulee')),
  creneau_retrait timestamptz, -- heure de retrait choisie
  total_cents integer not null default 0, -- total en centimes (jamais de float pour l'argent)
  mode_paiement text not null default 'sur_place'
    check (mode_paiement in ('sur_place', 'en_ligne')),
  created_at timestamptz not null default now()
);

-- Lignes de commande (produit figé en JSON au moment de la commande)
create table public.commande_items (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes (id) on delete cascade,
  produit jsonb not null, -- { nom, taille, sucre, glace, toppings: [...] }
  quantite integer not null default 1 check (quantite > 0),
  prix_cents integer not null -- prix unitaire en centimes
);

-- Tokens de notifications push (Expo)
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profils (id) on delete cascade,
  token text not null unique,
  plateforme text check (plateforme in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

-- ============================================
-- SÉCURITÉ (RLS) : chaque client ne voit que
-- ses propres données. La caisse utilisera la
-- clé service_role qui contourne ces règles.
-- ============================================

alter table public.profils enable row level security;
alter table public.commandes enable row level security;
alter table public.commande_items enable row level security;
alter table public.push_tokens enable row level security;

-- Profils : lire/modifier son propre profil
create policy "profil: lire le sien" on public.profils
  for select using (auth.uid() = id);
create policy "profil: créer le sien" on public.profils
  for insert with check (auth.uid() = id);
create policy "profil: modifier le sien" on public.profils
  for update using (auth.uid() = id);

-- Commandes : lire/créer les siennes (pas de modif côté client, c'est la caisse qui change le statut)
create policy "commande: lire les siennes" on public.commandes
  for select using (auth.uid() = client_id);
create policy "commande: créer la sienne" on public.commandes
  for insert with check (auth.uid() = client_id);

-- Items : via la commande parente
create policy "items: lire les siens" on public.commande_items
  for select using (
    exists (select 1 from public.commandes c where c.id = commande_id and c.client_id = auth.uid())
  );
create policy "items: créer les siens" on public.commande_items
  for insert with check (
    exists (select 1 from public.commandes c where c.id = commande_id and c.client_id = auth.uid())
  );

-- Push tokens : gérer les siens
create policy "push: lire les siens" on public.push_tokens
  for select using (auth.uid() = client_id);
create policy "push: créer le sien" on public.push_tokens
  for insert with check (auth.uid() = client_id);
create policy "push: modifier le sien" on public.push_tokens
  for update using (auth.uid() = client_id);
create policy "push: supprimer le sien" on public.push_tokens
  for delete using (auth.uid() = client_id);
