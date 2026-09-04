VERDICT: CHANGES_REQUESTED

# Compliance-Bericht: Enterprise Helpdesk (Fullstack-Python-Web)

**Prüfumfang:** Vollständig gemergter Produktstand gemäß Sprint-Spezifikation und sichtbarem Quellcode. Geprüft wurden DSGVO, EU Cyber Resilience Act (CRA), EU AI Act, Pflichttexte/UI sowie Barrierefreiheit. Der Bericht nennt ausschließlich Befunde, die im Code oder den sichtbaren Dateien belegt sind.

---

## 1. DSGVO

### 1.1 Widerspruch zwischen Datenschutzerklärung und technischer Umsetzung bei der Log-Löschung  
**Severity: hoch**  
**Dateien:** `frontend/src/pages/LegalPage.tsx` (Abschnitt 5) und `backend/main.py`  
**Befund:** Die Datenschutzerklärung verspricht: „Protokolldaten (Logs): 30 Tage, danach automatische Löschung.“ Im Backend ist jedoch keine automatische Löschung, Rotation oder Retention-Implementierung vorhanden. `_configure_logging()` in `backend/main.py` leitet Logs lediglich an `StreamHandler` (stdout) weiter. Der Betreiber müsste die Aufbewahrungsfrist durch eine externe Infrastruktur (Container-Log-Rotation, Log-Management-System) erzwingen – eine solche Konfiguration ist aber nicht Teil des Produkts und wird auch nicht dokumentiert. Die Behauptung in der Datenschutzerklärung ist daher derzeit irreführend und rechtlich riskant.  
**Konkrete Abhilfe:**  
- In `backend/main.py` einen `TimedRotatingFileHandler` oder eine explizite Umgebungsvariable einführen, mit der die Aufbewahrungsdauer gesteuert wird (z. B. `LOG_RETENTION_DAYS=30`).  
- Alternativ die Datenschutzerklärung in `frontend/src/pages/LegalPage.tsx` präzisieren, z. B.: „Die Löschung der Protokolldaten erfolgt durch die vom Betreiber konfigurierte Log-Rotationslösung; standardmäßig werden 30 Tage vorgehalten. Die Anwendung selbst schreibt Logs ausschließlich auf stdout und überlässt die Löschung der Plattform.“  
- Wichtig: Die gewählte Maßnahme darf die Produktfunktion nicht beeinträchtigen – eine File-Rotation muss asynchron und ohne blockierende I/O-Optik erfolgen.

### 1.2 Betroffenenrechte: Datenexport und Konto-Löschung sind nicht über die Weboberfläche erreichbar  
**Severity: mittel**  
**Dateien:** `frontend/src/pages/LegalPage.tsx` (Abschnitt 6), `backend/routers/users.py`, fehlende UI-Seite unter `frontend/src/pages/`  
**Befund:** Die Datenschutzerklärung weist auf den „integrierten Datenexport“ hin und erweckt den Eindruck, der Nutzer könne seine Daten direkt in der Anwendung herunterladen. Tatsächlich existiert zwar der Endpunkt `GET /api/users/me/export`, aber im Frontend gibt es keine Seite oder Komponente, die diesen aufruft. Gleiches gilt für die Kontolöschung (`DELETE /api/users/me`). Die Rechte sind daher nicht niederschwellig ausübbar – insbesondere für nicht-technische Nutzer.  
**Konkrete Abhilfe:**  
- Neue Seite/Komponente „Mein Konto“ einführen (z. B. `frontend/src/pages/AccountPage.tsx`), die einen Button „Meine Daten exportieren“ (ruft `GET /api/users/me/export` auf und lädt die Antwort als Datei herunter) sowie einen Button „Konto löschen“ mit Bestätigungsdialog (`DELETE /api/users/me`) bereitstellt.  
- Alternativ die Datenschutzerklärung anpassen: „Ihre eigenen Benutzerdaten können Sie per formloser Anfrage an datenschutz@… anfordern; die Löschung des Kontos erfolgt ebenfalls auf Anfrage.“  
- Die API-Endpunkte sind bereits vorhanden und funktional – es muss nur die UI nachgerüstet werden.

