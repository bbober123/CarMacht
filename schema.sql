-- ============================================================
-- CarMatch - schemat bazy danych v3
-- Wklej caly plik w: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Bezpieczny do wielokrotnego uruchamiania (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================

-- ============================================================
-- 1. PROFILES - jeden wiersz na kazde konto (auth.users), w tym flaga is_admin
-- ============================================================
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text not null default 'Kierowca',
  avatar_url   text,
  is_admin     boolean not null default false,
  is_banned    boolean not null default false,
  created_at   timestamptz default now()
);

alter table profiles add column if not exists email text;
alter table profiles add column if not exists is_banned boolean not null default false;

alter table profiles enable row level security;

drop policy if exists "Publiczny odczyt profili" on profiles;
drop policy if exists "Uzytkownik edytuje swoj profil" on profiles;
drop policy if exists "Admin edytuje kazdy profil" on profiles;

create policy "Publiczny odczyt profili" on profiles for select using (true);
create policy "Uzytkownik edytuje swoj profil" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admin edytuje kazdy profil" on profiles for update using (is_admin());

-- Auto-tworzenie profilu przy rejestracji (teraz zapisuje tez email -
-- auth.users nie jest dostepne z klienta, wiec kopiujemy email tutaj,
-- w funkcji dzialajacej po stronie bazy, zeby admin mogl widziec/szukac userow)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Funkcje pomocnicze uzywane we wszystkich politykach
create or replace function is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

create or replace function is_banned()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select p.is_banned from profiles p where p.id = auth.uid()), false);
$$;


-- ============================================================
-- 2. CARS / CAR_PHOTOS - katalog, zapis TYLKO dla is_admin() (nie kazdy zalogowany!)
-- ============================================================
create table if not exists cars (
  id            text primary key,
  make          text not null,
  model         text not null,
  year          int not null,
  segment       text not null,
  country       text not null,
  powertrain    text not null,
  engine        text not null,
  drivetrain    text not null,
  power_kw      int not null,
  torque_nm     int not null,
  accel_0_100   numeric not null,
  top_speed_kmh int not null,
  price_usd     int not null,
  description   text not null default '',
  created_at    timestamptz default now()
);
create index if not exists idx_cars_matching on cars (powertrain, segment, price_usd);

alter table cars enable row level security;
drop policy if exists "Publiczny odczyt aut" on cars;
drop policy if exists "Admin dodaje auta" on cars;
drop policy if exists "Admin edytuje auta" on cars;
drop policy if exists "Admin usuwa auta" on cars;

create policy "Publiczny odczyt aut" on cars for select using (true);
create policy "Admin dodaje auta" on cars for insert with check (is_admin());
create policy "Admin edytuje auta" on cars for update using (is_admin());
create policy "Admin usuwa auta" on cars for delete using (is_admin());

create table if not exists car_photos (
  id         bigint generated always as identity primary key,
  car_id     text not null references cars(id) on delete cascade,
  url        text not null,
  is_primary boolean not null default false,
  created_at timestamptz default now()
);
alter table car_photos enable row level security;
drop policy if exists "Publiczny odczyt zdjec" on car_photos;
drop policy if exists "Admin dodaje zdjecia" on car_photos;
drop policy if exists "Admin edytuje zdjecia" on car_photos;
drop policy if exists "Admin usuwa zdjecia" on car_photos;

create policy "Publiczny odczyt zdjec" on car_photos for select using (true);
create policy "Admin dodaje zdjecia" on car_photos for insert with check (is_admin());
create policy "Admin edytuje zdjecia" on car_photos for update using (is_admin());
create policy "Admin usuwa zdjecia" on car_photos for delete using (is_admin());


-- ============================================================
-- 3. ZGLOSZENIA OD UZYTKOWNIKOW (kazdy moze wyslac, tylko admin widzi/zatwierdza)
-- ============================================================
create table if not exists car_submissions (
  id          bigint generated always as identity primary key,
  visitor_id  text not null,
  make        text not null,
  model       text not null,
  year        int,
  segment     text,
  country     text,
  powertrain  text,
  description text default '',
  photo_url   text,
  status      text not null default 'pending',
  created_at  timestamptz default now()
);
alter table car_submissions enable row level security;
drop policy if exists "Kazdy moze zglosic auto" on car_submissions;
drop policy if exists "Admin widzi zgloszenia aut" on car_submissions;
drop policy if exists "Admin edytuje zgloszenia aut" on car_submissions;
drop policy if exists "Admin usuwa zgloszenia aut" on car_submissions;

