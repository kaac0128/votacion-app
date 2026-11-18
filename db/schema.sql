-- votacion-app — esquema de base de datos (Supabase Postgres)
-- Fuente de verdad del esquema. Aplicado via Supabase MCP como migración.
--
-- Decisiones de diseño:
-- - Auth custom (users con nombre + password_hash): la sesión la maneja la app
--   (cookie httpOnly con JWT firmado), NO Supabase Auth.
-- - RLS habilitado en TODAS las tablas sin policies => acceso anónimo denegado.
--   Toda lectura/escritura pasa por la API del servidor (service role, que
--   bypasea RLS). El frontend nunca habla directo con la DB.
-- - El cierre de votación se enforcement por timestamp en un trigger, no con cron.
-- - Puntuación: al cargar el resultado, ganador=10 y resto=0 (automático);
--   items inválidos siempre valen 0 aunque sean el ganador elegido.

create table users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  password_hash text not null,                 -- scrypt: salt:hash
  created_at    timestamptz not null default now()
);

create table rooms (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,        -- código de acceso compartible
  title           text not null,
  theme           text not null default '',    -- contexto para la app y la IA
  deadline        timestamptz,                 -- cierra la votación por timestamp
  status          text not null default 'open'
                  check (status in ('open', 'results', 'closed')),
  admin_user_id   uuid not null references users(id) on delete cascade,
  allow_vote_edit boolean not null default false,  -- reapertura post-cierre
  ai_provider     text check (ai_provider in ('gemini', 'openrouter')),
  ai_key          text,                        -- guardada en DB, expuesta solo al admin
  created_at      timestamptz not null default now()
);

create table room_members (
  room_id   uuid not null references rooms(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  avatar    text,                              -- id del pack o 'url:https://...'
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table categories (
  id      uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name    text not null,
  sort    integer not null default 0,
  unique (room_id, name)
);

create table items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  title       text not null,
  description text,
  image_url   text,
  is_invalid  boolean not null default false,  -- siempre vale 0, aviso al votar
  sort        integer not null default 0
);

create table votes (
  user_id     uuid not null references users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (user_id, category_id)            -- UN solo voto por categoría
);

-- Una fila por categoría. Cada corrección sube attempt (1 = publicación
-- original, 2..4 = corrección 1..3). A attempt >= 4 el resultado es FINAL.
-- revealed=false hasta que el admin lo revela en vivo (estilo Kahoot).
create table category_results (
  category_id    uuid primary key references categories(id) on delete cascade,
  winner_item_id uuid references items(id) on delete cascade,
  attempt        integer not null default 1 check (attempt between 1 and 4),
  revealed       boolean not null default false,
  published_at   timestamptz not null default now()
);

-- Acuerdo/reporte por publicación (cada intento reinicia el ciclo).
create table result_feedback (
  category_id uuid not null references categories(id) on delete cascade,
  attempt     integer not null check (attempt between 1 and 4),
  user_id     uuid not null references users(id) on delete cascade,
  verdict     text not null check (verdict in ('agree', 'report')),
  created_at  timestamptz not null default now(),
  primary key (category_id, attempt, user_id)
);

-- Desempate: rondas de piedra-papel-tijera. participants = jugadores aún en
-- juego en esa ronda; el ganador final se deriva de las rondas completadas.
create table tiebreak_rounds (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  round        integer not null,
  participants uuid[] not null,
  created_at   timestamptz not null default now()
);

create table tiebreak_picks (
  round_id uuid not null references tiebreak_rounds(id) on delete cascade,
  user_id  uuid not null references users(id) on delete cascade,
  pick     text not null check (pick in ('rock', 'paper', 'scissors')),
  created_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

-- ===== Seguridad: RLS en todo, sin policies => denegado por defecto =====
alter table users             enable row level security;
alter table rooms             enable row level security;
alter table room_members      enable row level security;
alter table categories        enable row level security;
alter table items             enable row level security;
alter table votes             enable row level security;
alter table category_results  enable row level security;
alter table result_feedback   enable row level security;
alter table tiebreak_rounds   enable row level security;
alter table tiebreak_picks    enable row level security;

-- ===== Trigger: ventana de votación =====
-- Rechaza votos si la sala no está 'open' o si ya pasó el deadline
-- (salvo reapertura explícita allow_vote_edit).
create or replace function check_vote_window() returns trigger
language plpgsql as $$
declare
  r record;
begin
  select ro.status, ro.deadline, ro.allow_vote_edit
    into r
    from rooms ro
    join categories c on c.room_id = ro.id
   where c.id = case when tg_op = 'INSERT' then new.category_id else old.category_id end;

  if r.status <> 'open'
     or (r.deadline is not null and now() >= r.deadline and not r.allow_vote_edit) then
    raise exception 'voting is closed for this room';
  end if;

  return new;
end;
$$;

create trigger trg_vote_window
  before insert or update on votes
  for each row execute function check_vote_window();

-- ===== Índices =====
create index idx_categories_room on categories(room_id);
create index idx_items_category  on items(category_id);
create index idx_members_user    on room_members(user_id);

-- ===== Reapertura por solicitud (épica 6.1) =====
create table reopen_requests (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references rooms(id) on delete cascade,
  requester_id uuid not null references users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (room_id, requester_id)
);

create table reopen_supports (
  request_id uuid not null references reopen_requests(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

alter table reopen_requests enable row level security;
alter table reopen_supports enable row level security;
