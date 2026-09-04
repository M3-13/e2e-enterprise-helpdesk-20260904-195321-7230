VERDICT: CHANGES_REQUESTED

# Compliance- und Marktreifeprüfung: Enterprise Helpdesk (fullstack-python-web)

Geprüft wurde ausschließlich der sichtbare, zusammengeführte Projektstand. Der Bericht ist nach Regelungsbereichen gegliedert. Für jeden Befund werden Schweregrad und konkrete Abhilfe genannt.

---

## 1. DSGVO / Datenschutz

### 1.1 Kritisch — JWT-Secret hat einen unsicheren Standardwert
**Fundstelle:** `backend/auth.py`, Funktion `_jwt_secret()`

```python
def _jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "")
```

Wird `JWT_SECRET` nicht gesetzt, signiert und validiert der Dienst mit einem **leeren Secret**. Damit kann jede Person gültige JWT erzeugen und sich als Administrator ausgeben. Das ist ein erheblicher Zugriffsschutzmangel auf personenbezogene Daten.

**Abhilfe:**
- In `backend/auth.py` einen sicheren Fehlerfall erzwingen, z. B.:
  ```python
  def _jwt_secret() -> str:
      secret = os.environ.get("JWT_SECRET", "")
      if not secret:
          raise RuntimeError("JWT_SECRET muss gesetzt sein (min. 32 Zeichen).")
      return secret
  ```
- Zusätzlich in `backend/main.py` in der `lifespan`-Funktion eine Startprüfung vor `create_all()` durchführen, damit der Dienst ohne Secret nicht hochfährt.
- In `README.md`/`DESIGN.md` dokumentieren, dass `JWT_SECRET` verpflichtend, zufällig und mindestens 32 Zeichen lang sein muss.

Hinweis zur Vereinbarkeit: Die bestehenden Tests setzen `JWT_SECRET` bereits über `os.environ`. Die Maßnahme bricht daher weder Tests noch lokale Entwicklung, sofern in der Laufzeitumgebung ein Secret gesetzt wird.

---

### 1.2 Hoch — Anwendungslogs können bei unbehandelten Fehlern personenbezogene Daten enthalten
**Fundstelle:** `backend/main.py`, `unhandled_exception_handler`

```python
logging.getLogger("app").exception("unhandled error on %s %s", request.method, request.url.path)
```

Der volle Stacktrace einer Exception kann Ticketinhalte, Benutzernamen oder E-Mail-Adressen enthalten. `RedactPIIFilter` filtert ausschließlich E-Mail-Adressen, nicht aber Benutzernamen und Ticketinhalte. Die Akzeptanzkriterien verlangen ausdrücklich, dass Logs keine E-Mail-Adressen, Benutzernamen oder Ticketinhalte enthalten.

**Abhilfe:**
- In `backend/main.py` den Exception-Log minimieren:
  ```python
  logging.getLogger("app").error(
      "unhandled error on %s %s: %s",
      request.method,
      request.url.path,
      type(exc).__name__,
  )
  ```
- Kein `logger.exception(...)` mit Stacktrace in Produktion verwenden.
- `RedactPIIFilter` kann beibehalten werden, ersetzt aber nicht die minimierte Log-Ausgabe.

---

### 1.3 Hoch — Datenschutzerklärung nennt unpassende Rechtsgrundlage für Beschäftigtendaten
**Fundstelle:** `frontend/src/pages/LegalPage.tsx`, Abschnitt 3

Dort werden ausschließlich Art. 6 Abs. 1 lit. b und lit. f DSGVO genannt. Für eine **unternehmensinterne** Helpdesk-Anwendung, mit der Beschäftigtendaten verarbeitet werden, ist regelmäßig **Art. 88 DSGVO in Verbindung mit § 26 BDSG** die vorrangige Rechtsgrundlage. Die aktuelle Formulierung ist daher rechtlich angreifbar.

**Abhilfe:**
- In `frontend/src/pages/LegalPage.tsx` den Abschnitt „Zwecke und Rechtsgrundlagen“ wie folgt ergänzen/umformulieren:
  ```text
  Rechtsgrundlagen sind Art. 88 DSGVO i. V. m. § 26 BDSG
  (Verarbeitung von Beschäftigtendaten) sowie, soweit einschlägig,
  Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und Art. 6 Abs. 1
  lit. f DSGVO (berechtigtes Interesse an einem funktionsfähigen
  Ticketsystem und an der IT-Sicherheit).
  ```

---

### 1.4 Mittel — Datenschutzerklärung ist unvollständig
**Fundstelle:** `frontend/src/pages/LegalPage.tsx`