create policy "Kazdy moze zglosic auto" on car_submissions for insert with check (true);
create policy "Admin widzi zgloszenia aut" on car_submissions for select using (is_admin());
create policy "Admin edytuje zgloszenia aut" on car_submissions for update using (is_admin());
create policy "Admin usuwa zgloszenia aut" on car_submissions for delete using (is_admin());

create table if not exists photo_submissions (
  id         bigint generated always as identity primary key,
  car_id     text not null references cars(id) on delete cascade,
  visitor_id text not null,
  url        text not null,
  status     text not null default 'pending',
  created_at timestamptz default now()
);
alter table photo_submissions enable row level security;
drop policy if exists "Kazdy moze zglosic zdjecie" on photo_submissions;
drop policy if exists "Admin widzi zgloszone zdjecia" on photo_submissions;
drop policy if exists "Admin edytuje zgloszone zdjecia" on photo_submissions;
drop policy if exists "Admin usuwa zgloszone zdjecia" on photo_submissions;

create policy "Kazdy moze zglosic zdjecie" on photo_submissions for insert with check (true);
create policy "Admin widzi zgloszone zdjecia" on photo_submissions for select using (is_admin());
create policy "Admin edytuje zgloszone zdjecia" on photo_submissions for update using (is_admin());
create policy "Admin usuwa zgloszone zdjecia" on photo_submissions for delete using (is_admin());


-- ============================================================
-- 4. PREFERENCES / SWIPES - teraz visitor_id = auth.uid() dla zalogowanych,
--    losowe UUID w localStorage dla anonimowych. Bez zmian strukturalnych.
-- ============================================================
create table if not exists preferences (
  visitor_id  text primary key,
  budget      int not null default 0,
  powertrains text not null default '',
  segments    text not null default '',
  brands      text not null default '',
  countries   text not null default '',
  updated_at  timestamptz default now()
);
alter table preferences add column if not exists countries text not null default '';
alter table preferences alter column budget set default 0;
alter table preferences enable row level security;
drop policy if exists "Publiczny dostep do preferencji" on preferences;
create policy "Publiczny dostep do preferencji" on preferences for all using (true) with check (true);

create table if not exists swipes (
  id         bigint generated always as identity primary key,
  visitor_id text not null,
  car_id     text not null references cars(id),
  liked      boolean not null,
  created_at timestamptz default now(),
  unique (visitor_id, car_id)
);
alter table swipes enable row level security;
drop policy if exists "Publiczny dostep do swipeow" on swipes;
create policy "Publiczny dostep do swipeow" on swipes for all using (true) with check (true);


-- ============================================================
-- 5. KONKURS TYGODNIOWY - 30 miejsc, kto pierwszy ten lepszy
-- ============================================================
create table if not exists contest_entries (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  make        text not null,
  model       text not null,
  year        int,
  description text default '',
  photo_url   text not null,
  votes_count int not null default 0,
  status      text not null default 'active', -- active | won | archived
  week_start  date not null default date_trunc('week', now())::date,
  created_at  timestamptz default now()
);
create index if not exists idx_contest_active on contest_entries (status, week_start);

alter table contest_entries enable row level security;
drop policy if exists "Publiczny odczyt zgloszen konkursowych" on contest_entries;
drop policy if exists "Zalogowany dodaje swoje auto" on contest_entries;
drop policy if exists "Wlasciciel lub admin usuwa zgloszenie" on contest_entries;
drop policy if exists "Admin edytuje zgloszenie" on contest_entries;

create policy "Publiczny odczyt zgloszen konkursowych" on contest_entries for select using (true);
create policy "Zalogowany dodaje swoje auto" on contest_entries for insert with check (auth.uid() = user_id and not is_banned());
create policy "Wlasciciel lub admin usuwa zgloszenie" on contest_entries for delete using (auth.uid() = user_id or is_admin());
create policy "Admin edytuje zgloszenie" on contest_entries for update using (is_admin());

-- Limit 30 aktywnych miejsc + jedno zgloszenie na uzytkownika na tydzien
create or replace function enforce_contest_slot_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  active_count int;
  own_entry_count int;
