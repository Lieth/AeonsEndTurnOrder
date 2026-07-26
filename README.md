# DrawPhaser

Small single-page helper app for Aeon's End nemesis deck handling.

## What this app does

- Lets you choose 1-4 players from a dropdown above the draw/discard piles.
- Resets draw and discard piles when player count changes (new game setup).
- Builds turn-order deck with Nemesis 1 + Nemesis 2 plus player cards based on player count.
- Supports draw, peek, reveal, reveal two and reorder actions.
- Tracks discard pile with card preview and discard history modal.
- Allows returning all Nemesis cards from discard back to draw pile (then shuffles).
- Allows returning one Player card from discard back to draw pile (then shuffles).
- Tracks City and Nemesis health with quick +/- and reset.

Deck composition:
- 1 player: Player 1, Player 1, Player 1, Nemesis 1, Nemesis 2
- 2 players: Player 1, Player 1, Player 2, Player 2, Nemesis 1, Nemesis 2
- 3 players: Player 1, Player 2, Player 3, Player Wild, Nemesis 1, Nemesis 2
- 4 players: Player 1, Player 2, Player 3, Player 4, Nemesis 1, Nemesis 2

## How to start

### Option 1 (recommended, Windows scripts)

1. Start Docker Desktop.
2. Run `Start-DrawPhaser.bat` (double-click) or:
3. Run `./Start-DrawPhaser.ps1` in PowerShell.
4. The script starts Docker Compose and opens: http://127.0.0.1:8123/

### Option 2 (manual Docker Compose)

- Run: `docker compose up -d`
- Open: http://127.0.0.1:8123/

### Option 3 (direct file)

- Open `index.html` directly in a browser.

## File overview

- `index.html`: Entire app (UI, styles, and JavaScript logic).
- `resources/`: Card images used by the app (`Player 1-4`, `Player X` used for Player Wild, `Nemesis 1`, `Nemesis 2`, `Discard`).
- `Start-DrawPhaser.ps1`: Starts Docker Compose and opens browser URL.
- `Start-DrawPhaser.bat`: Convenience launcher that calls the PowerShell script.
- `docker-compose.yml`: Runs BusyBox httpd on port 8123 and mounts project as read-only `/site`.
- `Dockerfile`: Optional image-based static host setup (copies app into `/site`, exposes 8123).
- `Create-DrawPhaserIcon.ps1`: Builds `DrawPhaser.ico` from `resources/Nemesis 1.png`.
- `DrawPhaser.ico`: Generated app icon.

## Notes

- Default URL: http://127.0.0.1:8123/
- No build step or npm dependencies; this is a static HTML app.
