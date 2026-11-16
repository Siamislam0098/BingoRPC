# Text for the Edge Add-ons listing

**Name:** BingoRPC

**Short description (under 132 characters):**
Show what you are watching on any site you choose as your Discord status, with episode and a live progress bar.

**Description:**
BingoRPC shows what you are watching as your Discord status: title, episode, episode name, a live progress bar and a paused state.

You choose the sites. Nothing is read until you click "Add this site" and approve the browser's permission prompt.

Needs the free BingoRPC Helper for Windows (download from the GitHub releases page of this project) and the Discord desktop app.

No account, no tracking. See the privacy policy.

**Privacy policy URL:** `https://github.com/Siamislam0098/BingoRPC/blob/main/PRIVACY.md`

**Category:** Productivity (or Social)

## Permission justifications (paste when asked)

- **nativeMessaging:** Sends the current video title, episode and playback time to the BingoRPC Helper app on the user's own computer, which sets the Discord status. Nothing else is sent anywhere.
- **optional host permissions (https://*/*):** Requested one site at a time, only after the user clicks "Add this site". Needed to read the video element and page title on the streaming sites the user picks. No site is accessed by default.
- **scripting:** Registers and injects the content script into the sites the user approved.
- **activeTab:** Lets the popup see which tab the user is on, to offer "Add this site".
- **storage:** Saves the user's on/off choices per site.

## Single-purpose statement
Show the user's current video playback as a Discord status.

## Remote code
None. All code is inside the package.
