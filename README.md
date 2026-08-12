# CarMatch

Strona dla ludzi, którzy kochają oglądać samochody. Statyczny HTML/CSS/JS
(zero npm/node) + Supabase (baza, konta, storage). Konta użytkowników,
panel admina, zgłoszenia od społeczności, cotygodniowy konkurs z limitem
30 miejsc i głosowaniem, system odznak.

## Pliki

| Plik | Do czego służy |
|---|---|
| `index.html` / `style.css` / `script.js` | Strona główna - swipe deck |
| `auth.html` / `auth.js` | Logowanie i rejestracja |
| `profile.html` / `profile.js` | Profil, ustawienia, odznaki |
| `saved.html` / `saved.js` | Polubione auta |
| `contest.html` / `contest.js` | Konkurs tygodniowy |
| `cm-console-7f2k.html` / `admin.css` / `admin.js` | **Panel admina** (ukryty adres, patrz niżej) |
| `schema.sql` | Cały schemat bazy - uruchamiasz raz w Supabase |
| `config.js` | Twoje dane dostępowe do Supabase |
| `cars-data.js` | Katalog startowy ~65 aut (tylko do jednorazowego seedowania) |
| `pages.css` | Wspólne style dla podstron (profil/zapisane/konkurs/auth) |

## Konfiguracja krok po kroku

### 1. Projekt Supabase
supabase.com → New project.

### 2. Schemat bazy
SQL Editor → wklej cały `schema.sql` → Run.

### 3. config.js
Project Settings → API → `Project URL` i klucz `anon public`.

### 4. Załóż swoje konto i zrób z niego admina
- Wejdź na `auth.html`, zarejestruj się normalnie jak zwykły użytkownik
- W Supabase → **SQL Editor** uruchom (podmieniając swój email):
  ```sql
  update profiles set is_admin = true
  where id = (select id from auth.users where email = 'twoj@email.pl');
  ```
- Od teraz to konto (i tylko ono) ma dostęp do panelu admina

### 5. Wgraj katalog startowy
Otwórz `cm-console-7f2k.html`, zaloguj się swoim kontem admina,
zakładka **Auta** → **"Wgraj katalog startowy (65 aut)"**.

### 6. Gotowe
`index.html` działa. Reszta stron (profil/zapisane/konkurs) też.

## Prawdziwa wysyłka maili przez SendGrid

Supabase domyślnie wysyła maile (potwierdzenie rejestracji, reset hasła)
ze swojego adresu, z niskim limitem. Żeby faktycznie leciały przez SendGrid:

1. Załóż konto na sendgrid.com, zweryfikuj domenę/adres nadawcy, wygeneruj **API Key**
2. Supabase → **Project Settings → Auth → SMTP Settings** → włącz "Custom SMTP"
3. Wpisz:
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - Username: `apikey` (dosłownie to słowo)
   - Password: Twój SendGrid API Key
   - Sender email: adres zweryfikowany w SendGrid
4. Zapisz - od tej pory maile z rejestracji/resetu hasła realnie idą przez SendGrid

To jedyny bezpieczny sposób podpięcia SendGrid do statycznej strony - klucz
API nigdy nie trafia do kodu w przeglądarce (gdzie każdy mógłby go ukraść).

## Konkurs tygodniowy - jak to działa

- Zalogowany user klika **"Zgłoś swoje auto"** na `contest.html`, wgrywa zdjęcie i opis
- **Limit 30 aktywnych miejsc na tydzień**, wymuszony w bazie (nie tylko w interfejsie)
  - 31. zgłoszenie dostaje błąd `CONTEST_FULL` i widzi komunikat, że trzeba poczekać
  - Jeden user = jedno aktywne zgłoszenie na tydzień
- Każdy zalogowany może oddać **jeden głos na tydzień** (można zmienić głos,
  nie zdublować)
- **Rozstrzygnięcie tygodnia**: funkcja `resolve_weekly_contest()` w bazie
  wyłania auto z największą liczbą głosów, nadaje mu status `won` (trafia do
  "Hall of Fame" na górze strony konkursu) + odznakę 🏆, a resztę archiwizuje
  (zwalnia wszystkie 30 miejsc na nowy tydzień)

### Jak to automatycznie odpala się co tydzień
Supabase wspiera `pg_cron` - harmonogram działający w samej bazie, bez
żadnego zewnętrznego serwera:

