/* ======================================================================
   Jedno, wspolne polaczenie z Supabase dla calej strony.
   Wczesniej kazdy plik (site-settings.js, auth.js, script.js, saved.js...)
   tworzyl WLASNY klient przez createClient() - a kazdy taki klient uruchamia
   wlasna instancje GoTrueClient, ktora probuje obslugiwac sesje logowania
   pod tym samym kluczem w localStorage. Przegladarka ostrzegala o tym
   ("Multiple GoTrueClient instances detected") i w praktyce mogl to byc
   powod niestabilnego wykrywania sesji zaraz po powrocie z logowania Google
   (dwie instancje "walczyly" o przetworzenie tokenu z adresu URL).

   Ten plik tworzy JEDEN klient i wystawia go jako window.__supabaseClient.
   Kazdy kolejny skrypt na stronie powinien go uzyc zamiast wywolywac
   createClient() ponownie:

     var supabaseClient = window.__supabaseClient || window.supabase.createClient(cleanUrl, cleanKey);

   Musi byc wczytany zaraz po config.js, a przed wszystkimi innymi
   skryptami korzystajacymi z Supabase (site-settings.js, auth.js, script.js...).
   ====================================================================== */
(function () {
  "use strict";
  if (window.__supabaseClient) return;
  if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined") return;
  if (typeof window.supabase === "undefined") return;

  var cleanUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
  var cleanKey = SUPABASE_ANON_KEY.trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cleanUrl)) return;

  window.__supabaseClient = window.supabase.createClient(cleanUrl, cleanKey);
})();
