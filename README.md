# Pet-Extension

A playful browser extension that drops a tiny kaomoji pet onto every page. It wanders along the bottom of the viewport, follows your cursor when nearby, hops when clicked, and falls asleep after a period of inactivity. Settings are exposed via the popup for size and basic behaviors.

## Features
- Kaomoji pet rendered as text (no sprite assets) with directional faces for movement.
- Follows cursor when close; otherwise wanders across the bottom of the page.
- Click to trigger a hop animation.
- Sleeps after idle timeout; wakes on interaction.
- User-adjustable size, wander speed, follow distance, and reactions (via popup).

## How it works
- Manifest v3 content script injects a fixed container with the pet element (`content.js` / `content.css`).
- Behavior state machine runs via `requestAnimationFrame` to choose targets and poses.
- Kaomoji faces are loaded from `EMOJIS.txt` (first line idle/sleep, second right-walk, third left-walk/hop).
- Settings are stored in `chrome.storage.sync` and applied live when changed from the popup.

## Development
1. Load the extension (Developer Mode) and select this folder.
2. Edit kaomojis in `EMOJIS.txt` (UTF-8), keeping one per line.
3. Adjust behavior defaults in `content.js` and popup controls in `popup.js`/`popup.html`.
4. Reload the extension to see changes.

## Files of interest
- `manifest.json` — extension entry.
- `content.js` / `content.css` — injects and animates the pet.
- `popup.html` / `popup.js` / `popup.css` — user settings UI.
- `EMOJIS.txt` — kaomoji faces (idle/right/left).
