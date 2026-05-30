# CTI Platform Lookup, Browser Extension (#28)

Right-click any selected text (IP, domain, hash, URL) on any page and choose
"Look up in CTI Platform" to check it against your platform's IOC database.
Also includes a toolbar popup for manual lookups.

## Install (load unpacked)

1. In the CTI Platform UI, go to **API Keys** and create a key (read scope is enough).
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Open the extension's **Options** and set:
   - **Base URL**: where the backend runs (e.g. `http://localhost:8000`, or your deployed API URL).
   - **API key**: the key from step 1.

## How it works

- Calls the public API `GET /api/v1/iocs/{value}` with header `X-API-Key`.
- A `200` shows the IOC's type, threat score, and malware family; a `404` means it is not a tracked indicator.
- No icon files are bundled, the browser uses a default action icon. Add `icon.png` and an `icons` block to `manifest.json` to customise.
