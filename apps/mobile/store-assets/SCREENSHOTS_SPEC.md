# Google Play Store Screenshots Specification

## Technical Specifications
- **Minimum Screenshots**: 2 (Google Play requirement)
- **Recommended Screenshots**: 5 to 7
- **Format**: PNG or JPEG (24-bit color, no alpha transparency)
- **Aspect Ratio**: 9:16 (Portrait) or 16:9 (Landscape). Portrait is strongly recommended for mobile phones.
- **Recommended Dimensions**: 
  - Phone: `1080 × 1920 px` or `1080 × 2400 px` (standard modern Android FHD+)
  - 7-inch Tablet (Optional): `1200 × 1920 px`
  - 10-inch Tablet (Optional): `1600 × 2560 px`

---

## 5 Recommended Phone Screenshots (1080 × 2400 px)

### Screenshot 1: Machinery Directory (`/machines`)
- **Headline / Banner Text**: "Enterprise Fleet Machinery Directory"
- **Sub-caption**: "Track heavy equipment, models, serial numbers & operational statuses in real time."
- **Screen Focus**: The Machines screen showing active scissor lifts and boom lifts with operational status badges (`OPERATIONAL`, `MAINTENANCE`), HMR readings, and the capsule filter toolbar.

### Screenshot 2: Daily Meter Logging & Operations (`/operations`)
- **Headline / Banner Text**: "Daily Hour Meter (HMR) Logging"
- **Sub-caption**: "Record opening and closing meter readings with digital shift handover."
- **Screen Focus**: The Operations screen showing the Daily Running Hours tab, daily meter logs, shift start/end timestamps, and operator assignments.

### Screenshot 3: Real-Time Shift Conflict Prevention (`/operations`)
- **Headline / Banner Text**: "Intelligent Shift Conflict Alerting"
- **Sub-caption**: "Prevent operator fatigue and dual-machine custody collisions automatically."
- **Screen Focus**: The Operations screen showing the high-density Overtime Shift Conflict Alert card with operator details, shift times, and conflicting equipment tags.

### Screenshot 4: Workforce & KYC Credentials (`/users`)
- **Headline / Banner Text**: "Operator Credentials & Compliance"
- **Sub-caption**: "Verify statutory operating licences and manage field operator assignments."
- **Screen Focus**: The Users screen showing operator cards, role badges (`OPERATOR`, `SUPERVISOR`), masked Aadhaar KYC badges, and licence validity indicators.

### Screenshot 5: Operator Profile & Shift Settings (`/settings` & `/profile`)
- **Headline / Banner Text**: "Seamless Field Shift Telemetry"
- **Sub-caption**: "Manage shift schedules, base yard custody, offline sync, and theme preferences."
- **Screen Focus**: The Settings or Profile screen displaying Inset Grouped Cards for Shift Schedule, Base Yard, Contact Details, and App Permissions telemetry.

---

## Capturing Screenshots via ADB or Android Studio

```bash
# Capture screenshot from connected Android device or emulator
adb exec-out screencap -p > apps/mobile/store-assets/screenshots/screenshot-1-machines.png
adb exec-out screencap -p > apps/mobile/store-assets/screenshots/screenshot-2-operations.png
adb exec-out screencap -p > apps/mobile/store-assets/screenshots/screenshot-3-conflicts.png
adb exec-out screencap -p > apps/mobile/store-assets/screenshots/screenshot-4-users.png
adb exec-out screencap -p > apps/mobile/store-assets/screenshots/screenshot-5-settings.png
```
