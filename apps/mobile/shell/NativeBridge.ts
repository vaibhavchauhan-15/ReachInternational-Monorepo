/**
 * ReachInternational Mobile — Native Bridge
 * Handles cross-boundary postMessage events between Web and Native Shell:
 * - External Link Redirection (System Browser)
 * - File Downloads & Native Share Sheet
 * - Hardware Native Print Interception
 * - Device Diagnostics & Shell Verification
 *
 * ZERO-SECRET INVARIANT: No authentication credentials, passwords, JWTs,
 * or API secret keys ever cross this bridge.
 */

import { Platform, Alert } from "react-native";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { SHELL_VERSION } from "./webview-config";

export interface BridgeMessage<T = any> {
  type: "OPEN_EXTERNAL_URL" | "DOWNLOAD_FILE" | "SHARE_FILE" | "PRINT" | "GET_DEVICE_INFO";
  payload: T;
}

/**
 * JavaScript snippet injected into the WebView at document start.
 * Exposes window.__REACH_NATIVE_BRIDGE__ and intercepts window.print().
 */
export const INJECTED_BRIDGE_JAVASCRIPT = `
(function() {
  if (window.__REACH_NATIVE_BRIDGE__) return;

  var bridge = {
    isNativeShell: true,
    platform: "${Platform.OS}",
    shellVersion: "${SHELL_VERSION}",
    postMessage: function(type, payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: type,
          payload: payload || {}
        }));
      }
    },
    openExternalUrl: function(url) {
      this.postMessage("OPEN_EXTERNAL_URL", { url: url });
    },
    downloadFile: function(options) {
      this.postMessage("DOWNLOAD_FILE", options);
    },
    shareFile: function(options) {
      this.postMessage("SHARE_FILE", options);
    },
    print: function(html) {
      this.postMessage("PRINT", { html: html || document.documentElement.outerHTML });
    }
  };

  window.__REACH_NATIVE_BRIDGE__ = bridge;

  // Polyfill native window.print() so web print buttons automatically invoke native print dialog
  window.print = function() {
    bridge.print(document.documentElement.outerHTML);
  };

  // Dispatch custom event notifying web application that native bridge is ready
  window.dispatchEvent(new CustomEvent("reachNativeBridgeReady", { detail: bridge }));
  true; // required for iOS injectedJavaScript
})();
`;

/**
 * Dispatches messages received from the WebView shell.
 */
export async function handleBridgeMessage(
  rawMessage: string,
  sendMessageToWeb?: (message: any) => void
): Promise<void> {
  try {
    const data: BridgeMessage = JSON.parse(rawMessage);
    if (!data || !data.type) return;

    switch (data.type) {
      case "OPEN_EXTERNAL_URL": {
        const { url } = data.payload || {};
        if (url && typeof url === "string") {
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            Alert.alert("Unable to open link", url);
          }
        }
        break;
      }

      case "DOWNLOAD_FILE": {
        const { url, dataUri, filename, mimeType } = data.payload || {};
        const safeName = filename || `download-${Date.now()}`;
        const targetPath = `${FileSystem.documentDirectory}${safeName}`;

        if (dataUri && typeof dataUri === "string") {
          // Handle data: URI (e.g. base64 Excel or CSV)
          const base64Index = dataUri.indexOf(";base64,");
          const base64Content = base64Index !== -1 ? dataUri.substring(base64Index + 8) : dataUri;
          await FileSystem.writeAsStringAsync(targetPath, base64Content, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } else if (url && typeof url === "string") {
          // Download from remote URL
          await FileSystem.downloadAsync(url, targetPath);
        } else {
          throw new Error("No download URL or dataUri provided.");
        }

        // Open native share sheet so user can save/export the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(targetPath, {
            mimeType: mimeType || undefined,
            dialogTitle: safeName,
          });
        } else {
          Alert.alert("File Saved", `File saved to ${targetPath}`);
        }
        break;
      }

      case "SHARE_FILE": {
        const { url, message, title } = data.payload || {};
        const canShare = await Sharing.isAvailableAsync();
        if (canShare && url) {
          await Sharing.shareAsync(url, { dialogTitle: title || message });
        }
        break;
      }

      case "PRINT": {
        const { html, url } = data.payload || {};
        if (html && typeof html === "string") {
          await Print.printAsync({ html });
        } else if (url && typeof url === "string") {
          await Print.printAsync({ uri: url });
        }
        break;
      }

      case "GET_DEVICE_INFO": {
        const { requestId } = data.payload || {};
        if (sendMessageToWeb && requestId) {
          sendMessageToWeb({
            type: "DEVICE_INFO_RESPONSE",
            requestId,
            payload: {
              platform: Platform.OS,
              version: Platform.Version,
              shellVersion: SHELL_VERSION,
              isNativeShell: true,
            },
          });
        }
        break;
      }

      default:
        console.warn(`[NativeBridge] Unhandled message type: ${data.type}`);
    }
  } catch (err: any) {
    console.error("[NativeBridge] Error handling bridge message:", err);
  }
}
