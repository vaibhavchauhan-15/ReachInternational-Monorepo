# Mobile WebView Shell Architecture & Parity Specification

## 1. Overview & Objective

ReachInternational Mobile (`apps/mobile`) is transitioning from a parallel, duplicated React Native business UI to a high-performance, secure, native **WebView Shell** powered by `react-native-webview` and Expo SDK 57. 

By wrapping the authoritative Next.js 16.2 web application (`apps/web`), the mobile application achieves:
1. **100% Instant Parity**: Every existing and future web feature, page, modal, workflow, and bugfix is immediately accessible on mobile without separate re-implementation.
2. **Zero Maintenance Drift**: Eliminates the maintenance burden of keeping ~30 duplicate mobile modals and screens in sync with web forms and server actions.
3. **Enterprise Security**: Web authentication uses Supabase SSR HttpOnly cookies. The native WebView preserves cookies in its persistent native cookie jar across app restarts. Zero session tokens, JWTs, or service-role keys are exposed across the native bridge.
4. **Native Experience**: Native splash screen, NetInfo-backed offline interception, hardware back button navigation, keyboard resize management, camera/file upload dialogs, and native file download/print handling.

---

## 2. Route Parity Matrix

The Next.js Edge Auth Proxy (`apps/web/proxy.ts`) defines the authoritative status of all routes.

| Web Route | Status (per `proxy.ts`) | Mobile Action | Parity Status |
| :--- | :--- | :--- | :--- |
| `/login`, `/signup`, `/forgot-password` | Public active | Replaced by WebView | ✅ 100% Parity |
| `/onboarding` | Protected active | Replaced by WebView | ✅ 100% Parity |
| `/machines` | Protected active (Default Home) | Replaced by WebView (touch cards on ≤640px) | ✅ 100% Parity |
| `/machines/[id]`, `/machines/[id]/edit` | Protected active | Replaced by WebView | ✅ 100% Parity |
| `/users` | Protected active | Replaced by WebView (paginated touch cards) | ✅ 100% Parity |
| `/operations` | Protected active | Replaced by WebView (logs & roster) | ✅ 100% Parity |
| `/clients`, `/clients/[id]` | Protected active | Replaced by WebView | ✅ 100% Parity |
| `/audit`, `/audit/[id]` | Protected active | Replaced by WebView (domain tabs & diffs) | ✅ 100% Parity |
| Deprecated Routes (`/dashboard`, `/crm`, `/inventory`, `/finance`, `/hr`, `/tasks`, `/documents`, `/challans`, `/purchase-orders`, `/rentals`, `/reports`, `/vendors`, `/administration`, `/branches`, `/complaints`, `/services`, `/notifications`, `/audit-logs`, `/my-work`) | Guarded by `proxy.ts` (redirects to `/machines`) | Replaced by WebView | ✅ Clean redirection |
| *Future Web Routes* | Auto-deployed | Automatically accessible immediately | ✅ Zero mobile work required |

---

## 3. Architecture & Security Boundaries

### 3.1 Authentication & Session Persistence
- **No Token Bridge**: The native shell does **not** manage authentication tokens. When the user logs in via `/login`, Supabase SSR sets HttpOnly session cookies.
- **Persistent Cookie Jar**: `react-native-webview` is configured with `sharedCookiesEnabled={true}`, `thirdPartyCookiesEnabled={true}`, and `domStorageEnabled={true}`. Android and iOS native cookie stores persist these cookies across application restarts.
- **CSP & Iframe Protection**: Next.js HTTP response headers enforce `X-Frame-Options: DENY` and `frame-ancestors 'none'`. Because `react-native-webview` acts as a top-level browser navigation window rather than an `<iframe>`, web security policies remain completely intact without modifications.

### 3.2 Native Bridge Protocol (`NativeBridge.ts`)
Communication between Web and Mobile occurs strictly via asynchronous `window.ReactNativeWebView.postMessage(JSON.stringify(payload))` and `onMessage`.

| Action | Payload | Native Handling |
| :--- | :--- | :--- |
| `OPEN_EXTERNAL_URL` | `{ url: string }` | Validates scheme (`http`, `https`, `tel`, `mailto`, `whatsapp`); opens in system browser via `expo-linking`. |
| `DOWNLOAD_FILE` | `{ url?: string, dataUri?: string, filename: string, mimeType?: string }` | Saves file locally via `expo-file-system` and displays system share/save sheet via `expo-sharing`. |
| `SHARE_FILE` | `{ url?: string, message?: string, title?: string }` | Triggers native system share dialog via `expo-sharing`. |
| `PRINT` | `{ html?: string, url?: string }` | Invokes native system print manager via `expo-print` (`printAsync`). |
| `GET_DEVICE_INFO` | `{ requestId: string }` | Responds with platform (`ios` / `android`), OS version, and shell version. |

**Security Invariant**: No authentication credentials, passwords, database connections, or API secret keys are ever transmitted over the bridge.

---

## 4. Hardware & Platform Handlers

### 4.1 Android Hardware Back Button
- Navigation state is monitored via `onNavigationStateChange`.
- When the hardware back button is pressed:
  - If `canGoBack` is `true`, calls `webViewRef.current.goBack()`.
  - If `canGoBack` is `false`, falls back to default Android back behavior (backgrounds or closes app).

### 4.2 Network Interception & Offline State
- `@react-native-community/netinfo` continuously monitors network connectivity.
- If connectivity drops, `OfflineScreen` renders immediately with a "Retry Connection" CTA.
- When network connectivity is restored, the WebView automatically reloads the active URL.

### 4.3 Keyboard Resizing
- Configured in `app.json`: `android.softwareKeyboardLayoutMode: "resize"`.
- When soft keyboard opens on Android, the WebView viewport contracts, preserving cursor focus inside input fields without occlusion.

---

## 5. Transition Gate (`EXPO_PUBLIC_SHELL_MODE`)

To maintain non-destructive migration safety, the mobile entry point inspects `EXPO_PUBLIC_SHELL_MODE`:
- `webview` (default): Boots the native `AppWebView` shell.
- `legacy`: Preserves previous React Native screen routing for regression verification.

---

## 6. Parity Verification Checklist (§27)

- [ ] **Public Auth Flow**: `/login`, `/signup`, `/forgot-password` render seamlessly at 360px, 390px, 412px.
- [ ] **Cookie Session Persistence**: User signs in, force-quits the app, relaunches; user remains logged in without re-authenticating.
- [ ] **Role-Based Routing**: Admin, Service Manager, and Operator roles are directed to appropriate home views (`/machines` / `/operations`).
- [ ] **Responsive Touch Cards**: `/machines`, `/users`, `/operations` render touch card views (`block sm:hidden`) on mobile widths with zero horizontal page scroll.
- [ ] **Modals & Drawers**: Creation and detail sheets adapt to mobile screens as bottom sheets (`max-h-[85vh]`).
- [ ] **Touch Targets**: All buttons, inputs, selects, and pagination controls satisfy minimum 44px touch targets.
- [ ] **Android Back Navigation**: Navigating deep into records and pressing hardware back moves backward through web history.
- [ ] **Network Loss & Recovery**: Switching to airplane mode reveals `OfflineScreen`; reconnecting reloads the page.
- [ ] **File Operations**:
  - Export to Excel/CSV triggers native download/share dialog.
  - Print triggers native print preview dialog.
  - Image upload prompts for camera or photo library permissions.