begin
  select count(*) into active_count from contest_entries
    where status = 'active' and week_start = new.week_start;
  if active_count >= 30 then
    raise exception 'CONTEST_FULL';
  end if;

  select count(*) into own_entry_count from contest_entries
    where user_id = new.user_id and week_start = new.week_start and status = 'active';
  if own_entry_count > 0 then
    raise exception 'ALREADY_ENTERED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_contest_slot_limit on contest_entries;
create trigger trg_contest_slot_limit
  before insert on contest_entries
  for each row execute function enforce_contest_slot_limit();

-- Glosy - jeden glos na uzytkownika na tydzien (mozna zmienic, nie zdublowac)
create table if not exists contest_votes (
  id         bigint generated always as identity primary key,
  entry_id   bigint not null references contest_entries(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  created_at timestamptz default now(),
  unique (user_id, week_start)
);
alter table contest_votes enable row level security;
drop policy if exists "Publiczny odczyt glosow" on contest_votes;
drop policy if exists "Zalogowany glosuje" on contest_votes;
drop policy if exists "Zalogowany usuwa swoj glos" on contest_votes;

create policy "Publiczny odczyt glosow" on contest_votes for select using (true);
create policy "Zalogowany glosuje" on contest_votes for insert with check (auth.uid() = user_id and not is_banned());
create policy "Zalogowany usuwa swoj glos" on contest_votes for delete using (auth.uid() = user_id);

-- Utrzymanie votes_count na biezaco
create or replace function bump_votes_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update contest_entries set votes_count = votes_count + 1 where id = new.entry_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update contest_entries set votes_count = greatest(votes_count - 1, 0) where id = old.entry_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_bump_votes_ins on contest_votes;
create trigger trg_bump_votes_ins after insert on contest_votes
  for each row execute function bump_votes_count();
drop trigger if exists trg_bump_votes_del on contest_votes;
create trigger trg_bump_votes_del after delete on contest_votes
  for each row execute function bump_votes_count();


-- ============================================================
-- 6. ODZNAKI
-- ============================================================
create table if not exists badges (
  id          text primary key,
  name        text not null,
  description text not null,
  icon        text not null default '🏅'
);

insert into badges (id, name, description, icon) values
  ('pierwszy-swipe',     'Pierwszy kontakt',    'Przesunąłeś swoje pierwsze auto',                '👋'),
  ('kolekcjoner-10',     'Kolekcjoner',         'Polubiłeś 10 aut',                                '🚗'),
  ('kolekcjoner-50',     'Zbieracz',            'Polubiłeś 50 aut',                                '🚙'),
  ('kolekcjoner-100',    'Garaż stulecia',      'Polubiłeś 100 aut',                               '🏁'),
  ('zwiadowca',          'Zwiadowca',           'Przejrzałeś 100 aut (lubię lub pas)',             '🧭'),
  ('roznorodnosc',       'Bez uprzedzeń',       'Polubiłeś auta z 10 różnych marek',               '🌍'),
  ('pierwsze-zgloszenie','Odkrywca',            'Zaproponowałeś swoje pierwsze auto do katalogu',   '🔍'),
  ('fotograf',           'Fotograf',            'Zaproponowałeś swoje pierwsze zdjęcie',            '📷'),
  ('zatwierdzony-wklad', 'Zaufany wkład',       'Twoja propozycja została zatwierdzona przez admina','✅'),
  ('zawodnik',           'Zawodnik',            'Zgłosiłeś auto do cotygodniowego konkursu',        '🎟️'),
  ('glosujacy',          'Głos ludu',           'Oddałeś swój pierwszy głos w konkursie',           '🗳️'),
  ('spoleczniak',        'Filar społeczności',  'Głosowałeś w 4 różnych tygodniach',                '🤝'),
  ('mistrz-tygodnia',    'Mistrz tygodnia',     'Twoje auto wygrało cotygodniowy konkurs',          '🏆'),
  ('legenda-3x',         'Hattrick',            'Wygrałeś konkurs 3 tygodnie z rzędu',              '🔥'),
  ('legenda-10x',        'Legenda CarMatch',    'Wygrałeś konkurs już 10 razy',                     '👑'),
  ('staly-bywalec',      'Stały bywalec',       'Twoje konto ma już 30 dni',                        '📅'),
  ('seria-3',            'Rozpędzony',          '3 dni z rzędu z aktywnością na CarMatch',           '🔥'),
  ('seria-7',            'Tydzień w ogniu',     '7 dni z rzędu z aktywnością na CarMatch',           '🔥🔥'),
  ('seria-30',           'Nie do zatrzymania',  '30 dni z rzędu z aktywnością na CarMatch',          '🔥🔥🔥')
on conflict (id) do nothing;

create table if not exists user_badges (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  badge_id   text not null references badges(id),
  awarded_at timestamptz default now(),
  unique (user_id, badge_id)
);
alter table user_badges enable row level security;
drop policy if exists "Publiczny odczyt odznak" on user_badges;
drop policy if exists "Admin nadaje odznaki recznie" on user_badges;
drop policy if exists "Admin odbiera odznaki" on user_badges;
create policy "Publiczny odczyt odznak" on user_badges for select using (true);
create policy "Admin nadaje odznaki recznie" on user_badges for insert with check (is_admin());
create policy "Admin odbiera odznaki" on user_badges for delete using (is_admin());
-- Brak polityki insert/delete dla zwyklych userow poza powyzszymi -
-- samodzielne odznaki nadaje WYLACZNIE funkcja SECURITY DEFINER ponizej,
-- ktora sama insertuje z pominieciem RLS.

alter table badges enable row level security;
drop policy if exists "Publiczny odczyt listy odznak" on badges;
drop policy if exists "Admin dodaje odznaki" on badges;
drop policy if exists "Admin edytuje odznaki" on badges;
drop policy if exists "Admin usuwa odznaki" on badges;
create policy "Publiczny odczyt listy odznak" on badges for select using (true);
create policy "Admin dodaje odznaki" on badges for insert with check (is_admin());
create policy "Admin edytuje odznaki" on badges for update using (is_admin());
create policy "Admin usuwa odznaki" on badges for delete using (is_admin());

-- Liczy biezaca "serie" dni z rzedu, w ktorych uzytkownik cokolwiek swipe'owal.
-- Seria trwa tylko jesli ostatnia aktywnosc byla dzisiaj albo wczoraj -
-- inaczej wraca do zera (tak jak w typowych apkach z "streakami").
create or replace function get_current_streak(target_user uuid)
returns int
language plpgsql
security definer set search_path = public
stable
as $$
declare
  active_dates date[];
  streak int;
  i int;
  today date := current_date;
begin
  select array_agg(distinct d order by d desc) into active_dates
    from (select created_at::date as d from swipes where visitor_id = target_user::text) t;

  if active_dates is null or array_length(active_dates, 1) = 0 then
    return 0;
  end if;

  if active_dates[1] < today - 1 then
    return 0;
  end if;

  streak := 1;
  if array_length(active_dates, 1) > 1 then
    for i in 1..array_length(active_dates, 1) - 1 loop
      if active_dates[i] - active_dates[i + 1] = 1 then
        streak := streak + 1;
      else
        exit;
      end if;
    end loop;
  end if;

  return streak;
end;
$$;


-- weryfikujaca warunki dziala w bazie (SECURITY DEFINER), a nie na podstawie
-- danych przyslanych przez klienta.
create or replace function check_and_award_badges()
returns text[]
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  newly_awarded text[] := '{}';
  liked_count int;
  swiped_count int;
  make_count int;
  submission_count int;
  photo_sub_count int;
  approved_count int;
  contest_entry_count int;
  vote_weeks_count int;
  won_count int;
  account_age_days int;
  streak_days int;
begin
  if uid is null then
    return newly_awarded;
  end if;

  select count(*) into swiped_count from swipes where visitor_id = uid::text;
  select count(*) into liked_count from swipes where visitor_id = uid::text and liked = true;
  select count(distinct c.make) into make_count
    from swipes s join cars c on c.id = s.car_id
    where s.visitor_id = uid::text and s.liked = true;
  select count(*) into submission_count from car_submissions where visitor_id = uid::text;
  select count(*) into photo_sub_count from photo_submissions where visitor_id = uid::text;
  select count(*) into approved_count from (
    select id from car_submissions where visitor_id = uid::text and status = 'approved'
    union all
    select id from photo_submissions where visitor_id = uid::text and status = 'approved'
  ) t;
  select count(*) into contest_entry_count from contest_entries where user_id = uid;
  select count(distinct week_start) into vote_weeks_count from contest_votes where user_id = uid;
  select count(*) into won_count from contest_entries where user_id = uid and status = 'won';
  select extract(day from now() - created_at)::int into account_age_days from profiles where id = uid;
  select get_current_streak(uid) into streak_days;

  if swiped_count >= 1 then
    insert into user_badges (user_id, badge_id) values (uid, 'pierwszy-swipe') on conflict do nothing;
  end if;
  if liked_count >= 10 then
    insert into user_badges (user_id, badge_id) values (uid, 'kolekcjoner-10') on conflict do nothing;
  end if;
  if liked_count >= 50 then
    insert into user_badges (user_id, badge_id) values (uid, 'kolekcjoner-50') on conflict do nothing;
  end if;
  if liked_count >= 100 then
    insert into user_badges (user_id, badge_id) values (uid, 'kolekcjoner-100') on conflict do nothing;
  end if;
  if swiped_count >= 100 then
    insert into user_badges (user_id, badge_id) values (uid, 'zwiadowca') on conflict do nothing;
  end if;
  if make_count >= 10 then
    insert into user_badges (user_id, badge_id) values (uid, 'roznorodnosc') on conflict do nothing;
  end if;
  if submission_count >= 1 then
    insert into user_badges (user_id, badge_id) values (uid, 'pierwsze-zgloszenie') on conflict do nothing;
  end if;
  if photo_sub_count >= 1 then
    insert into user_badges (user_id, badge_id) values (uid, 'fotograf') on conflict do nothing;
  end if;
  if approved_count >= 1 then
    insert into user_badges (user_id, badge_id) values (uid, 'zatwierdzony-wklad') on conflict do nothing;
  end if;
  if contest_entry_count >= 1 then
    insert into user_badges (user_id, badge_id) values (uid, 'zawodnik') on conflict do nothing;
  end if;
  if vote_weeks_count >= 1 then
    insert into user_badges (user_id, badge_id) values (uid, 'glosujacy') on conflict do nothing;
  end if;
  if vote_weeks_count >= 4 then
    insert into user_badges (user_id, badge_id) values (uid, 'spoleczniak') on conflict do nothing;
  end if;
  if won_count >= 1 then
    insert into user_badges (user_id, badge_id) values (uid, 'mistrz-tygodnia') on conflict do nothing;
  end if;
  if account_age_days >= 30 then
    insert into user_badges (user_id, badge_id) values (uid, 'staly-bywalec') on conflict do nothing;
  end if;
  if streak_days >= 3 then
    insert into user_badges (user_id, badge_id) values (uid, 'seria-3') on conflict do nothing;
  end if;
  if streak_days >= 7 then
    insert into user_badges (user_id, badge_id) values (uid, 'seria-7') on conflict do nothing;
  end if;
  if streak_days >= 30 then
    insert into user_badges (user_id, badge_id) values (uid, 'seria-30') on conflict do nothing;
  end if;

  return newly_awarded;
end;
$$;

-- Rozstrzygniecie konkursu tygodniowego - wylania zwycpiezce, przyznaje
-- odznake, archiwizuje reszte (zwalnia wszystkie 30 miejsc na nowy tydzien).
-- Wolane automatycznie przez pg_cron (patrz sekcja 7) albo recznie przez admina.
create or replace function resolve_weekly_contest()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  winner_id bigint;
  winner_user uuid;
  current_week date := date_trunc('week', now())::date;
  total_wins int;
  win_weeks date[];
  streak int;
  i int;
begin
  select id, user_id into winner_id, winner_user
    from contest_entries
    where status = 'active' and week_start = current_week
    order by votes_count desc, created_at asc
    limit 1;

  if winner_id is not null then
    update contest_entries set status = 'won' where id = winner_id;
    insert into user_badges (user_id, badge_id) values (winner_user, 'mistrz-tygodnia') on conflict do nothing;

    select count(*) into total_wins from contest_entries where user_id = winner_user and status = 'won';
    if total_wins >= 10 then
      insert into user_badges (user_id, badge_id) values (winner_user, 'legenda-10x') on conflict do nothing;
    end if;

    select array_agg(week_start order by week_start desc) into win_weeks
      from contest_entries where user_id = winner_user and status = 'won';

    streak := 1;
    if win_weeks is not null and array_length(win_weeks, 1) > 1 then
      for i in 1..array_length(win_weeks, 1) - 1 loop
        if win_weeks[i] - win_weeks[i + 1] = 7 then
          streak := streak + 1;
        else
          exit;
        end if;
      end loop;
    end if;
    if streak >= 3 then
      insert into user_badges (user_id, badge_id) values (winner_user, 'legenda-3x') on conflict do nothing;
    end if;
  end if;

  update contest_entries set status = 'archived'
    where status = 'active' and week_start = current_week and id != coalesce(winner_id, -1);
end;
$$;


-- ============================================================
-- 9. ROZMOWY Z AI O KONKRETNYM AUCIE
-- Znikaja automatycznie po "pasie" (obsluzone w kliencie przy swipe),
-- widoczne tylko dla wlasciciela rozmowy.
-- ============================================================
create table if not exists car_conversations (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  car_id     text not null references cars(id) on delete cascade,
  role       text not null, -- 'user' | 'assistant'
  content    text not null,
  created_at timestamptz default now()
);
create index if not exists idx_conversations_user_car on car_conversations (user_id, car_id, created_at);

alter table car_conversations enable row level security;
drop policy if exists "Wlasciciel widzi swoje rozmowy" on car_conversations;
drop policy if exists "Wlasciciel dodaje wiadomosci" on car_conversations;
drop policy if exists "Wlasciciel usuwa swoje rozmowy" on car_conversations;

create policy "Wlasciciel widzi swoje rozmowy" on car_conversations for select using (auth.uid() = user_id);
create policy "Wlasciciel dodaje wiadomosci" on car_conversations for insert with check (auth.uid() = user_id and not is_banned());
create policy "Wlasciciel usuwa swoje rozmowy" on car_conversations for delete using (auth.uid() = user_id);


-- ============================================================
-- 10. SLADY OBEJRZANYCH AUT - zeby nigdy nie pokazac dwa razy tego samego.
-- W praktyce to juz jest tabela "swipes" (kazdy swipe, lubie i pas,
-- zapisuje sie tam) - ten widok tylko to porzadkuje pod klucz uzytkownika.
-- ============================================================
create or replace view my_seen_car_ids as
  select visitor_id, car_id from swipes;


-- ============================================================
-- 11. OPINIE UZYTKOWNIKOW - co sadza, co by zmienili
-- ============================================================
create table if not exists feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  message    text not null,
  created_at timestamptz default now()
);
alter table feedback enable row level security;
drop policy if exists "Zalogowany wysyla opinie" on feedback;
drop policy if exists "Admin widzi opinie" on feedback;
drop policy if exists "Admin usuwa opinie" on feedback;
create policy "Zalogowany wysyla opinie" on feedback for insert with check (auth.uid() = user_id and not is_banned());
create policy "Admin widzi opinie" on feedback for select using (is_admin());
create policy "Admin usuwa opinie" on feedback for delete using (is_admin());


