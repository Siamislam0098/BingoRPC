# BingoRPC

BingoRPC bridges your web browser and Discord to display what you are watching on streaming sites directly on your Discord Rich Presence. 
It runs entirely locally on your machine using a lightweight executable and Discord's local IPC socket.

## 📥 Installation

### Step 1: Install the Browser Extension
1. Download `BingoRPC-Extension.zip` from the [Releases](../../releases) tab.
2. Extract the `.zip` file into a permanent folder on your computer.
3. Open your browser and navigate to the extensions page:
   - **Edge:** `edge://extensions/`
   - **Chrome:** `chrome://extensions/`
4. Toggle **Developer mode** ON.
5. Click **Load unpacked** and select the extracted extension folder.
6. **Copy the Extension ID** (a 32-character string of lowercase letters) from the extensions page.

### Step 2: Install the Native Host
1. Download `BingoRPC-Host-Windows.zip` from the [Releases](../../releases) tab and extract it into a permanent folder (e.g., `C:\BingoRPC-Host`).
2. Save the file.
3. Double-click `install-host.bat`. This registers the host with Windows so your browser can launch the executable in the background.

## 🚀 How to Use

1. Restart your browser completely to ensure the native messaging bridge connects.
2. Ensure the Discord desktop app is running.
3. Go to a streaming site you want to track.
4. Click the **BingoRPC** extension icon in your browser toolbar.
5. In the popup, click **Add this site** (and accept the browser permission prompt).
6. Play a video! Your Discord status will automatically update with the show name, episode, elapsed time, and thumbnail.

## ⚙️ Uninstallation
To completely remove the background host from your Windows registry, double-click `uninstall-host.bat`. You can then remove the extension from your browser and delete the folders.

---
*Note for developers: To compile from source, run `npm install` in the `native-host` directory and use Vercel `pkg` to build `host.js` into `host.exe`.*
