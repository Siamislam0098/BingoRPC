# BingoRPC

Shows what you are watching on streaming sites as your Discord status:

- Line 1: `Anime name · Episode 12`
- Line 2: `Episode name` (`Paused · Episode name` when paused)
- Live progress bar, poster image, and the site domain on hover

You pick the sites yourself. Nothing is read from a site until you add it.
Works on Edge and Chrome, on Windows.

## Install (2 parts)

BingoRPC has two parts. The extension reads the video. The **Helper** is a small
Windows app that talks to Discord (a browser extension is not allowed to do that itself).
You need both.

1. **Install the Helper**
   - Go to the [Releases page](../../releases/latest) and download **BingoRPC-Helper-Setup.exe**.
   - Run it. Windows may show "Windows protected your PC" because the file is not signed yet:
     click **More info**, then **Run anyway**.
   - No Node.js, npm or admin rights needed.
2. **Install the Extension**
   - Edge: install **BingoRPC** from Edge Add-ons (link will be added here).
   - Not on the store yet? Download `BingoRPC-extension-sideload.zip` from Releases, unzip it,
     open `edge://extensions`, turn on **Developer mode**, click **Load unpacked**, choose the folder.
3. **Close your browser completely and open it again.**
4. Keep the **Discord desktop app** open (the website version does not work).

Open the extension icon. **Helper app** and **Discord** should both say *Connected*.

## Adding sites

No site is built in.

1. Open a streaming site and click the BingoRPC icon.
2. Click **Add this site** and approve the browser's permission prompt.
3. Play a video. If **Video found** says No, many sites load the player from another domain:
   look under **Player domains found on this page** and click **Allow** next to the one marked "likely player".
4. You can also type a site in the **Add a site** box (`crunchyroll.com`, or paste any link from it).
5. The **Sites** list shows everything you added. The checkbox turns a site on or off. **Remove** takes the permission back.

## Troubleshooting

| Problem | Fix |
|---|---|
| Helper app: *Not installed / not running* | Install the Helper (step 1), then fully restart the browser. |
| Discord: *Not connected* | Open the Discord **desktop** app. It reconnects within about 10 seconds. |
| Video found: *No* | Allow the player domain (see above), press play, wait a few seconds. |
| No poster | Some sites block outside image use. A default image is shown instead. |
| Shows a countdown instead of a bar | Reinstall the latest Helper from Releases. |
| Wrong episode name | Titles have no standard format. Open an issue with the site name and the popup's **Copy debug info**. |

The Helper writes a log to `%LOCALAPPDATA%\BingoRPC\host.log`.

## Good to know

- Discord shows one activity at a time. If several tabs play, the one playing and updated most recently is shown.
- Only `https://` sites work.
- Ads inside a player can make the time jump.
- Windows only for now.
- Privacy: see [PRIVACY.md](PRIVACY.md). Nothing leaves your computer except the Discord status you see.

## Uninstall

Remove the extension in your browser, then uninstall **BingoRPC Helper** in Windows Settings > Apps.

---

## For the developer

- `extension/` Manifest V3 extension
- `native-host/` the helper (Node.js; built into one `.exe` for releases)
- `installer/` Inno Setup script for the Windows installer
- `tests/` `node tests/lib.test.js` and `node tests/image-check.test.js`
- [docs/PUBLISHING.md](docs/PUBLISHING.md) how to make a release and publish to Edge Add-ons
- [docs/STORE-LISTING.md](docs/STORE-LISTING.md) text for the store page

Run from source (Windows): `cd native-host`, `npm install`, put your Discord Application ID in
`config.json` (set `"activityType": 3`), run `install-host.bat`, restart the browser,
load `extension/` with Load unpacked.

## Licence

Not chosen yet. Pick one before you publish (MIT is the simple choice) and add a `LICENSE` file.
