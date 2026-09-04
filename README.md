# Enterprise Helpdesk

Unternehmensinterne Helpdesk-Web-Applikation mit Oberfläche, Backend und
Datenbank: Benutzer können sich registrieren und anmelden (gehashte Passwörter,
JWT-Sitzungs-Token), Tickets mit Titel, Beschreibung, Kategorie, Priorität und
Status verwalten, kommentieren und Agenten zuweisen. Agenten bearbeiten und
schließen Tickets, Administratoren verwalten Benutzer. Dazu kommen
prioritätsbasierte Fälligkeiten, Überfällig-Kennzeichnung, eine durchsuch- und
filterbare Listenansicht, ein Kennzahlen-Dashboard, ein Änderungsprotokoll je
Ticket und CSV-Export.

## Tech Stack

- **backend**: Python, FastAPI, SQLAlchemy, SQLite
- **auth**: JWT-Sitzungs-Token (PyJWT), Passwort-Hashing (passlib/bcrypt)
- **frontend**: React, Vite, TypeScript

## Installation

```bash
cd backend
python -m pip install -r requirements.txt
```

## Start (Development)

```bash
cd backend
python -m uvicorn main:app --reload
```

Die Anwendung startet unter `http://localhost:8000`, legt beim Start automatisch
die SQLite-Datenbank an (`helpdesk.db`) und ist sofort einsatzbereit — ohne
manuelle Migration oder externe Dienste.

## Umgebungsvariablen

| Variable                | Zweck                                        | Default                    |
| ----------------------- | -------------------------------------------- | -------------------------- |
| `DATABASE_URL`          | Verbindungs-URL der Datenbank                | `sqlite:///./helpdesk.db`  |
| `JWT_SECRET`            | Signierschlüssel für JWT-Tokens              | (wird pro Lauf generiert)  |
| `BACKEND_CORS_ORIGINS`  | Komma-getrennte erlaubte CORS-Origins        | `http://localhost:5173`    |

Ein generierter `JWT_SECRET` muss selbst gesetzt werden, z. B.:

```bash
$env:JWT_SECRET = (python -c "import secrets; print(secrets.token_hex(32))")
```

## REST-API

Basis-Pfad: `/api`. Fehler-Body ist immer `{"detail": ...}`; Validierungsfehler
liefern `{"detail": [{"loc", "msg", "type"}]}`.

| Methode | Pfad                                   | Beschreibung                         | Zugriff            |
| ------- | -------------------------------------- | ------------------------------------ | ------------------ |
| GET     | `/api/health`                          | Health-Check `{"status":"ok"}`       | offen              |
| POST    | `/api/auth/register`                   | Registrierung                        | offen              |
| POST    | `/api/auth/login`                      | Anmeldung (Token)                    | offen              |
| POST    | `/api/auth/logout`                     | Abmeldung                            | Token              |
| GET     | `/api/tickets`                         | Ticketliste (Suche/Filter/Page)      | Token              |
| POST    | `/api/tickets`                         | Ticket anlegen                       | requester          |
| GET     | `/api/tickets/{id}`                    | Ticket-Detail                        | Token              |
| PATCH   | `/api/tickets/{id}`                    | Ticket bearbeiten                    | agent              |
| POST    | `/api/tickets/{id}/assign`             | Agent zuweisen                       | agent              |
| POST    | `/api/tickets/{id}/close`              | Ticket schließen                     | agent              |
| POST    | `/api/tickets/{id}/comments`           | Kommentar anlegen                    | Token              |
| GET     | `/api/tickets/{id}/comments`           | Kommentarverlauf                     | Token              |
| GET     | `/api/users`                           | Benutzerliste                        | admin              |
| POST    | `/api/users`                           | Benutzer anlegen                     | admin              |
| PATCH   | `/api/users/{id}`                      | Rolle/Status ändern                  | admin              |
| DELETE  | `/api/users/{id}`                      | Benutzer löschen                     | admin              |
| DELETE  | `/api/users/me`                        | Eigenes Konto löschen                | Token              |
| GET     | `/api/dashboard`                       | Kennzahlen                           | Token              |
| GET     | `/api/tickets/export`                  | CSV-Export der gefilterten Liste     | Token              |

### Beispiel (Anmeldung)

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username_or_email": "max", "password": "geheim"}'
```

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": { "id": 1, "username": "max", "email": "max@example.com",
            "role": "requester", "is_active": true }
}
```

## Features

- Registrierung und Anmeldung mit gehashten Passwörtern und JWT-Sitzungs-Token
- Ticketverwaltung (Titel, Beschreibung, Kategorie, Priorität, Status)
- Prioritätsbasierte Fälligkeiten mit Überfällig-Kennzeichnung
- Kommentarverlauf und Änderungsprotokoll je Ticket
- Suche, Filter, Sortierung und Seitenblätterung
- Kennzahlen-Dashboard und CSV-Export
- Benutzerverwaltung für Administratoren
- Persistente SQLite-Datenbank (überlebt Neustarts)