Es fehlen unter anderem:
- konkrete Angaben zur Speicherung im Browser (`localStorage`: JWT-Sitzungstoken, Benutzerobjekt),
- die Gültigkeitsdauer des JWT,
- Angaben zur Speicherdauer von Logs,
- die vollständige Benennung oder zumindest Erreichbarkeit des Verantwortlichen (nur Verweis auf das Impressum),
- Hinweise auf mögliche Empfänger (z. B. IT-Administration) und auf das Bestehen einer Datenschutz-Folgenabschätzung, sofern erforderlich.

**Abhilfe:**
- `frontend/src/pages/LegalPage.tsx` um einen Abschnitt „Lokale Speicherung / Sitzungsdaten“ ergänzen.
- Im Abschnitt „Verarbeitete Daten“ die JWT-Speicherung im Browser sowie die Token-Lebensdauer benennen.
- Im Abschnitt „Speicherdauer“ konkrete Löschfristen oder Löschkonzepte angeben, z. B. „Logs werden nach 30 Tagen gelöscht“.
- Die formlose Kontaktaufnahme über das Impressum beibehalten und zusätzlich eine konkrete E-Mail-Adresse für Datenschutzanfragen aufnehmen.

---

### 1.5 Mittel — Datenminimierung: keine serverseitigen Längenbeschränkungen für Freitextfelder
**Fundstellen:** `backend/schemas.py`, `TicketCreate`, `TicketUpdate`, `CommentCreate`

Die Pydantic-Modelle definieren `title`, `description`, `category` und `body` als schlichte `str`-Felder ohne `max_length`. Nur die Datenbank begrenzt `title` auf 255 Zeichen. Dadurch können unverhältnismäßig große Datenmengen gespeichert und verarbeitet werden.

**Abhilfe:**
- In `backend/schemas.py` gezielte Längenbegrenzungen ergänzen, z. B.:
  ```python
  title: str = Field(max_length=255)
  description: str = Field(max_length=5000)
  category: str = Field(max_length=100)
  body: str = Field(max_length=5000)
  ```
- `username` und `email` in `UserCreate`/`RegisterRequest` ebenfalls mit `max_length=255` bzw. `max_length=255` versehen.
- Die Frontend-Seiten `TicketNewPage.tsx` und `LoginPage.tsx` sollten diese Limits optional zusätzlich clientseitig spiegeln; die serverseitige Prüfung ist maßgeblich.

---

### 1.6 Mittel — Betroffenenrechte: nur Löschung, kein Auskunfts-/Exportmechanismus
**Fundstelle:** `backend/routers/users.py`, `DELETE /api/users/me`; Datenschutzerklärung in `frontend/src/pages/LegalPage.tsx`

Die Datenschutzerklärung verspricht Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Technisch implementiert ist jedoch nur die Löschung des eigenen Kontos (`DELETE /api/users/me`). Ein exportierbarer Datenauszug (Art. 15, Art. 20 DSGVO) fehlt.

**Abhilfe:**
- Neuen Endpunkt `GET /api/users/me/export` in `backend/routers/users.py` ergänzen, der die eigenen Stammdaten, Tickets, Kommentare und zugehörigen Audit-Einträge als strukturierte JSON-/CSV-Antwort zurückgibt.
- In der Datenschutzerklärung den konkreten Weg zur Auskunft beschreiben, z. B. „Über die genannten Kontaktwege oder den integrierten Datenexport.“
- Diese Funktion ergänzt das Löschrecht und bricht keine bestehende Funktion.

---

### 1.7 Mittel — Rolleninkonsistenz im Dashboard
**Fundstelle:** `backend/routers/dashboard.py`

Das Dashboard liefert für **alle angemeldeten Benutzer** globale Kennzahlen (offene, überfällige, heute geschlossene Tickets) ohne Filter auf den jeweiligen Benutzer. Ein Melder sieht dadurch aggregierte Werte über fremde Tickets, obwohl er in der Ticketliste nur eigene Tickets einsehen darf.

**Abhilfe:**
- In `backend/routers/dashboard.py` für `role == "requester"` alle Zählabfragen auf `requester_id == current_user.id` einschränken.
- Alternativ das Dashboard für Melder ausblenden und auf die Rolle `agent`/`admin` beschränken.
- Die derzeitigen Tests in `frontend/src/pages/DashboardPage.test.tsx` bleiben funktionsfähig, da sie den API-Aufruf simulieren; die Backend-Tests in `backend/tests/test_dashboard.py` sind entsprechend um einen Requester-Fall zu ergänzen.