-- ============================================================
-- 12. USTAWIENIA WYGLADU STRONY - edytowalne przez admina, bez zmian w kodzie
-- ============================================================
create table if not exists site_settings (
  key   text primary key,
  value text not null
);
insert into site_settings (key, value) values
  ('accent_color', '#2F6FED'),
  ('tagline', 'Odkrywaj auta, które kochasz'),
  ('site_name', 'CarMatch'),
  ('custom_css', ''),
  ('logo_light_url', ''),
  ('logo_dark_url', '')
on conflict (key) do nothing;

alter table site_settings enable row level security;
drop policy if exists "Publiczny odczyt ustawien" on site_settings;
drop policy if exists "Admin edytuje ustawienia" on site_settings;
drop policy if exists "Admin nadpisuje ustawienia" on site_settings;
create policy "Publiczny odczyt ustawien" on site_settings for select using (true);
create policy "Admin edytuje ustawienia" on site_settings for insert with check (is_admin());
create policy "Admin nadpisuje ustawienia" on site_settings for update using (is_admin());

insert into storage.buckets (id, name, public) values ('branding', 'branding', true) on conflict (id) do nothing;
drop policy if exists "Publiczny odczyt branding" on storage.objects;
drop policy if exists "Admin zarzadza branding" on storage.objects;
drop policy if exists "Admin aktualizuje branding" on storage.objects;
create policy "Publiczny odczyt branding" on storage.objects for select using (bucket_id = 'branding');
create policy "Admin zarzadza branding" on storage.objects for insert with check (bucket_id = 'branding' and is_admin());
create policy "Admin aktualizuje branding" on storage.objects for update using (bucket_id = 'branding' and is_admin());


