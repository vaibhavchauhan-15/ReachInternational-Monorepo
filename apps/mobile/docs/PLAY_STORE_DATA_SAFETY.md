# Google Play Console — Data Safety Questionnaire Guide

Use this authoritative reference when filling out the **Data Safety** section in Google Play Console for **Reach International** (`com.reachinternational.app`).

---

## 1. Overview Questions

| Question | Recommended Answer | Explanation |
|---|---|---|
| **Does your app collect or share any of the required user data types?** | **Yes** | The app collects operator account details, shift logs, hour meter readings, and device diagnostics. |
| **Is all of the user data collected by your app encrypted in transit?** | **Yes** | All network traffic between the mobile app, Supabase cloud APIs, and telemetry servers is encrypted via **TLS 1.3**. |
| **Do you provide a way for users to request that their data be deleted?** | **Yes** | Users can request account deletion in-app (`Settings → My Account → Request Account Deletion`) and via our public web portal (`https://www.reachinternational.co.in/account-deletion`). |
| **Do users have to create an account to use the app?** | **Yes** | Reach International is an enterprise fleet platform requiring authenticated login. |
| **Do you provide a link for users to request account deletion?** | **Yes** | Provide the URL: `https://www.reachinternational.co.in/account-deletion` |

---

## 2. Data Types Collected & Declared

### Category: Personal Info

#### 1. Name
- **Collected?** Yes
- **Shared?** No (Never shared with third parties or data brokers)
- **Processed Ephemerally?** No (Stored in database)
- **Required or Optional?** Required (for operator identity and shift custody)
- **Purpose**:
  - `App functionality` (Displays operator name on duty shifts, machine custody rosters, and pre-shift inspection reports)
  - `Account management` (Staff identification within the enterprise tenant)

#### 2. Email Address
- **Collected?** Yes
- **Shared?** No
- **Processed Ephemerally?** No
- **Required or Optional?** Required (primary login credential and notification channel)
- **Purpose**:
  - `App functionality` (Authentication, password resets, critical conflict alerts)
  - `Account management`

#### 3. Phone Number
- **Collected?** Yes
- **Shared?** No
- **Processed Ephemerally?** No
- **Required or Optional?** Required (for field engineer & operator operational contact)
- **Purpose**:
  - `App functionality` (Direct communication between yard dispatchers and field operators)

#### 4. Government / Statutory Identification (Aadhaar / Driving Licence)
- **Collected?** Yes
- **Shared?** No
- **Processed Ephemerally?** No
- **Required or Optional?** Optional / Required by enterprise employer (for heavy machinery operating clearance)
- **Purpose**:
  - `App functionality` (Verifying authorized operator driving licences for heavy aerial lifts and cranes)
  - `Fraud prevention, security, and compliance` (Preventing unauthorized machinery operation; Aadhaar stored with statutory masking `XXXX-XXXX-1234`)

---

### Category: App Activity

#### 1. App Interactions & Machine Telemetry
- **Collected?** Yes
- **Shared?** No
- **Processed Ephemerally?** No
- **Required or Optional?** Required
- **Purpose**:
  - `App functionality` (Recording machine Hour Meter Readings HMR, pre-shift safety checklists, shift handover, and breakdown ticket logs)
  - `Analytics / Fleet optimization` (Calculating machine wear, preventative maintenance intervals, and fuel/operating efficiency)

---

### Category: App Info and Performance

#### 1. Crash Logs & Diagnostics
- **Collected?** Yes
- **Shared?** No
- **Processed Ephemerally?** No
- **Required or Optional?** Optional / Automatic
- **Purpose**:
  - `Analytics`
  - `Developer communications` (Debugging offline sync issues and app crashes)

---

### Category: Device or Other IDs

#### 1. Device or Other Identifiers (Push Notification Token)
- **Collected?** Yes
- **Shared?** No
- **Processed Ephemerally?** No
- **Required or Optional?** Required if notifications are enabled
- **Purpose**:
  - `App functionality` (Delivering immediate push alerts for shift conflicts, machinery breakdowns, and schedule changes)

---

## 3. Data Not Collected (Answer "NO" to these categories)

- **Location**: NO (GPS location is not actively tracked or required)
- **Financial Info**: NO (No credit cards, bank accounts, or in-app purchases)
- **Health and Fitness**: NO
- **Messages / SMS**: NO (In-app operational alerts only)
- **Photos and Videos**: NO (No camera permission requested in production manifest)
- **Audio files**: NO (No microphone access)
- **Contacts**: NO (No contact address book access)
- **Web Browsing History**: NO
- **Calendar**: NO

---

## 4. Privacy Policy & Account Deletion URLs to Paste in Console

- **Privacy Policy URL**:
  `https://www.reachinternational.co.in/privacy`
- **Account Deletion URL**:
  `https://www.reachinternational.co.in/account-deletion`
- **Support Contact Email**:
  `info@reachinternational.co.in`
