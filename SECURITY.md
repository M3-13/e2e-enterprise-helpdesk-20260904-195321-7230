VERDICT: BLOCKED

## Sicherheitsbericht (Enterprise Helpdesk)

### Zusammenfassung
Die manuelle Code-Analyse hat zwei schwerwiegende Sicherheitsprobleme ergeben, die eine Auslieferung blockieren: ein kritischer Auth-Bypass durch einen unsicheren `JWT_SECRET`-Standardwert sowie eine Broken-Access-Control-Schwachstelle, die es Meldenden erlaubt, fremde Tickets zu kommentieren. Daneben bestehen mehrere Härtungsbedarfe.

**Methodik / Scanner-Lücken:**  
Die konfigurierten Scanner `bandit` und `semgrep` wurden übersprungen (`[skipped]`). Ein Dependency-Audit (`pip-audit` / `npm audit`) ist nicht gelaufen. Daher fehlt eine automatisierte Prüfung der Abhängigkeiten. Dies ist ausdrücklich eine Lücke, nicht Teil des untenstehenden Verdicts.

---

### Kritische Befunde

#### 1. Auth-Bypass durch leeres JWT-Geheimnis
**Schweregrad:** kritisch  
**Betroffene Datei/Stelle:** `backend/auth.py`, Funktion `_jwt_secret()`

**Problem:**  
`os.environ.get("JWT_SECRET", "")` liefert einen leeren String, wenn die Umgebungsvariable nicht gesetzt ist. Mit einem leeren HS256-Schlüssel kann ein Angreifer selbst gültige JWTs signieren und sich als beliebiger Benutzer (inkl. Admin) ausgeben. Dadurch werden sämtliche geschützten Endpunkte ausgehebelt (Auth-Bypass). Die Länge des Secrets wird nicht geprüft.

**Konkreter Fix:**  
Beim Start / Import validieren und fehlendes oder zu kurzes Secret ablehnen:

```python
import os

def _jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret or len(secret) < 32:
        raise RuntimeError("JWT_SECRET muss gesetzt und mindestens 32 Zeichen lang sein")
    return secret
```

Alternativ die Prüfung in `main.py` beim Lifespan/Start ausführen und die App nicht starten, wenn das Secret fehlt. Ein zufällig generiertes Secret wäre möglich, invalidiert aber alle Sitzungen bei Neustart – besser explizit konfigurieren.

---

#### 2. Broken Access Control / IDOR beim Erstellen von Kommentaren
**Schweregrad:** hoch  
**Betroffene Datei/Stelle:** `backend/routers/comments.py`, Funktion `create_comment` (POST `/api/tickets/{ticket_id}/comments`)

**Problem:**  
Die Funktion prüft lediglich, ob das Ticket existiert. Ein authentifizierter Melder (`role == "requester"`) kann dadurch Kommentare zu **fremden** Tickets erstellen, obwohl er diese Tickets weder lesen noch auflisten darf (`list_comments` und `get_ticket` setzen die Rolle korrekt durch, `create_comment` nicht). Dies ist eine klassische IDOR-Schwachstelle mit unautorisiertem Schreibzugriff.

**Konkreter Fix:**  
Vor dem Anlegen des Kommentars dieselbe Sichtbarkeitsprüfung wie bei `list_comments` ergänzen:

```python
if current_user.role == "requester" and ticket.requester_id != current_user.id:
    raise HTTPException(status_code=404, detail="Ticket not found")
```

Agenten und Admins behalten uneingeschränkten Kommentarzugriff.

---

### Mittlere Befunde

#### 3. CSV-Formel-Injection im Export
**Schweregrad:** mittel  
**Betroffene Datei/Stelle:** `backend/routers/export.py`, CSV-Ausgabe über `csv.writer`

**Problem:**  
Benutzergesteuerte Felder (Titel, Beschreibung, Kategorie) werden unverändert in die CSV-Datei geschrieben. Beginnt eine Zelle mit `=`, `+`, `-`, `@`, kann sie von Tabellenkalkulationen (z. B. Excel) als Formel interpretiert werden. Ein böswilliger Melder könnte so schädliche Formeln einschleusen, die beim Öffnen des Exports durch Agenten/Admins ausgeführt werden.

**Konkreter Fix:**  
Vor dem Schreiben jede Zelle prüfen und bei gefährlichem Präfix mit einem Apostroph neutralisieren:

```python
def _safe_csv(value: str) -> str:
    if value.startswith(("=", "+", "-", "@")):
        return "'" + value
    return value
```

Und diese Funktion für alle benutzergenerierten Felder (`ticket.title`, `ticket.description`, `ticket.category`, ggf. weitere) anwenden.

---

#### 4. Fehlende Passwort-Mindestlänge bei Benutzeranlage durch Admin
**Schweregrad:** mittel  
**Betroffene Datei/Stelle:** `backend/routers/users.py`, Funktion `create_user` (POST `/api/users`)