---

### 1.8 Mittel — Passwortrichtlinie für Admin-Benutzeranlage fehlt serverseitig
**Fundstelle:** `backend/routers/users.py`, `POST /api/users`

Die Selbstregistrierung erzwingt mindestens 8 Zeichen (`backend/routers/auth.py`). Die Admin-Benutzeranlage verwendet `password: str` ohne Mindestlänge. Dadurch können Admins sehr schwache Passwörter setzen, was der sicheren Standardkonfiguration widerspricht.

**Abhilfe:**
- In `backend/users.py` vor dem Anlegen prüfen:
  ```python
  if len(payload.password) < 8:
      raise HTTPException(status_code=422, detail="Passwort muss mindestens 8 Zeichen lang sein")
  ```
- Alternativ in `backend/schemas.py` das Feld `password` mit `min_length=8` versehen.
- In `frontend/src/pages/AdminUsersPage.tsx` die bestehende Client-Prüfung beibehalten und die serverseitige Meldung übernehmen.

---

### 1.9 Niedrig — Musterdaten im Impressum und in der Datenschutzerklärung
**Fundstelle:** `frontend/src/pages/ImprintPage.tsx`

Das Impressum enthält offensichtliche Platzhalter wie „Musterstraße 1“, „12345 Musterstadt“, „kontakt@helpdesk.example“. Ein Impressum mit Platzhaltern erfüllt die gesetzlichen Anforderungen an ein vollständiges und richtiges Anbieterkennzeichnungsimpressum nicht.

**Abhilfe:**
- In `frontend/src/pages/ImprintPage.tsx` echte Unternehmensdaten des Betreibers eintragen, einschließlich vertretungsberechtigter Personen, Kontakt-E-Mail und ggf. USt-IdNr., Handelsregisterangaben.
- Dasselbe gilt für den Verantwortlichen in `frontend/src/pages/LegalPage.tsx`.

---

## 2. EU Cyber Resilience Act (CRA)

### 2.1 Hoch — Keine sichtbare SBOM und keine dokumentierte Sicherheitsbeschreibung
**Fundstelle:** gesamtes Repo, insbesondere `backend/requirements.txt`, `frontend/package.json`, `README.md`, `DESIGN.md`

Für ein Produkt mit digitalen Elementen verlangt der CRA unter anderem:
- eine bekannte und nachvollziehbare Software-Stückliste (SBOM, z. B. CycloneDX/SPDX),
- dokumentierte Sicherheitseigenschaften („Security by design/default“),
- Angaben zur Behebung von Schwachstellen und zur Update-Fähigkeit.

Im sichtbaren Projektstand sind weder eine SBOM noch eine ausdrückliche Security-Dokumentation vorhanden. Die Abhängigkeitsdateien sind zwar vorhanden, aber ohne sichtbare SBOM-Generierung.

**Abhilfe:**
- CI-Schritt für SBOM ergänzen, z. B. `cyclonedx-bom` oder `syft` für Backend und Frontend.
- In `DESIGN.md` oder einer neu anzulegenden `SECURITY.md` dokumentieren:
  - Sicherheitsannahmen,
  - Update-/Patch-Prozess,
  - Umgang mit Schwachstellenmeldungen,
  - eingesetzte kryptografische Verfahren (bcrypt, HS256) und Gültigkeitsdauern.
- In `backend/requirements.txt` und `frontend/package.json` die Abhängigkeiten versioniert oder mit nachvollziehbaren Lock-Dateien versehen.

---

### 2.2 Hoch — Unsichere Standardwerte verletzen „Security by default“
**Fundstellen:** `backend/auth.py`, `backend/main.py`

Der leere `JWT_SECRET`-Standard (siehe DSGVO 1.1) ist zugleich ein CRA-Verstoß gegen sichere Standardkonfiguration. Zusätzlich sind die CORS-Methoden und -Header sehr weit geöffnet (`allow_methods=["*"]`, `allow_headers=["*"]`).

**Abhilfe:**
- `JWT_SECRET`-Startprüfung wie unter 1.1 beschrieben.
- In `backend/main.py` `allow_methods` und `allow_headers` auf die tatsächlich benötigten Werte einschränken:
  ```python
  allow_methods=["GET", "POST", "PATCH", "DELETE"],
  allow_headers=["Authorization", "Content-Type"],
  ```
- Sicherstellen, dass `BACKEND_CORS_ORIGINS` in Produktion nicht auf `*` gesetzt werden kann; dies ist bereits durch die aktuell gelesene Liste gewährleistet, sollte aber in Dokumentation und Deployment geprüft werden.

