create extension if not exists pgcrypto;

create table if not exists public.game_status (
  id text primary key default 'main-event',
  year integer not null default 1 check (year between 1 and 4),
  status text not null default 'BEFORE_START',
  previous_status text,
  timer_ends_at timestamptz,
  paused_remaining_seconds integer,
  current_round integer not null default 1,
  max_rounds integer not null default 4,
  capacity integer not null default 40,
  personal_ranking_revealed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.game_status add column if not exists current_round integer not null default 1;
alter table public.game_status add column if not exists max_rounds integer not null default 4;
alter table public.game_status alter column max_rounds set default 4;
alter table public.game_status add column if not exists personal_ranking_revealed boolean not null default false;

create table if not exists public.companies (
  id text primary key,
  name text not null,
  initial_capital integer not null check (initial_capital > 0),
  current_value numeric not null check (current_value >= 0),
  previous_value numeric not null check (previous_value >= 0),
  change_rate numeric not null default 0,
  total_investment numeric not null default 0,
  company_rank integer,
  color text not null default '#2563eb',
  logo_url text not null default '',
  tagline text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies add column if not exists logo_url text not null default '';
alter table public.companies add column if not exists tagline text not null default '';

create table if not exists public.users (
  id text primary key,
  username text unique,
  password text not null,
  nickname text not null,
  real_name text not null,
  company_id text not null references public.companies(id),
  rank text not null check (rank in ('사원', '대리', '과장', '차장', '부장')),
  cash integer not null default 0 check (cash >= 0),
  invested_amount numeric not null default 0,
  evaluated_amount numeric not null default 0,
  total_asset numeric not null default 0,
  profit_rate numeric not null default 0,
  is_online boolean not null default false,
  role text not null default 'participant' check (role in ('participant', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  year integer not null check (year between 1 and 4),
  invested_amount numeric not null default 0 check (invested_amount >= 0),
  evaluated_amount numeric not null default 0 check (evaluated_amount >= 0),
  profit_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, company_id, year)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text not null,
  company_id text not null,
  company_name text not null,
  amount integer not null default 0,
  action_type text not null,
  year integer not null check (year between 1 and 4),
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.company_value_history (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  tick integer not null default 0,
  year integer not null check (year between 1 and 4),
  value numeric not null check (value >= 0),
  change_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  recorded_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  image_url text,
  company_id text references public.companies(id) on delete set null,
  year integer check (year between 1 and 4),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.news add column if not exists image_url text;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default '공지',
  content text not null,
  target text not null default 'all',
  created_at timestamptz not null default now()
);

create table if not exists public.connection_status (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique references public.users(id) on delete cascade,
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now(),
  socket_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_rules (
  id uuid primary key default gen_random_uuid(),
  company_type text not null check (company_type in ('default', 'yeil')),
  rank text not null check (rank in ('사원', '대리', '과장', '차장', '부장')),
  salary integer not null check (salary >= 0),
  unique (company_type, rank)
);

create table if not exists public.final_results (
  id uuid primary key default gen_random_uuid(),
  winning_company_id text references public.companies(id) on delete set null,
  winning_user_id text references public.users(id) on delete set null,
  company_score numeric not null default 0,
  user_total_asset numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_yearly_results (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  year integer not null check (year between 1 and 4),
  starting_cash numeric not null default 0,
  invested_amount numeric not null default 0,
  evaluated_amount numeric not null default 0,
  profit_amount numeric not null default 0,
  withdrawn_amount numeric not null default 0,
  ending_cash numeric not null default 0,
  total_asset numeric not null default 0,
  return_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
);

create index if not exists idx_users_company on public.users(company_id);
create index if not exists idx_users_role on public.users(role);
create index if not exists idx_investments_user_year on public.investments(user_id, year);
create index if not exists idx_investments_company_year on public.investments(company_id, year);
create index if not exists idx_transactions_created on public.transactions(created_at desc);
create index if not exists idx_company_history_company_tick on public.company_value_history(company_id, tick);
create index if not exists idx_news_created on public.news(created_at desc);
create index if not exists idx_announcements_created on public.announcements(created_at desc);
create index if not exists idx_user_yearly_results_user_year on public.user_yearly_results(user_id, year);

insert into public.game_status (id, year, status, capacity, current_round, max_rounds, personal_ranking_revealed)
values ('main-event', 1, 'BEFORE_START', 40, 1, 4, false)
on conflict (id) do update set
  year = excluded.year,
  status = excluded.status,
  capacity = excluded.capacity,
  current_round = excluded.current_round,
  max_rounds = excluded.max_rounds,
  personal_ranking_revealed = excluded.personal_ranking_revealed,
  timer_ends_at = null,
  paused_remaining_seconds = null,
  updated_at = now();

insert into public.companies (id, name, initial_capital, current_value, previous_value, color, logo_url, tagline)
values
  ('sanghyun', '상현회사', 5000, 5000, 5000, '#e11d48', '/company-profiles/sanghyun.png', '빠른 실행력으로 시장을 선점하는 성장형 기업'),
  ('seoyoung', '서영회사', 5000, 5000, 5000, '#2563eb', '/company-profiles/seoyoung-v2.png', '안정적인 재무와 균형 잡힌 사업 포트폴리오'),
  ('ain', '아인회사', 5000, 5000, 5000, '#16a34a', '/company-profiles/ain.png', '기술과 브랜드 신뢰를 함께 키우는 혁신 기업'),
  ('donghyun', '동현회사', 5000, 5000, 5000, '#f97316', '/company-profiles/donghyun.png', '공격적인 투자로 판을 흔드는 도전형 기업'),
  ('yeil', '예일회사', 4500, 4500, 4500, '#7c3aed', '/company-profiles/yeil.png', '작지만 민첩하게 기회를 포착하는 실속형 기업')
on conflict (id) do update set
  name = excluded.name,
  initial_capital = excluded.initial_capital,
  current_value = excluded.current_value,
  previous_value = excluded.previous_value,
  color = excluded.color,
  logo_url = excluded.logo_url,
  tagline = excluded.tagline,
  total_investment = 0,
  updated_at = now();

insert into public.company_value_history (company_id, tick, year, value)
values
  ('sanghyun', 0, 1, 5000),
  ('seoyoung', 0, 1, 5000),
  ('ain', 0, 1, 5000),
  ('donghyun', 0, 1, 5000),
  ('yeil', 0, 1, 4500)
on conflict do nothing;

insert into public.users (id, username, password, nickname, real_name, company_id, rank, cash, role)
values
  ('admin', 'admin', 'admin-2026', '운영자', '관리자', 'sanghyun', '부장', 0, 'admin'),
  ('p001', 'p001', '1111', '테스트1', '테스트1', 'sanghyun', '사원', 0, 'participant'),
  ('p002', 'p002', '1111', '테스트2', '테스트2', 'seoyoung', '대리', 0, 'participant'),
  ('p003', 'p003', '1111', '테스트3', '테스트3', 'ain', '과장', 0, 'participant'),
  ('p004', 'p004', '1111', '테스트4', '테스트4', 'donghyun', '차장', 0, 'participant'),
  ('p005', 'p005', '1111', '테스트5', '테스트5', 'yeil', '부장', 0, 'participant'),
  ('p006', 'p006', '1111', '테스트6', '테스트6', 'sanghyun', '사원', 0, 'participant'),
  ('p007', 'p007', '1111', '테스트7', '테스트7', 'seoyoung', '대리', 0, 'participant'),
  ('p008', 'p008', '1111', '테스트8', '테스트8', 'ain', '과장', 0, 'participant'),
  ('p009', 'p009', '1111', '테스트9', '테스트9', 'donghyun', '차장', 0, 'participant'),
  ('p010', 'p010', '1111', '테스트10', '테스트10', 'yeil', '부장', 0, 'participant'),
  ('p011', 'p011', '1111', '테스트11', '테스트11', 'sanghyun', '사원', 0, 'participant'),
  ('p012', 'p012', '1111', '테스트12', '테스트12', 'seoyoung', '대리', 0, 'participant'),
  ('p013', 'p013', '1111', '테스트13', '테스트13', 'ain', '과장', 0, 'participant'),
  ('p014', 'p014', '1111', '테스트14', '테스트14', 'donghyun', '차장', 0, 'participant'),
  ('p015', 'p015', '1111', '테스트15', '테스트15', 'yeil', '부장', 0, 'participant'),
  ('p016', 'p016', '1111', '테스트16', '테스트16', 'sanghyun', '사원', 0, 'participant'),
  ('p017', 'p017', '1111', '테스트17', '테스트17', 'seoyoung', '대리', 0, 'participant'),
  ('p018', 'p018', '1111', '테스트18', '테스트18', 'ain', '과장', 0, 'participant'),
  ('p019', 'p019', '1111', '테스트19', '테스트19', 'donghyun', '차장', 0, 'participant'),
  ('p020', 'p020', '1111', '테스트20', '테스트20', 'yeil', '부장', 0, 'participant'),
  ('p021', 'p021', '1111', '테스트21', '테스트21', 'sanghyun', '사원', 0, 'participant'),
  ('p022', 'p022', '1111', '테스트22', '테스트22', 'seoyoung', '대리', 0, 'participant'),
  ('p023', 'p023', '1111', '테스트23', '테스트23', 'ain', '과장', 0, 'participant'),
  ('p024', 'p024', '1111', '테스트24', '테스트24', 'donghyun', '차장', 0, 'participant'),
  ('p025', 'p025', '1111', '테스트25', '테스트25', 'yeil', '부장', 0, 'participant'),
  ('p026', 'p026', '1111', '테스트26', '테스트26', 'sanghyun', '사원', 0, 'participant'),
  ('p027', 'p027', '1111', '테스트27', '테스트27', 'seoyoung', '대리', 0, 'participant'),
  ('p028', 'p028', '1111', '테스트28', '테스트28', 'ain', '과장', 0, 'participant'),
  ('p029', 'p029', '1111', '테스트29', '테스트29', 'donghyun', '차장', 0, 'participant'),
  ('p030', 'p030', '1111', '테스트30', '테스트30', 'yeil', '부장', 0, 'participant')
on conflict (id) do update set
  username = excluded.username,
  password = excluded.password,
  nickname = excluded.nickname,
  real_name = excluded.real_name,
  company_id = excluded.company_id,
  rank = excluded.rank,
  cash = excluded.cash,
  role = excluded.role,
  invested_amount = 0,
  evaluated_amount = 0,
  total_asset = 0,
  profit_rate = 0,
  is_online = false,
  updated_at = now();

insert into public.salary_rules (company_type, rank, salary)
values
  ('default', '사원', 900),
  ('default', '대리', 950),
  ('default', '과장', 1000),
  ('default', '차장', 1050),
  ('default', '부장', 1100),
  ('yeil', '사원', 900),
  ('yeil', '대리', 950),
  ('yeil', '과장', 1000),
  ('yeil', '차장', 1050),
  ('yeil', '부장', 1100)
on conflict (company_type, rank) do update set salary = excluded.salary;

alter table public.game_status enable row level security;
alter table public.companies enable row level security;
alter table public.users enable row level security;
alter table public.investments enable row level security;
alter table public.transactions enable row level security;
alter table public.company_value_history enable row level security;
alter table public.news enable row level security;
alter table public.announcements enable row level security;
alter table public.connection_status enable row level security;
alter table public.salary_rules enable row level security;
alter table public.final_results enable row level security;
alter table public.user_yearly_results enable row level security;

drop policy if exists "read game status" on public.game_status;
drop policy if exists "read companies" on public.companies;
drop policy if exists "read users" on public.users;
drop policy if exists "read investments" on public.investments;
drop policy if exists "read transactions" on public.transactions;
drop policy if exists "read company value history" on public.company_value_history;
drop policy if exists "read news" on public.news;
drop policy if exists "read announcements" on public.announcements;
drop policy if exists "read connection status" on public.connection_status;
drop policy if exists "read salary rules" on public.salary_rules;
drop policy if exists "read final results" on public.final_results;
drop policy if exists "read user yearly results" on public.user_yearly_results;

create policy "read game status" on public.game_status for select using (true);
create policy "read companies" on public.companies for select using (true);
create policy "read users" on public.users for select using (true);
create policy "read investments" on public.investments for select using (true);
create policy "read transactions" on public.transactions for select using (true);
create policy "read company value history" on public.company_value_history for select using (true);
create policy "read news" on public.news for select using (true);
create policy "read announcements" on public.announcements for select using (true);
create policy "read connection status" on public.connection_status for select using (true);
create policy "read salary rules" on public.salary_rules for select using (true);
create policy "read final results" on public.final_results for select using (true);
create policy "read user yearly results" on public.user_yearly_results for select using (true);
