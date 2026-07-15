# Taxi White-Label PWA

Uniwersalny silnik PWA dla lokalnych firm taxi. Pierwsze wdrożenie: **Taxi Andrzej Pełka**.

## Funkcje MVP

- formularz „Taxi teraz” i „Rezerwacja na później”,
- kod rezerwacji i sprawdzanie statusu,
- obsługa wielu kierowców i samochodów,
- status dostępny / niedostępny,
- wybór aktywnego samochodu,
- mechanizm „pierwszy kierowca akceptuje”,
- informacja dla pozostałych kierowców,
- kolejne statusy realizacji kursu,
- konfiguracja white-label,
- instalacja PWA i podstawowa praca offline,
- otwieranie trasy w Google Maps.

## Ważne ograniczenie obecnej wersji

Dane są obecnie przechowywane w `localStorage`. Oznacza to, że wersja demonstracyjna działa w jednej przeglądarce, ale nie synchronizuje jeszcze telefonów klienta i kierowców.

Następny etap:

- Firebase Authentication,
- Cloud Firestore,
- Cloud Functions,
- Firebase Cloud Messaging,
- reguły bezpieczeństwa multi-tenant.

## Uruchomienie lokalne

Nie otwieraj aplikacji bezpośrednio przez plik `index.html`, ponieważ service worker wymaga HTTP lub HTTPS.

```bash
python -m http.server 8080
```

Następnie otwórz:

```text
http://localhost:8080
```

## Publikacja na GitHub Pages

Repozytorium zawiera workflow:

```text
.github/workflows/pages.yml
```

Po wysłaniu kodu na gałąź `main`:

1. Otwórz repozytorium na GitHub.
2. Wejdź w `Settings`.
3. Wybierz `Pages`.
4. W sekcji `Build and deployment` ustaw `Source: GitHub Actions`.
5. Otwórz zakładkę `Actions` i sprawdź wykonanie zadania `Deploy PWA to GitHub Pages`.

Typowy adres strony projektu:

```text
https://NAZWA-UZYTKOWNIKA.github.io/taxi-white-label-pwa/
```

## Wysłanie projektu przez GitHub Desktop

1. Rozpakuj ZIP.
2. Otwórz GitHub Desktop.
3. Wybierz `File` → `Add local repository`.
4. Wskaż rozpakowany folder.
5. Gdy program zaproponuje utworzenie repozytorium, zaakceptuj.
6. Wykonaj pierwszy commit.
7. Kliknij `Publish repository`.

## Wysłanie projektu przez terminal

Najpierw utwórz na GitHub puste repozytorium, bez automatycznego README i `.gitignore`.

```bash
git init -b main
git add .
git commit -m "Initial Taxi PWA MVP"
git remote add origin ADRES_REPOZYTORIUM
git push -u origin main
```

## Bezpieczeństwo

Nie zapisuj w repozytorium haseł, prywatnych kluczy ani sekretów Firebase. Publiczna konfiguracja klienta Firebase będzie później oddzielona od sekretów serwerowych.