---

### 2.3 Mittel — CSV-Export ist potenziell formel-injizierbar
**Fundstelle:** `backend/routers/export.py`, `_ticket_row()`

Titel, Beschreibung, Kategorie usw. werden unverändert in CSV geschrieben. Wenn ein Feld mit `=`, `+`, `-` oder `@` beginnt, kann dies in Tabellenkalkulationen als Formel interpretiert werden. Das ist ein bekanntes Sicherheitsrisiko beim CSV-Export.

**Abhilfe:**
- In `backend/routers/export.py` eine Funktion `_sanitize_csv_cell(value: str) -> str` ergänzen, die alle Zellen, die mit `=`, `+`, `-` oder `@` beginnen, mit einem Apostroph (`'`) präfixen.
- Die `writer.writerow(...)`-Aufrufe auf diese Funktion umstellen.
- Die bestehenden Export-Tests in `backend/tests/test_export.py` um einen Fall mit `=1+1`-Titel ergänzen.

---

### 2.4 Mittel — JWT im localStorage erhöht das Schadenspotenzial bei XSS
**Fundstelle:** `frontend/src/context/AuthContext.tsx`, `frontend/src/api/client.ts`

Der JWT wird im `localStorage` gespeichert. Der Schutz gegen XSS ist im Frontend grundsätzlich vorhanden (React-Escaping, keine Drittressourcen), dennoch wäre ein durch XSS gestohlener Token bis zum Ablauf gültig. Für eine sicherere Standardkonfiguration sind HttpOnly-Cookies oder zumindest kurze Token-Lebensdauern zu bevorzugen.

**Abhilfe:**
- Übergang auf **HttpOnly-Cookies** für den Sitzungstoken in Betracht ziehen, sofern die API-Architektur dies zulässt.
- Alternativ die Token-Gültigkeit über `TOKEN_EXPIRE_MINUTES` kurz halten (z. B. 15–30 Minuten) und einen Refresh-Mechanismus vorsehen.
- `backend/auth.py` entsprechend erweitern, falls Cookies verwendet werden.
- Diese Änderung muss die bestehenden Logins und API-Aufrufe konsistent abbilden; ein reiner Wechsel ohne Anpassung von `api/client.ts` würde das Produkt brechen, daher nur als durchdachte Migration umsetzen.

---

## 3. EU AI Act

### 3.1 Kein Befund
Im sichtbaren Code ist **keine KI-Funktion** enthalten. Es gibt keine automatisierte Entscheidungsfindung, kein Training und keine generative Komponente. Eine KI-Risikoklasse ist daher nicht zu bewerten. Sollte später ein KI-Modul ergänzt werden, sind Risikoklasse, Transparenz- und Kennzeichnungspflichten erneut zu prüfen.

---

## 4. Pflichttexte und UI

### 4.1 Hoch — Impressum mit Platzhaltern
**Fundstelle:** `frontend/src/pages/ImprintPage.tsx`

Wie unter DSGVO 1.9 beschrieben, ist das Impressum ohne reale Betreiberangaben nicht marktreif. Dies betrifft auch die Angaben „Die Geschäftsführung“ und die Platzhalter-Kontaktdaten.

**Abhilfe:**
- `frontend/src/pages/ImprintPage.tsx` vollständig mit den echten Anbieterangaben befüllen.
- Zusätzlich prüfen, ob eine Angabe nach § 5 TMG/DDG und ggf. § 18 MStV erforderlich ist; die Überschrift kann an die aktuelle Rechtslage (DDG) angepasst werden.

---

### 4.2 Erfüllt — Fuß-Links Datenschutz und Impressum
**Fundstelle:** `frontend/src/components/Layout.tsx`

Die Fußzeile verlinkt `Datenschutz` und `Impressum` auf jeder Seite. Die Tests in `frontend/src/App.test.tsx` bestätigen dies. Dieser Teil der Akzeptanzkriterien ist erfüllt.

---

## 5. Barrierefreiheit / WCAG / BITV / EAA

### 5.1 Mittel — ARIA-Tabs für Anmelden/Registrieren unvollständig
**Fundstelle:** `frontend/src/pages/LoginPage.tsx`

Die Umschalter „Anmelden“ / „Registrieren“ verwenden `role="tablist"` und `role="tab"`, aber es fehlen:
- zugehörige `role="tabpanel"`,
- `aria-controls`,
- `aria-labelledby` für Panels,
- die erwartete Tastaturbedienung mit Pfeiltasten.

