# Product Walkthrough: Research Equipment Management System (REMS)

> [!NOTE]
> **Audience:** This document is designed for stakeholders, laboratory managers, and non-technical personnel. It provides a plain-English, step-by-step journey of how end-users interact with the REMS platform.

---

## 1. Executive Summary

The Research Equipment Management System (REMS) is a mobile-first, cloud-based platform designed to eliminate equipment hoarding and streamline R&D laboratory workflows. It solves a simple but critical problem: *Who is using this machine, and when will they be done?*

Users can interact with the system through two primary entry points:
1. **The Physical World:** Scanning a QR code pasted directly on a laboratory machine.
2. **The Digital World:** Accessing the central REMS Home Dashboard from any web browser.

Regardless of how they enter the system, the user is always presented with real-time data, beautiful interfaces, and friction-free booking options.

---

## 2. User Journey A: The Physical Approach (QR Scanning)

This is the most common workflow for a researcher walking into a laboratory.

### Step 1: The Encounter
A researcher approaches a piece of equipment (e.g., an Oscilloscope). They notice a REMS QR Code sticker attached to the machine. They simply open their smartphone's native camera and scan the code.

### Step 2: Instant Context (The Landing Screen)
Scanning the code instantly opens the REMS Web App on their phone, specifically tailored to that exact machine. 
* They see the machine's name, category, and physical location.
* They see a large, clear **Status Badge** (e.g., `AVAILABLE` in green, or `USING` in red).
* They are prompted to "Identify Yourself" by entering their unique Employee ID (e.g., EMP-001) and clicking **Continue**.

> [!TIP]
> **Frictionless Login:** The system remembers the user's Employee ID after their first visit using local browser storage. On future visits, their ID is pre-filled automatically!

### Step 3: Context-Aware Actions
Depending on the machine's real-time status, the system intelligently adapts what the user can do:

* **Scenario A: The Machine is Available**
  * The user is greeted by name (e.g., "Welcome, Alice").
  * They see a clean interface to select how long they need the machine (1 hour, 2 hours, 4 hours, or 8 hours).
  * They click **Confirm Booking**. The machine immediately changes to `USING` across the entire global database.

* **Scenario B: The Machine is Currently In Use**
  * The user sees exactly *who* is using it (e.g., "Currently used by Bob").
  * They are offered the option to **Join Queue**. By doing this, they enter a digital waitlist. When Bob finishes, Alice will automatically be promoted to the active user.

---

## 4. User Journey B: The Digital Approach (Home Dashboard)

This workflow is for a researcher sitting at their desk planning their day, or a lab manager monitoring the entire facility.

### Step 1: The Global View
The user opens the REMS Home URL on their desktop or mobile browser. They are greeted by the **Home Dashboard**, featuring a sleek, dark-mode glassmorphism aesthetic.
* They see a complete catalog of every single piece of equipment in the facility.
* Each machine is displayed as a neat "Card" showing its real-time status (Available, In Use, or Maintenance).

### Step 2: Search and Discovery
Instead of walking around the lab looking for a specific tool, the user types into the central search bar (e.g., "Microscope").
* The grid instantly filters down to show only matching equipment.
* The user can immediately see if the microscope is available before they leave their desk.

### Step 3: The Built-in Scanner
If a user prefers not to use their phone's native camera, the Dashboard includes a **Floating QR Scanner Button** in the bottom right corner.
* Clicking this seamlessly activates their device's camera within the app itself.
* Pointing it at a machine's QR code achieves the exact same result as User Journey A.

### Step 4: Digital Navigation
Clicking any equipment card on the dashboard takes the user directly to that specific machine's Status Page (identical to Step 2 in the QR workflow). From there, they enter their Employee ID and can book or queue just as if they were standing in front of the machine.

---

## 5. Core User Capabilities (Once Logged In)

Once a user has identified themselves, they have incredible power to manage their time and resources:

### Active Session Management
If a user opens a machine they are currently using, they are presented with a **Manage Booking** screen instead of a booking screen. Here they can:
1. **Extend Time:** If their experiment runs long, they can select a duration (e.g., +30 mins) and click "Extend Booking." The system updates their end-time globally.
2. **Release Early:** If they finish early, they click "Free Equipment." This instantly completes their session, logs the historical data, and auto-notifies/promotes the next person in the waitlist.