**Problem:**  
Der Registrierungs-Endpunkt erzwingt eine Mindestlänge von 8 Zeichen (`backend/routers/auth.py`). Die Admin-Benutzeranlage akzeptiert dagegen beliebig kurze Passwörter. Ein administrativ angelegter Benutzer kann dadurch ein triviales Passwort erhalten, was das Konto angreifbar macht.

**Konkreter Fix:**  
Dieselbe Passwort-Policy zentral durchsetzen, z. B.:

```python
from auth import hash_password, MIN_PASSWORD_LENGTH   # MIN_PASSWORD_LENGTH exportieren

if len(payload.password) < 8:
    raise HTTPException(status_code=422, detail="Password must be at least 8 characters long")
```

Besser: eine gemeinsame Validierungsfunktion in `auth.py` bereitstellen und in beiden Routern verwenden.

---

#### 5. PII-Redaktionsfilter unvollständig und nicht durchgängig wirksam
**Schweregrad:** mittel  
**Betroffene Datei/Stelle:** `backend/main.py`, `RedactPIIFilter`, `_configure_logging`

**Problem:**  
Der Filter erkennt und entfernt ausschließlich E-Mail-Adressen. Benutzernamen und Ticketinhalte werden nicht gefiltert. Zudem wird der Filter nur am selbst konfigurierten Root-Handler installiert; Uvicorn-eigene Access-Logs (z. B. `GET /api/tickets?search=...` inkl. Query-String) können daran vorbeilaufen. Damit ist AC-20 (keine E-Mail-Adressen, Benutzernamen oder Ticketinhalte in Logs) nicht zuverlässig erfüllt.

**Konkreter Fix:**  
- `RedactPIIFilter` um Muster für Benutzernamen und Freitext-Felder erweitern oder ein generisches `__pii_filter__`-Konzept verwenden.
- Das Logging zentral vor Uvicorn-Start konfigurieren oder Uvicorn-Access-Log deaktivieren/an den gefilterten Handler koppeln.
- Sicherstellen, dass Query-Strings, die Suchbegriffe mit PII enthalten, entweder nicht oder nur gefiltert protokolliert werden.

---

### Niedrige Befunde / Härtungshinweise

#### 6. In-Memory Rate-Limiter mit unbeschränktem Speicherwachstum und Proxy-Problematik
**Schweregrad:** niedrig  
**Betroffene Datei/Stelle:** `backend/routers/auth.py`, `_RateLimiter`, `_client_ip`

**Problem:**  
Die Rate-Limiter behalten jeden gesehenen IP-Schlüssel dauerhaft im Speicher, auch nach Ablauf der Versuche. Zudem wird hinter einem Reverse-Proxy nur die Proxy-IP als Schlüssel verwendet, wodurch das Limit entweder alle Clients gemeinsam trifft oder von einem einzelnen Client umgangen werden kann. Dies ist primär ein Verfügbarkeits-/Betriebsproblem, kein direkter Auth-Bypass.

**Konkreter Fix:**  
- Periodisch abgelaufene Schlüssel entfernen (TTL / Cleanup).
- Bei Betrieb hinter einem vertrauenswürdigen Proxy `X-Forwarded-For` auswerten (mit expliziter Proxy-Konfiguration).
- Für Multi-Worker-Betrieb einen zentralen Store (z. B. Redis) verwenden.

---

#### 7. Unbegrenzte `page_size` in der Ticketliste
**Schweregrad:** niedrig  
**Betroffene Datei/Stelle:** `backend/routers/tickets.py`, `list_tickets` und `services/ticket_filters.py`

**Problem:**  
`page_size` wird nur nach unten begrenzt (`max(1, page_size)`), nicht nach oben. Ein Client kann extrem große Werte setzen und so unnötig viele Daten laden (DoS-Vektor). Der Export nutzt intern eine absichtlich riesige Seitengröße – das ist für den Export in Ordnung, nicht aber für die reguläre Liste.

**Konkreter Fix:**  
`page_size = min(max(1, page_size), 100)` (oder einen anderen definierten Maximalwert) in `build_ticket_query` bzw. `list_tickets`.

---

#### 8. Weitere Härtungsempfehlungen
**Schweregrad:** niedrig  
**Betroffene Stellen:** `backend/routers/auth.py`, `frontend/src/api/client.ts`, `backend/main.py`

- **TLS/HTTPS:** Die Anwendung läuft standardmäßig über `http://localhost:8000`. Im Produktivbetrieb sollte TLS erzwungen und ggf. HSTS gesetzt werden.
- **JWT in localStorage:** Das Frontend speichert das JWT im `localStorage`. Das ist anfällig für XSS. Empfehlung: Token in einem `HttpOnly`-Cookie ablegen oder Lebensdauer minimieren.
- **Logout ohne Server-Invalidierung:** `POST /api/auth/logout` ist serverseitig eine No-Op. Ein gestohlenes JWT bleibt bis zum Ablauf gültig. Optional Token-Blacklist oder kurze Ablaufzeit.

---

**Fazit:**  
Die kritische JWT-Schwäche und die IDOR-Lücke im Kommentar-Endpunkt müssen vor Auslieferung behoben werden. Daher: `VERDICT: BLOCKED`.