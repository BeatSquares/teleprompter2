# BTSQ Teleprompter

Web-App fürs Handy: Skript Satz für Satz vom Prompter ablesen, mit der Frontkamera aufnehmen und das Video direkt in den BeatSquares-Drive hochladen. Gebaut für die Reel Machine (Weg 2: Artikel > Skript > Aufnahme > Reel).

- Läuft im Browser (Safari auf dem iPhone, Chrome auf Android), keine Installation.
- Wer aufnimmt, braucht kein Google-Konto. Der Upload läuft über ein Apps Script, das als BeatSquares-Konto in einen festen Drive-Ordner schreibt.
- Jede Aufnahme bleibt bis zum Löschen auf dem Gerät (IndexedDB). Bricht der Upload ab, geht nichts verloren.
- Zu jedem Video kommt eine JSON-Datei mit Skript und Satz-Zeiten (`cues`), die die Pipeline zum Abgleich nutzt.

## Einladungslink

Alles, was die aufnehmende Person braucht, steckt im Link:

```
https://beatsquares.github.io/teleprompter2/#s=<Skript>&k=<Upload-Schlüssel>&e=<Upload-Adresse>
```

- `s`: base64url von `{"t": "Projekt", "l": ["Satz 1", "Satz 2", …]}`
- `k`: Upload-Schlüssel (steht nur im Link, nie im Code)
- `e`: base64url der Apps-Script-Adresse. Entfällt, sobald `CONFIG.endpoint` in `index.html` gesetzt ist.

In der App erzeugt »Link mit Skript« diesen Link aus dem aktuellen Skript.

## Upload einrichten (einmalig)

1. [script.google.com](https://script.google.com) > Neues Projekt > Inhalt von `apps-script/Code.gs` einfügen.
2. `FOLDER_ID` und `UPLOAD_KEY` eintragen, speichern.
3. Bereitstellen > Neue Bereitstellung > Web-App. Ausführen als: **Ich**. Zugriff: **Jeder**.
4. Zugriff erlauben (Drive und externe Anfragen).
5. Die `/exec`-Adresse in `index.html` bei `CONFIG.endpoint` eintragen oder als `e` in den Link.

## Was in Drive landet

```
<projekt>_<JJJJMMTT-HHMM>_take<n>.mp4    (iPhone: H.264/AAC, Android/Chrome: mp4 oder webm)
<projekt>_<JJJJMMTT-HHMM>_take<n>.json   Skript, Satz-Zeiten, Gerät
```

`cues` ist eine Liste `{"line": <Satz-Index>, "t": <Sekunden seit Aufnahmestart>}`. Ein Satz kann mehrmals vorkommen, wenn jemand zurückgeschaltet und ihn neu gesprochen hat.
