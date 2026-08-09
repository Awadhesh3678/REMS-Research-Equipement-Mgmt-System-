# REMS Codebase Documentation

This document serves as the master architectural map for the Research Equipment Management System (REMS). It lists all 18 files in the Google Apps Script workspace and explains their specific role and functionality.

---

## 1. Backend Services (Google Apps Script - `.gs`)

The backend is built in modular layers. The frontend communicates exclusively with `Code.gs`, which delegates tasks to the specific Service files. The Service files then use `Repository.gs` to read/write from the Google Sheets database.

### Core Architecture
- **`Config.gs`**
  - **Functionality**: The central configuration file. It holds the `CONFIG` object, which defines the names of all Google Sheets (e.g., `Equipment_Master`, `Booking_History`) and stores the global Web App URL. If a sheet name ever changes, it only needs to be updated here.
- **`Code.gs`**
  - **Functionality**: The main entry point for the Web App. It contains the `doGet(e)` function which handles URL routing (deciding whether to show the Home, Profile, or Status pages based on URL parameters). It also contains the public `api...` functions that the frontend calls via `google.script.run`.
- **`Repository.gs`**
  - **Functionality**: The Data Access Layer. This file abstracts away all direct interaction with `SpreadsheetApp`. It provides standard CRUD (Create, Read, Update, Delete) methods like `getObjects()`, `findByField()`, `appendRow()`, and `updateRow()`. It converts raw spreadsheet rows into readable Javascript objects and vice-versa.

### Business Logic Services
- **`HomeDashboardService.gs`**
  - **Functionality**: Provides the data required by the Home Dashboard (`home.html`). It reads the `Equipment_Master` sheet and joins it with the `Current_Status` sheet to return a comprehensive list of all equipment and their real-time availability.
- **`EquipmentService.gs`**
  - **Functionality**: The core engine for handling equipment transactions on the individual status page (`status.html`). It contains the logic for booking equipment, extending a session, releasing equipment, and joining/processing the Waitlist Queue.
- **`ProfileService.gs`**
  - **Functionality**: Provides the data required by the User Profile page (`profile.html`). It queries the `Booking_History` sheet to assemble a complete list of a specific user's currently active bookings and past usage history.

### Automated Triggers & Utilities
- **`Automation.gs`**
  - **Functionality**: Contains cron-job functions designed to be triggered automatically by Google's time-driven triggers (e.g., every minute). Its primary job is to check for expired bookings, mark them as completed, and auto-promote the next person in the waitlist queue.
- **`BackupService.gs`**
  - **Functionality**: Contains logic to create daily/nightly backups of the Google Spreadsheet database, storing them in Google Drive to prevent accidental data loss.
- **`QRGenerator.gs`**
  - **Functionality**: Contains logic for generating physical QR codes for new equipment and optionally emailing them to administrators for printing.
- **`Setup.gs`**
  - **Functionality**: A one-time utility script used to bootstrap the system. If run on a blank spreadsheet, it will automatically create all the necessary sheets (`Equipment_Master`, `Booking_History`, etc.) and format the header rows correctly.

---

## 2. Frontend Application (HTML / CSS / JS)

The frontend is built using standard HTML/CSS/JS, served via Google Apps Script's `HtmlService`. The UI logic is highly modularized, keeping layout (HTML), styling (CSS), and logic (JS) in separate files that are stitched together by the server.

### The Home Dashboard (Catalog)
- **`home.html`**
  - **Functionality**: The structural HTML layout for the main equipment catalog. It includes the top header, the search bar, the hidden QR scanner modal, and the empty grid where equipment cards are injected.
- **`home_css.html`**
  - **Functionality**: The specific CSS styling rules for the Home Dashboard, providing the dark-mode glassmorphism aesthetic for the equipment cards and search bar.
- **`home_javascript.html`**
  - **Functionality**: The client-side logic for the Home Dashboard. It requests the catalog data from `Code.gs`, dynamically builds the HTML for the equipment cards, handles search filtering, and runs the HTML5-QRCode camera scanner.

### The Equipment Status Dashboard (Booking Flow)
- **`status.html`**
  - **Functionality**: The structural HTML layout for a specific piece of equipment. It is built as a Single Page Application (SPA) containing multiple "screens" (Landing, Manage, Book, Withdraw) that are hidden/revealed based on the user's state.
- **`css.html`**
  - **Functionality**: The extensive CSS styling rules for `status.html`, including animations, buttons, overlays, and the dynamic layout for booking operations.
- **`javascript.html`**
  - **Functionality**: The highly complex client-side logic for managing an equipment session. It handles the initial load of equipment data, checks the user's Employee ID via `localStorage`, and handles the UI state transitions for Booking, Extending, Releasing, and Withdrawing from the Queue.

### The User Profile Page
- **`profile.html`**
  - **Functionality**: The structural HTML layout for the User Profile screen. It contains the login overlay, the user's identity badge, and the tabbed layout for Active Bookings and History.
- **`profile_javascript.html`**
  - **Functionality**: The client-side logic for the User Profile page. It manages `localStorage` for authentication, handles the Sign Out redirection to the Home Dashboard, fetches the user's booking history, and dynamically renders the Active and History lists based on the selected tab.

---

## 3. Database Schema (Google Sheets)

The entire backend database is hosted on a Google Spreadsheet. This provides a zero-cost, highly accessible database that management can interact with directly.

### `Equipment_Master`
- **Functionality**: Acts as the central registry for all laboratory assets.
- **Key Columns**: `Equipment_ID` (Primary Key), `Equipment_Name`, `Category`, `Location`, `Max_Duration_Minutes`, `QR_URL`, `Status`, `Active`.

### `Current_Status`
- **Functionality**: A live-updating view of the current state of the facility. This sheet powers the Home Dashboard and allows the system to instantly know if a machine is available without parsing history logs.
- **Key Columns**: `Equipment_ID` (Foreign Key), `Status`, `Current_User`, `Booking_ID`, `Start_Time`, `End_Time`, `Next_User`.

### `Employee_Directory`
- **Functionality**: The authorized user registry. Used to validate logins and retrieve user metadata.
- **Key Columns**: `Employee_ID` (Primary Key), `Employee_Name`, `Department`, `Email`.

### `Booking_History`
- **Functionality**: The immutable ledger of all transactions. Used for analytics, usage tracking, and generating the User Profile history tab.
- **Key Columns**: `Booking_ID` (Primary Key), `Equipment_ID`, `Employee_ID`, `Employee_Name`, `Booking_Date`, `Booking_Start_Time`, `Booking_End_Time`, `Booking_Status`, `Actual_Start`, `Actual_End`.

### `Queue`
- **Functionality**: Manages the digital waitlist for equipment that is currently in use. When the active user finishes, the system reads this sheet to determine who to promote based on `Queue_Position`.
- **Key Columns**: `Queue_ID` (Primary Key), `Equipment_ID`, `Booking_ID`, `Employee_ID`, `Queue_Position`, `Added_On`.

### `Audit_Log`
- **Functionality**: Tracks all system events (bookings, extensions, withdrawals, automated cron-job executions) for security and debugging.
- **Key Columns**: `Timestamp`, `User`, `Action`, `Equipment`, `Details`.

### `Settings`
- **Functionality**: A key-value store for global configuration variables (e.g., maximum extension times).
- **Key Columns**: `Setting` (Key), `Value`.
