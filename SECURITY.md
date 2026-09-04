# Sicherheitsrichtlinie (Security Policy)

Dieses Dokument beschreibt die Sicherheitseigenschaften des Produkts, den
Umgang mit Schwachstellenmeldungen und den Prozess für Updates und Patches.

## Sicherheitsannahmen

- Alle geschützten API-Routen erfordern ein gültiges, signiertes JWT
  (`Authorization: Bearer <token>`). Ohne gültiges Token antwortet der Server
  mit `401`, ohne ausreichende Rolle mit `403`.
- Passwörter werden ausschließlich als bcrypt-Hash gespeichert und niemals im
  Klartext verarbeitet oder protokolliert.
- Secrets und Konfiguration kommen ausschließlich aus der Umgebung
  (`JWT_SECRET`, `DATABASE_URL`, `BACKEND_CORS_ORIGINS`). Es sind keine Secrets
  im Repository abgelegt.
- CORS erlaubt ausschließlich den konfigurierten Frontend-Ursprung
  (`BACKEND_CORS_ORIGINS`) und keine Wildcard-Origins.
- Das Backend validiert Eingaben serverseitig (Längen, Typen, Aufzählungswerte)
  und liefert Validierungsfehler als `422` zurück.

## Eingesetzte kryptografische Verfahren

| Zweck            | Verfahren / Algorithmus                |
|------------------|----------------------------------------|
| Passwort-Hashing | bcrypt (Ident `2b`, via `passlib`)     |
| Token-Signierung | HS256 (HMAC-SHA-256, via `PyJWT`)      |
| Token-Payload    | `sub` (Benutzer-ID), `role`, `exp`     |

Der JWT-Schlüssel (`JWT_SECRET`) muss mindestens 32 Zeichen lang sein und wird
pro Umgebung vergeben (`RUN.json`: `generate`). Ein zu kurzer oder fehlender
Schlüssel verhindert den Start bzw. die Token-Erstellung.

## Token-Gültigkeitsdauer

- Zugriffstoken laufen standardmäßig nach **30 Minuten** ab
  (`TOKEN_EXPIRE_MINUTES`, Standardwert 30).
- Der Ablauf wird über den `exp`-Claim erzwungen; abgelaufene Token werden mit
  `401` („Token expired") abgelehnt.
- Abmeldung (`POST /api/auth/logout`) ist zustandslos; die Gültigkeit eines
  bereits ausgestellten Tokens endet mit dessen Ablauf.

## Update- und Patch-Prozess

- Abhängigkeiten sind in `backend/requirements.txt` und `frontend/package.json`
  (plus `package-lock.json`) auf konkrete Versionen gepinnt, damit die
  Software-Stückliste (SBOM) nachvollziehbar ist.
- Updates erfolgen bewusst über eine Änderung der gepinnten Version plus
  erneute Installation (`pip install -r requirements.txt` bzw. `npm install`),
  niemals durch stillschweigendes Aktualisieren im laufenden Betrieb.
- Vor jedem Update werden Tests, Linting und der Produktions-Build ausgeführt.
- Hinweise aus `npm audit` / Dependency-Scannern werden als Ausgangspunkt für
  ein geplantes Update behandelt, nicht automatisch mit `--force` angewendet.

## Umgang mit Schwachstellenmeldungen

Meldungen zu Sicherheitslücken behandeln wir vertraulich:

1. Bitte **kein öffentliches Issue** für eine Schwachstelle anlegen.
2. Beschreibe die Schwachstelle (betroffene Komponente, Reproduktionsschritte,
   mögliche Auswirkungen) und sende sie über den vertraulichen Kanal des
   Projekts (z. B. eine private Nachricht an die Maintainer).
3. Wir bestätigen den Eingang, prüfen die Meldung und veröffentlichen nach der
   Behebung eine Zusammenfassung, sobald ein Fix verfügbar ist.
4. Details werden erst öffentlich gemacht, wenn ein Patch veröffentlicht wurde.

## Verantwortungsvolle Offenlegung

- Kritische Schwachstellen werden mit höchster Priorität behandelt.
- Während der Bearbeitung werden keine Ausnutzungsdetails verbreitet.
- Für jede behobene Schwachstelle wird die betroffene Version, die Schwelle und
  die aktualisierte Version dokumentiert.