### The Waitlist (Queue) System
If a user is waiting for a machine, the system provides total transparency.
* When they view the machine, they see an orange "Withdraw" screen showing their exact place in line (e.g., *Position #1*).
* If they no longer need the machine, they can click **Withdraw from Queue**, instantly clearing the way for others.

### The Personal Profile
At the top right of any equipment screen, the user will see a **Profile Icon**. Clicking this opens their personal dashboard.
* **Active Tab:** Shows a beautiful list of all machines they are currently using or waiting for, anywhere in the facility. Clicking a card takes them straight to that machine to manage it.
* **History Tab:** Provides an audit log of everything they have used in the past, including total durations.
* **Sign Out:** Securely clears the user's session and instantly redirects them back to the central Home Dashboard.

---

## 6. Behind the Scenes (For the Product Manager)

> [!IMPORTANT]
> While the interface feels like a modern native application, it is entirely powered by **Google Workspace**.

1. **The Database:** The entire backend is simply a Google Spreadsheet. Lab managers can edit equipment names, view the Audit Log, or run analytics using familiar spreadsheet formulas. No SQL knowledge is required.
2. **Real-Time Consistency:** When User A books a machine, User B's dashboard will reflect that change instantly upon reload.
3. **Automated Enforcement:** A background cron-job runs every minute. If an employee forgets to release a machine, the system detects that their booked time has expired, automatically marks their session as completed, and promotes the next person in the queue. 

**Result:** A fully autonomous, self-policing laboratory ecosystem with zero administrative overhead.

---

## 7. Management Walkthrough: The Database Architecture

For stakeholders and system administrators, the beauty of REMS lies in its transparent, highly accessible backend. The entire database is hosted on a single Google Spreadsheet, structured into specialized tabs (sheets). This allows management to leverage familiar spreadsheet skills to run analytics, generate reports, and oversee operations without needing complex SQL queries or database management software.

Here is a comprehensive breakdown of the database architecture:

### 1. Equipment_Master
*The single source of truth for all physical assets in the laboratory.*
- **Equipment_ID:** The unique identifier (e.g., EQ001) linked to the QR code.
- **Equipment_Name:** The human-readable name (e.g., Oscilloscope Pro).
- **Category:** The classification for sorting/filtering (e.g., Measurement, Fabrication).
- **Location:** The physical room or bench where the item resides.
- **Max_Duration_Minutes:** Administrator-defined limit for how long an item can be booked in a single session.
- **QR_URL:** The auto-generated link to the equipment's unique QR code image.
- **Status & Active:** Flags indicating if the machine is operational or temporarily decommissioned for maintenance.

### 2. Current_Status
*The real-time operational state of the facility. This sheet drives the live Dashboard.*
- **Equipment_ID:** Links to the Master list.
- **Status:** The live state (`Available`, `Using`, `Reserved`).
- **Current_User:** The name/ID of the person actively operating the machine.
- **Booking_ID:** The unique transaction ID for the current active session.
- **Start_Time & End_Time:** The exact operational window for the current user.
- **Next_User:** Indicates who is first in line if a waitlist exists.

### 3. Employee_Directory
*The central registry of authorized personnel allowed to use the equipment.*
- **Employee_ID:** The secure login credential (e.g., EMP-1234).
- **Employee_Name:** Used for friendly UI greetings and dashboard visibility.
- **Department:** Categorizes usage by team (e.g., Hardware, Chemistry).
- **Email:** Contact information for automated notifications (e.g., queue promotions).

### 4. Booking_History
*The immutable ledger of all transactions. Essential for compliance, cost-allocation, and utilization analytics.*
- **Booking_ID, Equipment_ID, Employee_ID:** Relational keys linking the transaction to the user and asset.
- **Employee_Name, Department, Email:** Denormalized user data for rapid reporting and filtering.
- **Booking_Date, Booking_Start_Time, Booking_End_Time:** The scheduled window of operation.
- **For_How_Long_he_wants(hour):** The requested duration metric.
- **Booking_Status:** The lifecycle state (`Active`, `Waiting`, `Completed`, `Withdrawn`).
- **Actual_Start & Actual_End:** Tracks the exact timestamp the user checked in and released the machine, allowing management to analyze estimated vs. actual usage.
- **Created_On & Last_Updated:** System timestamps for audit integrity.

### 5. Queue
*The digital waitlist manager that prevents physical crowding in the lab.*
- **Queue_ID, Equipment_ID, Booking_ID, Employee_ID:** Relational keys.
- **Employee_Name & Email:** Contact details for the person waiting.
- **Queue_Position:** An integer (1, 2, 3...) dictating the priority order. The system automatically recalculates this when someone withdraws or is promoted.
- **Added_On:** Timestamp determining priority on a first-come, first-served basis.

### 6. Audit_Log
*The security and diagnostic tracker.*
- **Timestamp:** The exact millisecond an event occurred.
- **User:** Who triggered the event (can be an Employee ID or "System" for cron jobs).
- **Action:** The classification of the event (e.g., `Queue Withdrawn`, `Equipment Extended`, `Backup Created`).
- **Equipment:** The asset affected by the action.
- **Details:** A verbose string explaining the action context (e.g., "Alice extended booking by 30 mins").

### 7. Settings
*A simple key-value store for global application configuration.*
- **Setting:** The name of the global variable (e.g., `MAX_EXTENSION_MINUTES`).
- **Value:** The configurable threshold, allowing non-technical managers to tweak system behavior without touching code.
