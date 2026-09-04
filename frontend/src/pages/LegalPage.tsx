export default function LegalPage() {
  return (
    <div className="page">
      <h1>Datenschutzerklärung</h1>

      <section>
        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlicher für die Verarbeitung personenbezogener Daten im
          Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
        </p>
        <p>
          <strong>Enterprise Helpdesk GmbH</strong>
          <br />
          Hafenstraße 25
          <br />
          10115 Berlin
          <br />
          Deutschland
        </p>
        <p>
          E-Mail für Datenschutzanfragen:{' '}
          <a href="mailto:datenschutz@enterprise-helpdesk.de">
            datenschutz@enterprise-helpdesk.de
          </a>
        </p>
      </section>

      <section>
        <h2>2. Verarbeitete Daten</h2>
        <p>
          Bei der Nutzung dieser Anwendung werden die folgenden
          personenbezogenen Daten verarbeitet:
        </p>
        <ul>
          <li>
            <strong>Kontodaten:</strong> Benutzername, E-Mail-Adresse und
            (gehasht gespeichertes) Passwort bei Registrierung und
            Anmeldung.
          </li>
          <li>
            <strong>Ticketdaten:</strong> Titel, Beschreibung, Kategorie,
            Priorität, Status und Fälligkeit der von Ihnen erstellten oder
            bearbeiteten Tickets.
          </li>
          <li>
            <strong>Kommentare:</strong> Inhalte, die Sie im Rahmen der
            Ticketbearbeitung verfassen.
          </li>
          <li>
            <strong>Änderungsprotokoll:</strong> Aufzeichnungen über
            Änderungen an Tickets, um die Nachvollziehbarkeit zu
            gewährleisten.
          </li>
          <li>
            <strong>Protokolldaten:</strong> Technische Logdateien, die beim
            Betrieb der Anwendung anfallen.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Zwecke und Rechtsgrundlagen</h2>
        <p>
          Die Verarbeitung erfolgt ausschließlich zum Betrieb des Helpdesk:
          zur Bereitstellung der Anmeldung, zur Bearbeitung und Verwaltung von
          Support-Anfragen sowie zur Erfüllung gesetzlicher
          Aufbewahrungspflichten. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b
          DSGVO (Vertragserfüllung) und, soweit erforderlich, Art. 6 Abs. 1
          lit. f DSGVO (berechtigtes Interesse an einem funktionsfähigen
          Ticketsystem). Soweit Beschäftigtendaten verarbeitet werden, stützt
          sich die Verarbeitung zusätzlich auf Art. 88 DSGVO in Verbindung mit
          § 26 BDSG.
        </p>
      </section>

      <section>
        <h2>4. Lokale Speicherung</h2>
        <p>
          Zur Aufrechterhaltung Ihrer Anmeldung speichert diese Anwendung ein
          Authentifizierungs-Token (JWT) im lokalen Speicher (localStorage)
          Ihres Browsers. Dieses Token enthält lediglich Ihre Benutzer-ID,
          Ihre Rolle und einen Ablaufzeitpunkt. Es wird nicht auf einem
          externen Server gespeichert und nach dem Abmelden wieder gelöscht.
        </p>
        <p>
          Die Lebensdauer eines Tokens beträgt standardmäßig 30 Minuten.
          Nach Ablauf wird das Token entfernt und Sie werden erneut zur
          Anmeldung aufgefordert.
        </p>
      </section>

      <section>
        <h2>5. Speicherdauer</h2>
        <p>
          Personenbezogene Daten werden nur so lange gespeichert, wie es für
          die genannten Zwecke erforderlich ist oder gesetzliche
          Aufbewahrungsfristen dies vorschreiben. Anschließend werden sie
          gelöscht. Im Einzelnen gelten folgende Speicherdauern:
        </p>
        <ul>
          <li>
            <strong>Protokolldaten (Logs):</strong> 30 Tage, danach
            automatische Löschung.
          </li>
          <li>
            <strong>Kontodaten:</strong> für die Dauer der Nutzung sowie
            gesetzlicher Aufbewahrungsfristen nach Beendigung.
          </li>
          <li>
            <strong>Ticketdaten und Kommentare:</strong> für die Dauer der
            Nutzung sowie gesetzlicher Aufbewahrungsfristen.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Ihre Rechte</h2>
        <p>Sie haben jederzeit das Recht auf:</p>
        <ul>
          <li>Auskunft über die zu Ihrer Person gespeicherten Daten,</li>
          <li>Berichtigung unrichtiger Daten,</li>
          <li>Löschung („Recht auf Vergessenwerden“),</li>
          <li>Einschränkung der Verarbeitung,</li>
          <li>Datenübertragbarkeit,</li>
          <li>Widerspruch gegen die Verarbeitung.</li>
        </ul>
        <p>
          Zur Ausübung Ihrer Rechte genügt eine formlose Mitteilung an{' '}
          <a href="mailto:datenschutz@enterprise-helpdesk.de">
            datenschutz@enterprise-helpdesk.de
          </a>{' '}
          oder über die im Impressum genannten Kontaktwege. Ihre eigenen
          Benutzerdaten können Sie außerdem direkt in der Anwendung über den
          integrierten Datenexport herunterladen.
        </p>
        <p>
          Darüber hinaus steht Ihnen ein Beschwerderecht bei der zuständigen
          Datenschutz-Aufsichtsbehörde zu.
        </p>
      </section>

      <section>
        <h2>7. Datensicherheit</h2>
        <p>
          Diese Anwendung setzt technische und organisatorische Maßnahmen ein,
          um Ihre Daten gegen Verlust, Missbrauch und unbefugten Zugriff zu
          schützen. Passwörter werden ausschließlich verschlüsselt
          gespeichert. Die Anwendung lädt keine Inhalte oder Ressourcen von
          Drittanbietern.
        </p>
      </section>
    </div>
  )
}