**Abhilfe:**
- Entweder die ARIA-Tabs vollständig implementieren (Tablist/Tab/Tabpanel mit `aria-controls`, `id` und Pfeiltasten-Navigation), oder
- die Umschalter als einfache Buttons mit `aria-pressed` realisieren, was für einen Wechsel zwischen zwei Formularen semantisch einfacher und robuster ist.
- Der sichtbare Text und die Funktion sollten unverändert bleiben.

---

### 5.2 Mittel — Feldbezogene Fehlermeldungen nicht konsistent verknüpft
**Fundstellen:** `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/TicketNewPage.tsx`, `frontend/src/pages/AdminUsersPage.tsx`

Die Formularfelder nutzen `aria-invalid`, aber die Fehlertexte sind nicht über `aria-describedby` mit dem jeweiligen Eingabefeld verbunden. Für Screenreader-Nutzende ist der Bezug zwischen Feld und Fehlermeldung nicht eindeutig.

**Abhilfe:**
- Jeder Fehlermeldung eine eindeutige `id` geben, z. B. `login-username-or-email-error`.
- Am Eingabefeld ergänzen:
  ```tsx
  aria-describedby={fieldErrorsMap.username_or_email ? 'login-username-or-email-error' : undefined}
  ```
- Gleiches Muster in `TicketNewPage.tsx` und `AdminUsersPage.tsx` umsetzen.

---

### 5.3 Mittel — Skip-Link fehlt
**Fundstelle:** `frontend/src/components/Layout.tsx`

Eine Tastaturmöglichkeit, um die Navigation zu überspringen und direkt zum Hauptinhalt zu gelangen, ist nicht vorhanden. Dies ist eine gängige WCAG-Erwartung.

**Abhilfe:**
- In `frontend/src/components/Layout.tsx` direkt nach `<body>` bzw. am Anfang des Layouts einen Skip-Link ergänzen:
  ```tsx
  <a href="#main-content" className="skip-link">Zum Inhalt springen</a>
  ```
- Dem `<main>`-Element `id="main-content"` geben.
- In `frontend/src/styles/global.css` die Skip-Link-Klasse visuell versteckt, aber per Tastatur erreichbar machen.

---

### 5.4 Niedrig — Farbkontraste einzelner Status-/Warnhinweise möglicherweise unzureichend
**Fundstellen:** `frontend/src/styles/global.css`, `frontend/src/pages/DashboardPage.css`

Warn-/Statusfarben wie `--color-warning: #d97706` auf `--color-warning_soft: #fff7ed` oder `--color-danger: #dc2626` auf `--color-danger_soft: #fef2f2` könnten bei kleinem Text unter 4,5:1 liegen. Dies ist ohne konkreten Farbtest nicht genau bezifferbar, aber auffällig.

**Abhilfe:**
- Kontrastprüfung nach WCAG AA für alle Text-/Hintergrundkombinationen durchführen.
- Ggf. dunklere Textfarben für Warn-/Fehlerhinweise festlegen, z. B. `#92400e` für Warnungen, `#991b1b` für Fehler.

---

## Fazit

Das Produkt erfüllt zentrale Akzeptanzkriterien:
- Passwort-Hashing mit bcrypt ist vorhanden.
- JWT-geschützte Endpunkte antworten mit 401/403.
- XSS-relevante Freitextausgaben werden durch React-Escaping entschärft.
- Rate-Limiting für Registrierung und Anmeldung existiert.
- CORS-Origin-Beschränkung ist implementiert.
- Löschung des eigenen Kontos ist vorhanden.
- Datenschutzerklärung und Impressum sind verlinkt.
- Keine Drittressourcen werden geladen.

Die offenen Punkte betreffen insbesondere:
- den unsicheren Standardwert für `JWT_SECRET`,
- die unzureichend gesicherte Protokollierung unbehandelter Fehler,
- ungenaue Rechtsgrundlagen und unvollständige Datenschutzerklärung,
- fehlende SBOM/Sicherheitsdokumentation nach CRA,
- ein Impressum mit Platzhaltern,
- einige Barrierefreiheitslücken.

Diese Punkte sind durch gezielte Änderungen in den genannten Dateien behebbar. Ein grundsätzlicher Stopp (BLOCKED) ist nicht erforderlich, weil keine personenbezogenen Daten ohne Rechtsgrundlage verarbeitet oder im Klartext gespeichert werden. Für eine Produktivbereitstellung sind die Critical-/High-Befunde vor dem Go-Live zu beheben.