1. Supabase → **Database → Extensions** → włącz `pg_cron`
2. SQL Editor → odkomentuj i uruchom blok na końcu `schema.sql`:
   ```sql
   select cron.schedule(
     'weekly-contest-resolution',
     '0 20 * * 0',
     $$ select resolve_weekly_contest(); $$
   );
   ```
   (`0 20 * * 0` = niedziela 20:00 UTC - zmień godzinę/dzień wg uznania)

Bez tego kroku możesz też rozstrzygać tydzień ręcznie z SQL Editora,
wywołując `select resolve_weekly_contest();` kiedy chcesz.

### Zwalnianie miejsc w trakcie tygodnia
Admin może usunąć dowolne zgłoszenie (np. nieodpowiednie) z poziomu bazy:
```sql
delete from contest_entries where id = 123;
```
Zwalnia to miejsce od razu, bez czekania na koniec tygodnia.

## Odznaki

14 odznak w tabeli `badges` (pełna lista i opisy w `schema.sql`), np.
"Pierwszy kontakt", "Kolekcjoner", "Zwiadowca", "Mistrz tygodnia". Nadawane
przez funkcję `check_and_award_badges()` w bazie - **weryfikacja warunków
dzieje się w Postgresie**, nie na podstawie tego co przyśle przeglądarka,
więc nie da się ich sobie "wymusić" bez faktycznego spełnienia warunku.
Wywoływana automatycznie po swipe'ach, głosach i zgłoszeniach konkursowych.

## Panel admina - pełna kontrola (bez grzebania w bazie ręcznie)

Zakładki w `cm-console-7f2k.html`:

- **Auta / Zdjęcia / Zgłoszenia aut / Zgłoszone zdjęcia** - jak wcześniej
- **Użytkownicy** - lista wszystkich kont z wyszukiwarką, przyciski
  **Zbanuj/Odbanuj** i **Nadaj/Odbierz admina** przy każdym użytkowniku.
  Zbanowany user nie może zgłaszać ani głosować w konkursie (wymuszone
  w bazie, nie tylko w interfejsie) - w interfejsie widzi czytelny komunikat
  zamiast surowego błędu
- **Odznaki** - dodawaj nowe odznaki (ikona/nazwa/opis), nadawaj je ręcznie
  wybranemu userowi, usuwaj istniejące
- **Konkurs** - podgląd aktywnych zgłoszeń bieżącego tygodnia z liczbą
  głosów, przycisk "Usuń (zwolnij miejsce)" przy każdym, i "Rozstrzygnij
  konkurs teraz" (to samo co czeka na pg_cron, tylko na żądanie)

Zero potrzeby otwierania SQL Editora do codziennej pracy - to jest tylko
dla jednorazowej konfiguracji (schemat, pierwszy admin).

## Powiadomienia o odznakach