### 1.3 Berichtigungsrecht: Kein Self-Service für die Änderung eigener Daten  
**Severity: mittel**  
**Dateien:** `backend/routers/users.py`, `frontend/src/` (fehlende Profilseite)  
**Befund:** Die Datenschutzerklärung nennt das Recht auf Berichtigung, jedoch kann ein Nutzer seine eigenen Stammdaten (z. B. E-Mail-Adresse, Passwort) nicht selbst ändern. Es gibt lediglich den Admin-Endpunkt `PATCH /api/users/{user_id}`. Eine eigenständige Wahrnehmung des Berichtigungsrechts ist ohne Administrator nicht möglich.  
**Konkrete Abhilfe:**  
- Endpoint `PATCH /api/users/me` implementieren, der nur die eigene E-Mail-Adresse (mit Validierung/Verifikation) und optional das Passwort (nach Bestätigung des alten Passworts) aktualisiert.  
- Oder in der Datenschutzerklärung klarstellen, dass Berichtigungen formlos per E-Mail an den Datenschutzbeauftragten zu richten sind. Die zweite Variante ist einfacher, aber weniger komfortabel.

### 1.4 User-Enumeration durch differenzierte Fehlermeldungen  
**Severity: niedrig**  
**Dateien:** `backend/routers/auth.py`  
**Befund:**  
- Registrierung: Bei doppeltem Benutzernamen oder doppelter E-Mail antwortet der Endpunkt mit `409` und `"Username or email already registered"`. Dies bestätigt die Existenz der jeweiligen E-Mail-Adresse/des Benutzernamens.  
- Login: Für deaktivierte Benutzer wird `403` und `"Account disabled"` zurückgegeben, während falsche Anmeldedaten `401` mit `"Invalid username or password"` ergeben. Dadurch ist erkennbar, dass ein Konto existiert und deaktiviert wurde.  
**Konkrete Abhilfe:**  
- Login für deaktivierte Benutzer: Statt `403` ebenfalls `401` mit `"Invalid username or password"` zurückgeben (die Unterscheidung ist für den Nutzer nicht erforderlich und verringert Enumeration).  
- Registrierung: Entweder generischere Fehlermeldung („Registrierung derzeit nicht möglich, bitte wenden Sie sich an den Administrator“) oder – falls Eindeutigkeitsprüfung unvermeidbar – die Information nur dann preisgeben, wenn die Anfrage von einer bereits authentifizierten Quelle stammt. In einem unternehmensinternen System ist das Risiko als niedrig einzustufen, sollte aber dokumentiert werden.

### 1.5 Rate-Limiting nur im Prozessspeicher, keine Persistenz  
**Severity: niedrig**  
**Datei:** `backend/routers/auth.py`  
**Befund:** Die Rate-Limiter (`_register_limiter`, `_login_limiter`) speichern Versuche in einem In-Memory-Dictionary. In einer produktiven Umgebung mit mehreren Backend-Prozessen oder Container-Instanzen greift diese Begrenzung nicht pro Client, sondern nur pro Prozess. Für eine einzelne Instanz (wie es die Default-Konfiguration suggeriert) ist sie ausreichend, verliert aber bei horizontaler Skalierung an Wirkung.  
**Konkrete Abhilfe:**  
- Persistente Rate-Limit-Backend (z. B. Redis) einführen oder – sofern das Produkt stets mit nur einem Prozess betrieben wird – dies in `README.md`/`COMPLIANCE.md` klarstellen.  
- Mindestens dokumentieren, dass der Schutz nur bei Single-Instance-Betrieb vollständig ist.

---

## 2. EU Cyber Resilience Act (CRA)

### 2.1 Kein standardisiertes SBOM (Software Bill of Materials)  
**Severity: hoch**  
**Dateien:** `backend/requirements.txt`, `frontend/package-lock.json`, fehlende `sbom.json`/`sbom.cdx.xml`  
**Befund:** Der CRA verlangt für Produkte mit digitalen Elementen die Bereitstellung eines SBOM, um Abhängigkeiten und Transparenz über die Lieferkette zu gewährleisten. Zwar sind `requirements.txt` und `package-lock.json` vorhanden, aber es fehlt eine standardisierte, maschinenlesbare SBOM (z. B. CycloneDX oder SPDX).  
**Konkrete Abhilfe:**  
- In die CI-Pipeline einen SBOM-Generator integrieren (z. B. `cyclonedx-bom` für Python und Nodes).  
- Die erzeugte SBOM-Datei (z. B. `sbom.cdx.json`) im Repository ablegen und bei Releases mitliefern.  
- Der Generator muss die installierten Versionen aus `package-lock.json` und `requirements.txt` exakt wiedergeben.

