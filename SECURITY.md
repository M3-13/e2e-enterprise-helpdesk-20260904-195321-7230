VERDICT: CHANGES_REQUESTED

## Sicherheitsprüfung – Gesamtprodukt

Die Scanner `bandit` und `semgrep` wurden nicht ausgeführt (`[skipped]`); für `pip-audit`/`npm audit` liegen keine Ergebnisse vor. Daraus leite ich keine Befunde ab, es bleibt aber eine Prüflücke für Abhängigkeits-Schwachstellen.

Die manuelle Analyse des sichtbaren Codes zeigt **keine kritischen oder hohen Schwachstellen**, aber mehrere Medium/Low-Härtungsbedarfe, insbesondere bei CORS, Rate-Limiting, CSV-Export-Formel-Injection, Security-Headern und Passwort-Längenbegrenzung.

---

### 1. Mittel – CORS erlaubt bei Fehlkonfiguration beliebige Origins mit Credentials

**Betroffene Stelle:** `backend/main.py`, Funktion `_cors_origins()`

**Problem:**  
Die CORS-Origins werden direkt aus `BACKEND_CORS_ORIGINS` übernommen. Enthält die Umgebungsvariable den Wert `*`, erlaubt `CORSMiddleware` mit `allow_credentials=True` jedem beliebigen Origin Zugriff mit Credentials, da Starlette bei `allow_origins=["*"]` und `allow_credentials=True` den tatsächlichen Request-Origin zurückspiegelt. Das unterläuft AC-16 und kann zu Token-/Datenabfluss führen.

**Empfehlung/Konkrete Lösung:**  
`_cors_origins()` so härten, dass `*` bei `allow_credentials=True` abgelehnt wird und nur explizite Origins akzeptiert werden:

```python
def _cors_origins() -> list[str]:
    raw = os.environ.get("BACKEND_CORS_ORIGINS", "http://localhost:5173")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    if "*" in origins:
        raise RuntimeError("BACKEND_CORS_ORIGINS darf bei allow_credentials=True kein '*' enthalten")
    return origins
```

Zusätzlich optional: Jeden Eintrag auf gültiges URL-Format mit Schema validieren.

---

### 2. Mittel – Rate-Limiting nur In-Memory und prozess-lokal; zählt auch erfolgreiche Logins

**Betroffene Stelle:** `backend/routers/auth.py`, `_RateLimiter`, `_client_ip()`, `register()`, `login()`

**Problem:**  
Der Rate-Limiter speichert Versuche in einem Python-Dictionary. In einer Produktionsumgebung mit mehreren Uvicorn/Gunicorn-Workers hat jeder Prozess einen eigenen Zähler. Dieselbe IP kann dadurch das Limit umgehen, wenn Anfragen auf unterschiedliche Worker verteilt werden. Außerdem wird jeder Login-Versuch gezählt, auch erfolgreiche, sodass eine legitime IP nach 5 erfolgreichen Anmeldungen innerhalb 60 Sekunden gesperrt wird.

**Empfehlung/Konkrete Lösung:**  
- Rate-Limiting in einen gemeinsamen Speicher verlagern (z. B. Redis) oder auf vorgelagertem Reverse-Proxy umsetzen.
- Alternativ mindestens den Zähler nur bei fehlgeschlagener Authentifizierung erhöhen, um Selbst-DoS zu vermeiden.
- `_client_ip()` dokumentieren: Direkte Peer-IP ohne `X-Forwarded-For` ist gewollt, aber bei Reverse-Proxy-Betrieb muss die Proxy-Konfiguration passen.

---

### 3. Mittel – CSV-Formel-Injection nur unvollständig neutralisiert

**Betroffene Stelle:** `backend/routers/export.py`, Funktion `_sanitize_csv_cell()`

**Problem:**  
Die Funktion prüft nur `value.startswith(("=", "+", "-", "@"))`. Übliche CSV-/Spreadsheet-Injection-Vektoren können auch über Tab, Zeilenumbruch oder führende Leerzeichen vor diesen Zeichen funktionieren. Da exportierte Ticketinhalte in Excel/LibreOffice geöffnet werden können, besteht Restrisiko für Formel-Injection.

**Empfehlung/Konkrete Lösung:**  
Sanitizing robuster gestalten:

```python
def _sanitize_csv_cell(value: str | None) -> str:
    if value is None:
        return ""
    stripped = value.lstrip("\t\r\n ")
    if stripped.startswith(("=", "+", "-", "@")):
        return "'" + value
    return value
```

Alternativ jede Zelle, die mit einem potenziell gefährlichen Zeichen beginnt, mit einem Apostroph prefixen (OWASP-Empfehlung).

---

### 4. Mittel – Fehlende Security-Header für die Weboberfläche

**Betroffene Stelle:** `backend/main.py`, `frontend/index.html`

**Problem:**  
Es werden keine Header wie `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options` oder `Referrer-Policy` gesetzt. Dadurch sind Clickjacking, MIME-Sniffing und im Fall einer doch eingeschleusten Skriptausführung größere Auswirkungen möglich. Da die Anwendung bewusst keine Drittressourcen lädt, ist eine strikte CSP umsetzbar.

**Empfehlung/Konkrete Lösung:**  
FastAPI-Middleware ergänzen und mit der tatsächlich benötigten Konfiguration abstimmen:

```python
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self' http://localhost:8000; "  # Produktions-Origin anpassen!
        "frame-ancestors 'none'"
    )
    return response
```

Wichtig: `connect-src` muss den konfigurierten API-Ursprung enthalten, damit der eigene Client funktioniert; `style-src 'unsafe-inline'` wird wegen der dynamischen Inline-Breiten im Dashboard benötigt.

---

### 5. Niedrig – Passwörter können länger als 72 Byte sein und werden von bcrypt möglicherweise abgeschnitten

**Betroffene Stellen:**  
- `backend/schemas.py`, `RegisterRequest`, `UserCreate`  
- `backend/routers/auth.py`, `backend/routers/users.py`

**Problem:**  
bcrypt verarbeitet nur die ersten 72 Byte eines Passworts. Die Pydantic-Schemata erzwingen nur `min_length=8`, aber keine Obergrenze. Sehr lange Passwörter können daher stillschweigend gekürzt werden, was die Wirksamkeit des Passwort-Hashs beeinträchtigt.

**Empfehlung/Konkrete Lösung:**  
In beiden Schema-Klassen `max_length=72` für `password` ergänzen:

```python
password: str = Field(min_length=8, max_length=72)
```

Alternativ ein vorgeschaltetes Hash-Verfahren verwenden, das lange Passwörter unterstützt. Wegen AC-12 (Präfix `$2b$`) ist die Längenbegrenzung die konformere Variante.

---

### 6. Niedrig – Hardcodierte Test-Secrets im Repository

**Betroffene Stellen:**  
- `backend/tests/test_auth.py`  
- `backend/tests/test_comments.py`  
- `backend/tests/test_export.py`  
- `backend/tests/test_tickets.py`  
- `backend/tests/test_users.py`

**Problem:**  
In den Testdateien sind feste JWT-Test-Secrets hinterlegt. Sie werden zwar nur in Tests verwendet, könnten aber von Secret-Scannern als Repository-Fund gemeldet werden und erschweren die Abgrenzung zu echten Secrets.

**Empfehlung/Konkrete Lösung:**  
Test-Secrets aus einer zentralen Test-Fixture lesen oder zur Laufzeit generieren, z. B. mit `secrets.token_hex(32)`, und nicht hart im Code belassen.

---

### Scanner-Lücke

`bandit` und `semgrep` liefen nicht; Abhängigkeits-Scans (`pip-audit`/`npm audit`) liegen nicht vor. Die Abhängigkeiten selbst sind in den sichtbaren Dateien nicht versioniert aufgeführt. Vor einem Release sollte ein vollständiger Dependency-Scan durchgeführt werden.

---

**Gesamteindruck:** Der Code erfüllt die zentralen Sicherheits-Anforderungen (JWT-Auth, Rollenprüfung, Passwort-Hashing mit bcrypt, Request-Validierung, HTML-Escaping in React, CORS-Grundkonfiguration, PII-Logfilter). Die genannten Punkte sind Härtungsbedarfe bzw. Medium-Risiken, die vor einem Produktivgang behoben werden sollten. Daher: `CHANGES_REQUESTED`.