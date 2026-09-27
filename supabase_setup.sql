-- =========================================================================
-- TÜRKÇE YAZMA OYUNU (ANTİWORDS) - SUPABASE VERİTABANI KURULUM DOSYASI
-- =========================================================================
-- Bu SQL kodunu Supabase Dashboard > "SQL Editor" sekmesine yapıştırıp
-- sağ alttaki "Run" (veya Ctrl+Enter) butonuna basarak tek seferde çalıştırabilirsiniz.
-- =========================================================================

-- 1. LİDERLİK TABLOSU (LEADERBOARD)
create table if not exists public.leaderboard (
    id uuid default gen_random_uuid() primary key,
    username text not null check (length(username) >= 1 and length(username) <= 30),
    score integer not null check (score >= 0 and score <= 300000),
    wpm integer not null check (wpm >= 0 and wpm <= 240),
    accuracy integer not null default 100 check (accuracy >= 0 and accuracy <= 100),
    difficulty text default 'medium',
    mode text default 'single', -- 'single' veya '1v1' veya challenge id
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Hızlı sıralama için indeksler
create index if not exists idx_leaderboard_score on public.leaderboard (score desc);
create index if not exists idx_leaderboard_wpm on public.leaderboard (wpm desc);

-- 2. OYUN ODALARI (GAME ROOMS)
create table if not exists public.game_rooms (
    id uuid default gen_random_uuid() primary key,
    room_code text unique not null,
    status text not null default 'waiting', -- 'waiting', 'countdown', 'playing', 'finished'
    host_name text not null,
    guest_name text,
    difficulty text not null default 'medium',
    seed bigint not null,
    winner text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_rooms_code on public.game_rooms (room_code);
create index if not exists idx_rooms_status on public.game_rooms (status);

-- 3. GÜVENLİK (ROW LEVEL SECURITY - HERKESE AÇIK OYUN İZİNLERİ)
alter table public.leaderboard enable row level security;
alter table public.game_rooms enable row level security;

-- Leaderboard okuma ve yazma izinleri
drop policy if exists "Herkes liderlik tablosunu okuyabilir" on public.leaderboard;
create policy "Herkes liderlik tablosunu okuyabilir" 
on public.leaderboard for select using (true);

drop policy if exists "Herkes skor ekleyebilir" on public.leaderboard;
create policy "Herkes skor ekleyebilir" 
on public.leaderboard for insert with check (true);

-- Game Rooms okuma, ekleme ve güncelleme izinleri
drop policy if exists "Herkes odaları görebilir" on public.game_rooms;
create policy "Herkes odaları görebilir" 
on public.game_rooms for select using (true);

drop policy if exists "Herkes oda oluşturabilir" on public.game_rooms;
create policy "Herkes oda oluşturabilir" 
on public.game_rooms for insert with check (true);

drop policy if exists "Oda durumunu herkes güncelleyebilir" on public.game_rooms;
create policy "Oda durumunu herkes güncelleyebilir" 
on public.game_rooms for update using (true);

-- 4. REALTIME (CANLI YAYIN) İZNİ
-- game_rooms tablosundaki değişiklikleri anlık dinleyebilmek için:
alter publication supabase_realtime add table public.game_rooms;