### 2.2 Kein sichtbarer Prozess für Schwachstellen-Scanning und Patch-Management  
**Severity: mittel**  
**Dateien:** `backend/requirements.txt`, `frontend/package.json`, `SECURITY.md` (Inhalt nicht vollständig einsehbar), CI-Konfiguration (nicht vollständig sichtbar)  
**Befund:** Es ist nicht erkennbar, ob Abhängigkeiten automatisiert auf bekannte Schwachstellen geprüft werden (z. B. `pip-audit`, `npm audit`, Dependabot) und wie Updates eingespielt werden. Für den CRA muss ein definierter Prozess existieren, der Sicherheitsupdates zeitnah ermöglicht.  
**Konkrete Abhilfe:**  
- In `SECURITY.md` einen Abschnitt „Umgang mit Schwachstellen“ und „Supportzeitraum“ ergänzen, in dem beschrieben wird, wie Sicherheitslücken gemeldet, bewertet und behoben werden.  
- In der CI einen automatischen Scan (z. B. `pip-audit`, `npm audit --audit-level=high`) einbauen und bei Funden den Build abbrechen.  
- In `COMPLIANCE.md` oder `README.md` festhalten, dass Sicherheitsupdates innerhalb einer definierten Frist eingespielt werden.

### 2.3 Dokumentation der Sicherheitseigenschaften nur unvollständig belegt  
**Severity: mittel**  
**Dateien:** `SECURITY.md`, `COMPLIANCE.md` (Inhalte nicht vollständig einsehbar)  
**Befund:** Es existieren `SECURITY.md` und `COMPLIANCE.md`, was grundsätzlich positiv ist. Da die Inhalte hier nicht vollständig sichtbar sind, kann nicht bestätigt werden, ob sie alle CRA-Pflichtangaben (z. B. sichere Standardkonfiguration, Update-Fähigkeit, bekannte Einschränkungen, Supportzeitraum) abdecken.  
**Konkrete Abhilfe:**  
- `SECURITY.md` und `COMPLIANCE.md` ergänzen um:  
  - Beschreibung der sicheren Standardkonfiguration (explizite CORS-Origins, Passwort-Hashing, JWT-Ablauf, Rate-Limiting).  
  - Angabe des geplanten Supportzeitraums und des Prozesses für Sicherheitsupdates.  
  - Kontaktadresse für die Meldung von Schwachstellen.  
- Die genannten Dokumente im Repository dauerhaft aktuell halten.

### 2.4 JWT-Sitzungen nicht widerrufbar  
**Severity: niedrig**  
**Dateien:** `backend/auth.py`, `backend/routers/auth.py`  
**Befund:** Das Logout (`POST /api/auth/logout`) entfernt den Token lediglich clientseitig. Ein einmal ausgestelltes JWT bleibt bis zum Ablauf der Gültigkeit (default 30 Minuten) verwendbar. In einer internen Anwendung mit kurzen Token-Laufzeiten ist das Risiko moderat, entspricht aber nicht dem Grundsatz „Security by default“, da ein gestohlenes Token nicht aktiv invalidiert werden kann.  
**Konkrete Abhilfe:**  
- Die standardmäßige Token-Laufzeit von 30 Minuten beibehalten oder sogar verkürzen.  
- Optional eine serverseitige Token-Revocation-Liste oder Refresh-Token-Architektur einführen, sofern dies unter Berücksichtigung der bestehenden Architektur sinnvoll ist.  
- Mindestens in `SECURITY.md` dokumentieren, dass ein Logout clientseitig ist und ein gestohlenes Token bis zu 30 Minuten gültig bleibt.

---

## 3. EU AI Act

**Kein Befund.** Im sichtbaren Produkt sind keine KI-Funktionen oder KI-Komponenten enthalten. Der EU AI Act ist daher nicht anwendbar. Es werden weder KI-gestützte Entscheidungen getroffen noch Modelle trainiert oder eingesetzt.

---

## 4. Pflichttexte & UI