insert into storage.buckets (id, name, public) values ('car-photos', 'car-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('submissions', 'submissions', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('contest-photos', 'contest-photos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('site-assets', 'site-assets', true) on conflict (id) do nothing;

drop policy if exists "Publiczny odczyt site-assets" on storage.objects;
drop policy if exists "Admin zarzadza site-assets" on storage.objects;
create policy "Publiczny odczyt site-assets" on storage.objects for select using (bucket_id = 'site-assets');
create policy "Admin zarzadza site-assets" on storage.objects for insert with check (bucket_id = 'site-assets' and is_admin());
create policy "Admin aktualizuje site-assets" on storage.objects for update using (bucket_id = 'site-assets' and is_admin());
create policy "Admin usuwa site-assets" on storage.objects for delete using (bucket_id = 'site-assets' and is_admin());

drop policy if exists "Publiczny odczyt car-photos" on storage.objects;
drop policy if exists "Admin zapisuje car-photos" on storage.objects;
drop policy if exists "Admin aktualizuje car-photos" on storage.objects;
drop policy if exists "Admin usuwa car-photos" on storage.objects;
create policy "Publiczny odczyt car-photos" on storage.objects for select using (bucket_id = 'car-photos');
create policy "Admin zapisuje car-photos" on storage.objects for insert with check (bucket_id = 'car-photos' and is_admin());
create policy "Admin aktualizuje car-photos" on storage.objects for update using (bucket_id = 'car-photos' and is_admin());
create policy "Admin usuwa car-photos" on storage.objects for delete using (bucket_id = 'car-photos' and is_admin());

drop policy if exists "Publiczny odczyt submissions" on storage.objects;
drop policy if exists "Kazdy wysyla do submissions" on storage.objects;
drop policy if exists "Admin usuwa submissions" on storage.objects;
create policy "Publiczny odczyt submissions" on storage.objects for select using (bucket_id = 'submissions');
create policy "Kazdy wysyla do submissions" on storage.objects for insert with check (bucket_id = 'submissions');
create policy "Admin usuwa submissions" on storage.objects for delete using (bucket_id = 'submissions' and is_admin());

drop policy if exists "Publiczny odczyt avatars" on storage.objects;
drop policy if exists "Zalogowany wysyla avatar" on storage.objects;
drop policy if exists "Zalogowany usuwa swoj avatar" on storage.objects;
create policy "Publiczny odczyt avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Zalogowany wysyla avatar" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated' and not is_banned());
create policy "Zalogowany usuwa swoj avatar" on storage.objects for delete using (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "Publiczny odczyt contest-photos" on storage.objects;
drop policy if exists "Zalogowany wysyla contest-photos" on storage.objects;
create policy "Publiczny odczyt contest-photos" on storage.objects for select using (bucket_id = 'contest-photos');
create policy "Zalogowany wysyla contest-photos" on storage.objects for insert with check (bucket_id = 'contest-photos' and auth.role() = 'authenticated' and not is_banned());


-- ============================================================
-- 13. RANKING (leaderboard) - widok, nie tabela, wiec zawsze aktualny.
-- Punkty: 1 za polubione auto, 5 za odznakę, 20 za wygrany tydzień konkursu.
-- ============================================================
create or replace view leaderboard as
select
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  coalesce(likes.cnt, 0) as liked_count,
  coalesce(badges.cnt, 0) as badge_count,
  coalesce(wins.cnt, 0) as contest_wins,
  coalesce(likes.cnt, 0) + coalesce(badges.cnt, 0) * 5 + coalesce(wins.cnt, 0) * 20 as score
from profiles p
left join (select visitor_id, count(*) as cnt from swipes where liked = true group by visitor_id) likes
  on likes.visitor_id = p.id::text
left join (select user_id, count(*) as cnt from user_badges group by user_id) badges
  on badges.user_id = p.id
left join (select user_id, count(*) as cnt from contest_entries where status = 'won' group by user_id) wins
  on wins.user_id = p.id
where p.is_banned = false
order by score desc;

-- ============================================================
-- 8. (OPCJONALNE) automatyczne rozstrzyganie konkursu co tydzien przez pg_cron
-- Wymaga wlaczenia rozszerzenia pg_cron: Supabase Dashboard -> Database -> Extensions -> pg_cron
-- Odkomentuj i uruchom PO wlaczeniu rozszerzenia:
-- ============================================================
-- select cron.schedule(
--   'weekly-contest-resolution',
--   '0 20 * * 0',  -- niedziela 20:00 UTC - dostosuj wg potrzeb
--   $$ select resolve_weekly_contest(); $$
-- );