Kiedy zdobędziesz nową odznakę (przez swipe'y, głosowanie, zgłoszenia),
w prawym górnym rogu wyskakuje krótki toast z ikoną i nazwą odznaki -
działa na stronie głównej, konkursie i profilu.

## Super-odznaki za wielokrotne zwycięstwa

- Hattrick - wygrałeś konkurs 3 tygodnie z rzędu (bez przerwy)
- Legenda CarMatch - wygrałeś konkurs już 10 razy (niekoniecznie pod rząd)

Obie liczone automatycznie w `resolve_weekly_contest()` przy każdym
rozstrzygnięciu tygodnia - sprawdza historię zwycięstw danego użytkownika.

## Logowanie przez Google

1. Google Cloud Console (console.cloud.google.com) → stwórz projekt (jeśli nie masz) →
   **APIs & Services → OAuth consent screen** → wypełnij podstawowe dane
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → typ "Web application"
3. Skopiuj URL przekierowania z Supabase: **Authentication → Providers → Google**
   (Supabase pokaże gotowy "Callback URL" - wklej go w Google jako "Authorized redirect URI")
4. Wklej **Client ID** i **Client Secret** z Google z powrotem do Supabase, w tym samym miejscu,
   i włącz providera
5. Gotowe - przycisk "Kontynuuj przez Google" na `auth.html` działa od razu, bez zmian w kodzie

## Czat z AI o każdym aucie (Gemini, przez Google Cloud)

Klucz do Gemini **nigdy nie trafia do przeglądarki** - żyje tylko jako sekret
w Supabase Edge Function. Wymaga jednorazowego wdrożenia z terminala:

1. Zdobądź darmowy klucz API: aistudio.google.com → "Get API key"
2. Zainstaluj Supabase CLI (jednorazowo): `npm install -g supabase`
3. W folderze projektu:
   ```bash
   supabase login
   supabase link --project-ref TWOJ-PROJECT-REF
   supabase secrets set GEMINI_API_KEY=twoj_klucz_z_aistudio
   supabase functions deploy chat-with-car
   ```
   (`TWOJ-PROJECT-REF` znajdziesz w URL swojego projektu Supabase, np. `abcdefghijk` z `abcdefghijk.supabase.co`)
4. Gotowe - ikona 💬 na każdej karcie auta (główny ekran i zapisane) otwiera czat

**Zasady działania czatu** (wymuszone w kodzie i bazie):
- Wymaga zalogowania - anonimowi odwiedzający widzą prośbę o logowanie zamiast czatu
- Historia rozmowy o danym aucie zostaje, **dopóki auto jest polubione**
- Jeśli auto zostanie odrzucone (pas), rozmowa o nim **znika automatycznie**
- Można wyczyścić pojedynczą rozmowę (przycisk w oknie czatu) albo wszystkie naraz (profil)
- Zbanowany użytkownik nie może korzystać z czatu (sprawdzane w Edge Function, nie tylko w interfejsie)

## Quiz preferencji

Bez kategorii budżetu (usunięta) - filtrowanie oparte o napęd, segment, markę
i kraj pochodzenia, co daje trafniejsze dopasowanie niż sama cena. Quiz jest
**obowiązkowy** - nowy użytkownik nie ma jak go pominąć ani zamknąć, dopóki
nie odpowie na wszystkie pytania. Auta, które użytkownik już ocenił (lubię
lub pas), nigdy nie pojawiają się ponownie - kolejka jest filtrowana po
historii swipe'ów przy każdym budowaniu.

## Logowanie wymagane od początku

Cała strona (nie tylko konkurs/profil) wymaga konta - `index.html`
przekierowuje na `auth.html`, jeśli nie ma aktywnej sesji. To też upraszcza
identyfikację: `visitor_id` w bazie to teraz zawsze prawdziwe `auth.uid()`,
nie losowe UUID z przeglądarki.

## Panel admina - wygląd i dodatkowe zakładki

Panel ma teraz układ z bocznym menu (sidebar) zamiast poziomych zakładek -
skaluje się lepiej przy większej liczbie sekcji. Trzy nowe funkcje w
zakładce **Wygląd**, wszystkie widoczne od razu na **każdej** stronie
(głównej, logowaniu, profilu, zapisanych, konkursie), nie tylko na `index.html`:

- **Kolor akcentu** - jeden picker, zmienia się wszędzie
- **Logo strony** - wgrywasz swój plik (osobno dla trybu jasnego i ciemnego),
  podmienia się w pasku górnym, na ekranie logowania i w onboardingu -
  bez dotykania `logo-light.png`/`logo-dark.png` na dysku
- **Baner z komunikatem** - pasek na górze każdej strony (np. "Przerwa
  techniczna w niedzielę"), użytkownik może go zamknąć na czas swojej sesji;
  wraca dopiero gdy zmienisz treść

Techniczne działanie: wszystko czyta się z tabeli `site_settings` przez
mały, wspólny plik `site-settings.js`, dołączony do każdej strony - jedna
zmiana w panelu, efekt wszędzie, bez edycji kodu którejkolwiek podstrony.

Dodatkowa zakładka **Opinie** - wszystko, co użytkownicy napiszą w profilu
("Masz pomysł jak to ulepszyć?"), z możliwością usunięcia przeczytanych.


## Zapisane - przebudowany interfejs

- Karty większe, z realnym zdjęciem (albo sylwetką, jeśli auto go jeszcze
  nie ma), plakietką napędu i ceny
- Hover pokazuje skrót opisu na dole karty, klik otwiera pełny opis w modalu
- Filtrowanie po rodzaju napędu (chipy nad siatką) + licznik polubionych
- Przycisk 💬 przy każdej karcie otwiera czat z AI o tym aucie

## Opinie użytkowników

Na stronie profilu jest teraz formularz "Masz pomysł jak to ulepszyć?" -
każda wiadomość trafia do panelu admina (zakładka Opinie), widoczna
tylko dla Ciebie.

## Retencja - dlaczego ludzie mieliby wracać

- **Passa (streak)** - liczona automatycznie z historii swipe'ów, pokazywana
  na profilu ("5 dni z rzędu - nie przerywaj passy!"). Trzy odznaki: 3, 7 i
  30 dni z rzędu
- **Ranking** (`leaderboard.html`, link w dolnej nawigacji) - TOP 50 według
  punktów (1 za polubione auto, 5 za odznakę, 20 za wygrany tydzień
  konkursu). Widok w bazie (`leaderboard`), zawsze aktualny, nie trzeba nic
  przeliczać ręcznie
- **Auto dnia** - baner nad stosem kart na stronie głównej, jedno wyróżnione
  auto dziennie (deterministycznie wybrane z całego katalogu, to samo auto
  dla wszystkich danego dnia), klik pokazuje pełny opis

## Panel admina - Dashboard

Pierwsza zakładka po zalogowaniu to teraz Panel startowy - siedem kart
z liczbami (auta, użytkownicy, zgłoszenia do przejrzenia, aktywność z
ostatnich 24h), klikalne (przenoszą do właściwej zakładki), plus sekcja
"Wymaga Twojej uwagi" wypisująca konkretnie co czeka na decyzję.

## Bezpieczeństwo pod publiczne repo na GitHubie

Ten projekt jest zaprojektowany tak, żeby dało się go bezpiecznie trzymać
w **publicznym** repozytorium:

- `config.js` zawiera tylko `SUPABASE_URL` i `SUPABASE_ANON_KEY` - oba są
  z założenia publiczne (widoczne w każdej stronie internetowej korzystającej
  z Supabase), więc mogą spokojnie trafić do repo. Prawdziwą ochronę dają
  reguły RLS w `schema.sql`, nie ukrywanie tego pliku
- **Nigdy** nie commituj klucza `service_role` ani `GEMINI_API_KEY` -
  ten drugi żyje wyłącznie jako sekret Edge Function (`supabase secrets set`),
  nigdy w żadnym pliku w repo
- `.gitignore` blokuje przypadkowe commity plików z "secrets"/"service-role"
  w nazwie
- Każdy plik HTML ma nagłówek **Content-Security-Policy** ograniczający,
  skąd strona może ładować skrypty/style/połączenia (tylko własna domena,
  jsdelivr CDN dla biblioteki Supabase, fonts.googleapis.com, i Twój projekt
  Supabase)
- Dodatkowo w panelu Supabase warto włączyć (Authentication → Settings):
  **Leaked Password Protection** i **CAPTCHA** (hCaptcha/Turnstile) na
  formularzu rejestracji - to blokuje boty zakładające konta hurtowo, co
  ma znaczenie, gdy adres Twojego projektu jest publicznie widoczny w repo
- Panel admina pod nieoczywistym adresem + prawdziwa flaga `is_admin` w bazie
  (opisane niżej) - obie warstwy razem, nie tylko jedna

## Bezpieczeństwo - pozostałe mechanizmy

1. **Rozróżnienie ról** - reguły bazy (RLS) sprawdzają nie "czy ktoś jest
   zalogowany", tylko konkretnie `is_admin = true` w tabeli `profiles`.
   Zwykli zarejestrowani użytkownicy (nawet jeśli ktoś znajdzie panel admina)
   nie mają żadnych uprawnień zapisu do katalogu aut
2. **Panel admina pod nieoczywistym adresem** (`cm-console-7f2k.html`) i
   nigdzie na stronie niezlinkowany. **To nie jest prawdziwe zabezpieczenie**,
   tylko utrudnienie - realna ochrona to punkt 1. Jeśli chcesz dodatkowo
   zmienić tę nazwę na własną, po prostu zmień nazwę pliku (i nic więcej -
   `admin.js`/`admin.css` zostają bez zmian)
3. **Limit konkursowy wymuszony w bazie** (trigger), nie tylko w interfejsie -
   nie da się go obejść bezpośrednim wywołaniem API
4. **Odznaki weryfikowane server-side** - nie da się ich sobie przyznać
5. `SUPABASE_ANON_KEY` w `config.js` jest z założenia publiczny - to nie
   sekret. Nigdy nie wklejaj tam klucza **service_role** (innego niż `anon`)

## Dodawanie kolejnych aut

Nie edytuj `cars-data.js` (to był tylko katalog startowy). Nowe auta dodajesz
przez panel admina: pojedynczo, przez CSV, albo zatwierdzając zgłoszenia
od użytkowników.

## Języki i personalizacja wyglądu (nowość)

Każda strona ma teraz w prawym górnym rogu przycisk ⚙ - otwiera panel,
w którym odwiedzający sam wybiera:

- **Język interfejsu** - polski, angielski, niemiecki, hiszpański. Wybór
  zapamiętywany jest w przeglądarce (localStorage), a przy pierwszej wizycie
  strona zgaduje język na podstawie ustawień przeglądarki (jeśli to jeden
  z tych czterech - w przeciwnym razie startuje po polsku)
- **Motyw** - jasny / ciemny / automatyczny (podąża za ustawieniem systemu
  operacyjnego i reaguje na żywo, jeśli użytkownik zmieni je w trakcie)
- **Kolor akcentu** - własny wybór z palety, nadpisuje domyślny kolor
  ustawiony przez Ciebie w panelu admina (zakładka Wygląd), ale tylko
  dla tej jednej osoby - reszta odwiedzających nadal widzi Twój domyślny
- **Rozmiar tekstu** - normalny / duży, przydatne dla słabiej widzących

Wszystko działa lokalnie w przeglądarce użytkownika (bez logowania,
bez zapisu w bazie) - każdy odwiedzający ustawia to niezależnie.

Techniczne działanie: trzy nowe pliki, dołączone do każdej strony
(zaraz po `config.js`, przed `site-settings.js`):

- `i18n.js` - słowniki PL/EN/DE/ES i silnik podmieniający teksty
  (atrybuty `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label` w HTML;
  funkcja `CM_T("klucz")` w JS-ie dla tekstów generowanych dynamicznie)
- `appearance.js` - obsługa motywu/koloru akcentu/rozmiaru tekstu,
  współpracuje z `site-settings.js` (Twój domyślny kolor akcentu z panelu
  admina wygrywa, dopóki użytkownik nie wybierze własnego)
- `settings-panel.js` - sam interfejs (przycisk ⚙ + panel), wstrzykiwany
  automatycznie na każdej stronie, nie trzeba nic dodawać do HTML-a

Panel admina (`cm-console-7f2k.html`) zostaje po polsku - to narzędzie
tylko dla Ciebie, nie dla odwiedzających.

Żeby dodać własny tekst do tłumaczeń (np. nowy przycisk), dopisz klucz
w czterech miejscach w `i18n.js` (sekcje `pl`, `en`, `de`, `es`) i użyj
go przez `data-i18n="twoj.klucz"` w HTML-u albo `CM_T("twoj.klucz")` w JS-ie.

## Uwaga o CSP i ochronie przed clickjackingiem

Nagłówek `Content-Security-Policy` w każdym pliku HTML jest wpisany jako
znacznik `<meta>`, bo to statyczna strona bez własnego serwera. Ma to jedno
ograniczenie: dyrektywa `frame-ancestors` (blokująca osadzanie strony w
`<iframe>` na obcych domenach) **działa tylko wysłana jako prawdziwy
nagłówek HTTP** - w znaczniku `<meta>` przeglądarka ją ignoruje i tylko
wypisuje ostrzeżenie w konsoli, więc ją usunąłem z `<meta>`, żeby nie
zaśmiecała konsoli.

Jeśli chcesz faktycznie zablokować osadzanie strony w cudzych ramkach,
dodaj nagłówek po stronie hostingu (nie w kodzie strony), np.:

- **Netlify** - plik `_headers` w katalogu strony:
  ```
  /*
    X-Frame-Options: DENY
    Content-Security-Policy: frame-ancestors 'none'
  ```
- **Vercel** - `vercel.json`:
  ```json
  { "headers": [{ "source": "/(.*)", "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Content-Security-Policy", "value": "frame-ancestors 'none'" }
  ]}]}
  ```
- **Cloudflare Pages** - plik `_headers`, ta sama składnia co Netlify

Reszta polityki CSP (skąd wolno ładować skrypty/style/połączenia) działa
poprawnie przez `<meta>` i zostaje bez zmian.
