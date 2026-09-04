# Design — Project Identity

> This document is project-long-lived. Tokens are not changed without
> the Architect's approval. Developers MUST use these tokens
> instead of improvising their own colors/spacings.

## Style Direction

Minimalistisch helles, professionelles Enterprise-Interface mit kühlem Blau als Akzent, klaren Statusfarben und hoher Informationsdichte — ruhig und sachlich wie ein internes Business-Tool (Linear/Stripe-Referenz).

## Colors

- `--color-bg`: **#F7F8FA**
- `--color-surface`: **#FFFFFF**
- `--color-fg`: **#1A1D23**
- `--color-muted`: **#6B7280**
- `--color-border`: **#E3E6EA**
- `--color-accent`: **#2563EB**
- `--color-accent_hover`: **#1D4ED8**
- `--color-accent_soft`: **#EFF4FF**
- `--color-success`: **#16A34A**
- `--color-success_soft`: **#ECFDF3**
- `--color-warning`: **#D97706**
- `--color-warning_soft`: **#FFF7ED**
- `--color-danger`: **#DC2626**
- `--color-danger_soft`: **#FEF2F2**
- `--color-overlay`: **rgba(15, 23, 42, 0.5)**

## Typography

- `font_family`: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
- `heading_weight`: 600
- `body_weight`: 400
- `size_scale`: 13px Basis, 15px Fließtext, 18px H2, 24px H1, 12px Meta/Tabellen

## Spacing Scale

- `--space-0`: 4px
- `--space-1`: 8px
- `--space-2`: 12px
- `--space-3`: 16px
- `--space-4`: 24px
- `--space-5`: 32px
- `--space-6`: 48px

## Border-Radii

- `--radius-sm`: 4px
- `--radius-md`: 8px
- `--radius-lg`: 12px
- `--radius-pill`: 999px

## Components

### Button

Primär: bg=accent, Text #FFFFFF, padding 10px 16px, radius md, font-weight 500, min-height 44px, hover=accent_hover, active=#1E40AF + translateY(1px), disabled opacity 0.5, focus-visible outline 2px accent mit 2px Abstand. Sekundär: bg=surface, border 1px border, Text fg, hover bg=#F1F3F5. Ghost: transparent, Text accent, hover bg=accent_soft. Danger: bg=danger, hover #B91C1C.

### Input/Textarea/Select

bg=surface, border 1px border, radius md, padding 10px 12px, font-size 14px, min-height 44px; label 13px/500 fg darüber mit 6px Abstand; placeholder muted; focus border=accent + box-shadow 0 0 0 3px accent_soft; invalid border=danger + Hinweistext 12px danger unterhalb; disabled bg=#F3F4F6, Text muted.

### Card

bg=surface, border 1px border, radius lg, padding 16px (kompakt) bzw. 24px (Standard), box-shadow 0 1px 2px rgba(16,24,40,0.04); Kopfbereich mit Titel 15px/600 fg und optionaler Aktion rechts.

### Badge

Pill (radius pill), padding 2px 10px, font-size 12px/500, height 22px, mit vorangestelltem 6px-Punkt. Status: Offen=accent_soft/accent, In Bearbeitung=warning_soft/warning, Geschlossen=success_soft/success. Priorität: Niedrig=#F3F4F6/#6B7280, Mittel=warning_soft/warning, Hoch=danger_soft/danger. Überfällig: danger_soft/danger mit fettem Rand oder Label 'Überfällig'.

### Table

Volle Containerbreite, bg=surface, border 1px border, radius lg, overflow hidden; Kopfzeile 12px uppercase tracking muted bg=#FAFBFC sticky; Zeilen border-top 1px border, padding 12px 16px, hover bg=#F9FAFB; Aktionen rechts als Ghost-Buttons; leere Zeile mittig mit muted Text; Seitenblätterung unterhalb rechts mit Ghost-Buttons.

### TopNav

Höhe 56px, bg=surface, border-bottom 1px border, sticky top; links Logo/App-Name 15px/600 fg, mittig horizontale Links 14px muted, aktiver Link fg + 2px accent-Unterstreichung; rechts Benutzermenü mit Avatar-Initialen (bg=accent_soft, Text accent).

### Sidebar (optional Desktop)

Breite 240px, bg=surface, border-right 1px border, padding 16px 12px; Gruppen-Label 12px uppercase muted; Einträge 14px fg mit radius md und padding 10px 12px, hover bg=#F3F4F6, aktiv bg=accent_soft + Text accent + Icon accent.

### Modal

Overlay bg=overlay zentriert; Dialog bg=surface, radius lg, max-width 560px, padding 24px, shadow 0 20px 40px rgba(16,24,40,0.2); Titel 18px/600 fg, Schließen als Ghost-Icon-Button oben rechts; Fußbereich rechtsbündig mit Sekundär- und Primär-Button.

### Alert/Toast

Radius md, padding 12px 16px, border 1px + linke 3px-Akzentlinie, 14px Text. Info: accent_soft/accent; Erfolg: success_soft/success; Warnung: warning_soft/warning; Fehler: danger_soft/danger. Toast fixiert oben rechts, auto-dismiss nach 4s, mit Schließen-Icon.

### Dashboard-KPI-Kachel

Card mit Label 12px uppercase muted, Wert 28px/600 fg, optionalem Delta/Icon 14px success/danger; mindestens 3 Kacheln pro Zeile auf Desktop, 1 Spalte unter 768px.

## Layout Principles

- Container max-width 1280px, zentriert, horizontales Padding 24px (16px unter 768px).
- Breakpoints: mobil <768px (Navigation kollabiert zu Menü), Tablet 768–1023px, Desktop ≥1024px.
- TopNav fix/sticky (56px), darunter Content mit 24px Abstand; Seiten-Sidebar fix 240px links, Content flexibel rechts.
- Grid: 12 Spalten, Gutter 16px (Desktop 24px); Karten/KPI-Kacheln gleiche Höhe.
- Vertikaler Rhythmus: Sektionen mit 32px Abstand, innerhalb von Karten 16px, Formularfelder 16px untereinander.
- Formulare max-width 640px, einspaltig, primäre Aktion linksbündig oder rechtsbündig im Fußbereich; Pflichtfelder mit *.
- Tabellen und Listen volle Breite; Suche/Filter als Toolbar (Input + Selects + Export-Button) oberhalb mit 16px Abstand.
- Klare Rückmeldungen: Erfolg/Fehler als Toast oben rechts, Feldvalidierung inline, Leerzustände mit kurzem Hinweis und Aktion.