### 4.1 Impressum verweist auf veraltetes Gesetz (§ 5 TMG)  
**Severity: mittel**  
**Datei:** `frontend/src/pages/ImprintPage.tsx`  
**Befund:** Die Überschrift lautet „Angaben gemäß § 5 TMG“. Das Telemediengesetz (TMG) wurde im Mai 2024 durch das Digitale-Dienste-Gesetz (DDG) abgelöst. Die Pflichtangabe muss sich auf § 5 DDG beziehen.  
**Konkrete Abhilfe:**  
- In `frontend/src/pages/ImprintPage.tsx` die Überschrift ändern zu: `Angaben gemäß § 5 DDG`.  
- Alle sonstigen Inhalte (Haftung, Kontakt) sind inhaltlich ausreichend und bedürfen keiner Änderung.

### 4.2 Datenschutzerklärung inkonsistent bei Log-Löschung und integriertem Datenexport  
**Severity: mittel**  
**Dateien:** `frontend/src/pages/LegalPage.tsx`  
**Befund:**  
- Die Datenschutzerklärung verspricht „automatische Löschung“ der Logs nach 30 Tagen (siehe DSGVO-Befund 1.1).  
- Sie erwähnt einen „integrierten Datenexport“, der jedoch im Frontend nicht auffindbar ist (siehe DSGVO-Befund 1.2).  
Beide Angaben sind derzeit nicht durch die Implementierung gedeckt und damit irreführend.  
**Konkrete Abhilfe:**  
- Entweder die technischen Funktionen nachrüsten (Log-Rotation, Self-Service-UI) oder den Text in `frontend/src/pages/LegalPage.tsx` anpassen, sodass er die Realität korrekt beschreibt.  
- Die Datenschutzerklärung muss nach jeder Änderung erneut geprüft werden.

### 4.3 Footer-Links und Impressum/Datenschutz grundsätzlich vorhanden  
**Severity: ohne Befund (positiv)**  
**Dateien:** `frontend/src/components/Layout.tsx`, `frontend/src/pages/ImprintPage.tsx`, `frontend/src/pages/LegalPage.tsx`  
**Erläuterung:** Die Fußzeile verlinkt auf jeder Seite zu „Datenschutz“ und „Impressum“. Die Seiten enthalten die erforderlichen Pflichtangaben (Verantwortlicher, Kontakt, Rechte, Rechtsgrundlagen). Ein Cookie-Consent-Banner ist nicht erforderlich, da keine Cookies oder Drittanbieter-Ressourcen eingesetzt werden. Dies erfüllt AC-18 und AC-19.

---

## 5. Barrierefreiheit (WCAG / BITV / EAA)

### 5.1 Tabellenüberschriften ohne explizite Spalten-Zuordnung (`scope`)  
**Severity: mittel**  
**Dateien:** `frontend/src/pages/AdminUsersPage.tsx`, `frontend/src/pages/TicketListPage.tsx`  
**Befund:** In den Tabellen werden `<th>`-Elemente verwendet, es fehlt jedoch durchgängig das `scope`-Attribut (z. B. `scope="col"` für Spaltenüberschriften). Screenreader können dadurch die Zuordnung von Kopfzeilen zu Datenzellen nicht immer korrekt interpretieren.  
**Konkrete Abhilfe:**  
- In beiden Dateien bei allen Spaltenüberschriften `<th scope="col">` ergänzen.  
- Falls zeilenweise Kopfzellen existieren, `<th scope="row">` verwenden.  
- Die Änderung ist rein deklarativ und beeinträchtigt die Funktionalität nicht.

### 5.2 Farbkontraste potenziell unter WCAG AA  
**Severity: mittel/niedrig**  
**Dateien:** `frontend/src/styles/global.css`, `frontend/src/pages/DashboardPage.css`, `frontend/src/pages/TicketListPage.module.css`, `frontend/src/pages/AdminUsersPage.module.css`  
**Befund:** Mehrere Farbkombinationen könnten den geforderten Kontrast von 4,5:1 für normalen Text bzw. 3:1 für große Texte unterschreiten. Beispiele:  
- `--color-warning` (#d97706) auf weißem/Hell-Hintergrund.  
- `--color-success` (#16a34a) auf weißem/Hell-Hintergrund.  
- Einige Badges verwenden farbigen Text auf farbigem Hintergrund (z. B. `priority-badge--low` mit `#f3f4f6` Hintergrund und `#6b7280` Text).  
Ohne automatisierte Prüfung (z. B. axe, Lighthouse) lässt sich die tatsächliche Kontrastverletzung nicht exakt beziffern, die Risiken sind jedoch offensichtlich.  
**Konkrete Abhilfe:**  
- Farbwerte in `frontend/src/styles/global.css` und den Komponenten-CSS-Dateien anpassen, sodass alle Texte und UI-Elemente den WCAG-AA-Kontrast erreichen.  
- Beispielsweise `--color-warning` auf einen dunkleren Ton (#9a5b00) und `--color-success` auf einen dunkleren Ton (#116b2d) ändern; für Badges kontrastreiche Textfarben verwenden.  
- Zusätzlich automatisierte Barrierefreiheitsprüfungen in die CI-Pipeline integrieren.

### 5.3 Positive Aspekte  
**Dateien:** `frontend/src/components/Layout.tsx`, `frontend/src/pages/LoginPage.tsx`, diverse Komponenten  
**Erläuterung:** Es sind bereits gute Grundlagen vorhanden:  
- Skip-Link zum Hauptinhalt (`Zum Inhalt springen`, `href="#main-content"`).  
- Semantische HTML-Elemente (`main`, `header`, `footer`, `nav`, `h1`/`h2`).  
- Formularfelder mit `label` und `htmlFor`-Verknüpfung sowie `aria-invalid` und `aria-describedby` für Fehlermeldungen.  
- Fehler- und Statusmeldungen mit `role="alert"` und `role="status"`.  
- Tastaturbedienung des Anmelde-/Registrierungs-Toggles mit Pfeiltasten und `aria-pressed`.  
- `lang="de"` im HTML-Tag.  
Diese Aspekte erfüllen bereits wichtige WCAG-Kriterien und sollten beibehalten werden.

---

## Zusammenfassung der erforderlichen Änderungen (Priorisierung)

| Priorität | Bereich | Maßnahme |
|-----------|---------|----------|
| **Hoch**   | DSGVO | Log-Retention implementieren oder Datenschutzerklärung anpassen, um Widerspruch aufzulösen |
| **Hoch**   | CRA    | SBOM erzeugen und bereitstellen |
| **Mittel** | DSGVO | Self-Service-UI für Datenexport und Kontolöschung ergänzen (oder Text korrigieren) |
| **Mittel** | DSGVO | Berichtigungsrecht praktisch ermöglichen (Self-Service oder dokumentierter Prozess) |
| **Mittel** | CRA    | Schwachstellen-Scanning und Patch-Prozess in CI/`SECURITY.md` verankern |
| **Mittel** | Pflichttexte | Impressum auf § 5 DDG aktualisieren |
| **Mittel** | Barrierefreiheit | `scope`-Attribute für Tabellen; Farbkontraste prüfen und anpassen |
| **Niedrig** | DSGVO/Sicherheit | User-Enumeration (Login deaktiviert) reduzieren; Rate-Limiting-Dokumentation |
| **Niedrig** | CRA/Sicherheit | Token-Widerrufbarkeit dokumentieren oder verbessern |

**Hinweis zur Vereinbarkeit:** Alle vorgeschlagenen Maßnahmen müssen so umgesetzt werden, dass die bestehenden Produktfunktionen (Ticketverwaltung, Dashboard, CSV-Export, Authentifizierung) nicht beeinträchtigt werden. Insbesondere die Einführung von Log-Rotation oder SBOM-Generierung darf die Laufzeitumgebung nicht blockieren; die UI-Ergänzungen müssen die vorhandenen API-Endpunkte korrekt nutzen.

---

**Gesamturteil:** Es bestehen keine fundamentalen, sofort blockierenden Rechtsverstöße (keine Klartext-Passwörter, keine unbefugte Datenverarbeitung, keine gesetzeswidrigen Praktiken). Die identifizierten Lücken sind behebbar und betreffen überwiegend die Konsistenz zwischen Datenschutzerklärung und Implementierung, die praktische Ausübung von Betroffenenrechten sowie CRA-Dokumentationspflichten. Daher: `CHANGES_REQUESTED`.