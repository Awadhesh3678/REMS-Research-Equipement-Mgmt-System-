/**
 * FILE: Code.gs
 * FUNCTIONALITY: REMS application ke liye main entry point aur public API handlers.
 * Ye file URL parameter routing (doGet) handle karti hai aur HTML pages (Home, Status, Profile) render karti hai.
 * Frontend se google.script.run ke zariye call hone wale functions ko expose karti hai.
 */

/**
 * HTTP GET requests ko handle karta hai aur correct HTML page serve karta hai parameters ke base par.
 * @param {Object} e - URL parameters object
 * @returns {HtmlOutput} Evaluated HTML content
 */
function doGet(e) {
  // Sanitize URL parameters at the server boundary
  const safeParam = function(val) {
    if (!val) return '';
    return String(val).trim().replace(/[^a-zA-Z0-9\-_]/g, '');
  };

  // Check karo agar page parameter 'profile' hai
  if (safeParam(e.parameter.page) === 'profile') {
    const template = HtmlService.createTemplateFromFile('profile');
    template.webAppUrl = CONFIG.WEB_APP_URL;
    template.fromId = safeParam(e.parameter.from);
    return template.evaluate()
                   .setTitle('REMS - Profile')
                   .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
                   .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Agar URL parameter me equipment_id nahi hai, toh Home Dashboard page load karo
  if (!e.parameter.equipment_id) {
    const template = HtmlService.createTemplateFromFile('home');
    template.webAppUrl = CONFIG.WEB_APP_URL;
    return template.evaluate()
                   .setTitle('REMS - Home')
                   .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
                   .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  // Agar specific equipment ID URL parameter me present hai, toh status check page serve karo
  const template = HtmlService.createTemplateFromFile('status');
  template.equipmentId = safeParam(e.parameter.equipment_id);
  template.webAppUrl = CONFIG.WEB_APP_URL;
  return template.evaluate()
                 .setTitle('REMS - Equipment Status')
                 .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
                 .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Reusable HTML template elements/scripts inline link include karne ke liye helper function.
 * @param {string} filename - HTML file name without .html extension
 * @returns {string} Raw content of HTML file
 */
function include(filename) {
  // Specified HTML template file ki content raw string format me return karega
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- Public APIs callable from Frontend (google.script.run) ---

/**
 * Sanitizes user-supplied ID strings — strips everything except alphanumerics, hyphens, and underscores.
 * Defense-in-depth: even if the frontend is bypassed, IDs cannot contain special/injection characters.
 * @param {string} id - The raw ID string from the client.
 * @returns {string} A clean, safe identifier string.
 */
function sanitizeId(id) {
  if (!id) return '';
  return String(id).trim().replace(/[^a-zA-Z0-9\-_]/g, '');
}

/**
 * Validates that a duration value is a positive finite number within a sane upper bound.
 * @param {number} minutes - The raw duration value from the client.
 * @returns {number} The validated duration, or throws on invalid input.
 */
function sanitizeDuration(minutes) {
  const n = parseInt(minutes, 10);
  if (isNaN(n) || n <= 0 || n > 14400) { // Max 10 days = 14400 min
    throw new Error('Invalid duration. Please provide a value between 1 and 14400 minutes.');
  }
  return n;
}

/**
 * Specific equipment ka real-time status fetch karta hai.
 * @param {string} equipmentId - Equipment ID
 * @returns {Object} Equipment state data ya error representation
 */
function apiGetEquipmentStatus(equipmentId) {
  try {
    return EquipmentService.getEquipmentDetails(sanitizeId(equipmentId));
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * User/Employee details aur unki booking status information load karta hai.
 * @param {string} employeeId - Employee ID
 * @returns {Object} Profile data object ya error
 */
function apiGetUserProfile(employeeId) {
  try {
    return ProfileService.getUserProfile(sanitizeId(employeeId));
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * Home dashboard map setup ke liye sabhi devices ka current state fetch karta hai.
 * @returns {Array<Object>} Sabhi active equipment statuses ki list
 */
function apiGetAllEquipmentStatus() {
  return HomeDashboardService.apiGetAllEquipmentStatus();
}

/**
 * Equipment booking register process karta hai.
 * @param {Object} data - Booking form submit payload (equipmentId, employeeId, durationMin)
 * @returns {Object} Action confirm details or error validation
 */
function apiBookEquipment(data) {
  try {
    data.equipmentId = sanitizeId(data.equipmentId);
    data.employeeId  = sanitizeId(data.employeeId);
    data.durationMin = sanitizeDuration(data.durationMin);
    return EquipmentService.bookEquipment(data);
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * Busy equipment ki waiting queue/waitlist me employee register karta hai.
 * @param {Object} data - Target device aur employee details containing map
 * @returns {Object} Confirmation list dynamic state status or error
 */
function apiJoinQueue(data) {
  try {
    data.equipmentId = sanitizeId(data.equipmentId);
    data.employeeId  = sanitizeId(data.employeeId);
    if (data.durationMin) data.durationMin = sanitizeDuration(data.durationMin);
    return EquipmentService.joinQueue(data);
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * Active book slots end/release check-out transaction run karta hai.
 * @param {Object} data - Equipment release dynamic keys inputs
 * @returns {Object} Action reports confirmation or error
 */
function apiReleaseEquipment(data) {
  try {
    data.equipmentId = sanitizeId(data.equipmentId);
    data.employeeId  = sanitizeId(data.employeeId);
    return EquipmentService.releaseEquipment(data);
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * Ongoing active booking hours/minutes extend karne ka request check updates.
 * @param {Object} data - Target duration time frame add parameters
 * @returns {Object} Action update parameters feedback or error
 */
function apiExtendBooking(data) {
  try {
    data.equipmentId = sanitizeId(data.equipmentId);
    data.employeeId  = sanitizeId(data.employeeId);
    data.durationMin = sanitizeDuration(data.durationMin);
    return EquipmentService.extendEquipment(data);
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * Employee validation directory aur system checks run karta hai checking target device.
 * @param {string} equipmentId - Target equipment
 * @param {string} employeeId - Scanner identity employee key
 * @returns {Object} validation states details output
 */
function apiCheckEmployee(equipmentId, employeeId) {
  try {
    return EquipmentService.checkEmployee(sanitizeId(equipmentId), sanitizeId(employeeId));
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * Queue/Waitlist details list remove check parameters run karta hai.
 * @param {Object} data - Queue release cancellation details
 * @returns {Object} confirms reports status or error
 */
function apiWithdrawQueue(data) {
  try {
    data.equipmentId = sanitizeId(data.equipmentId);
    data.employeeId  = sanitizeId(data.employeeId);
    return EquipmentService.withdrawQueue(data);
  } catch(e) {
    return { error: e.message };
  }
}

// =========================================================
// AUTOMATIC SYNC & AUDIT LOGGING TRIGGERS
// =========================================================

/**
 * Google Apps Script standard simple trigger jo manually sheet updates hone par call hota hai.
 * 1. Sheet me hue manual data modifications ko Audit_Log database tab me register karta hai.
 * 2. Equipment_Master me naye devices add hone par unhe status tracking list tab me initialize karta hai.
 * @param {Object} e - spreadsheet auto event edit tracking coordinates values
 */
function onEdit(e) {
  // Safe exit check: Event object check verification. Empty data updates bypass control
  if (!e || !e.source) return;
  
  // Sheet updates pointer fetches active sheet
  const sheet = e.source.getActiveSheet();
  // Target worksheet tab name fetch string
  const sheetName = sheet.getName();
  // Target cell updates coordinate details ranges
  const range = e.range;

  // 1. Audit_Log sheet me logs append karo agar edit kisi dusri sheet tab me hua ho
  if (sheetName !== CONFIG.SHEETS.AUDIT_LOG) {
    try {
      // Audit sheet object instances lookup fetches references
      const auditSheet = e.source.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
      if (auditSheet) {
        let details = '';
        // Edit cell coordinate index location identification checks
        const cell = range.getA1Notation();
        
        // Agar dynamic multi-cell/bulk range change operations execute hue hain
        if (range.getNumRows() > 1 || range.getNumColumns() > 1) {
          details = 'Bulk edit in range ' + cell;
        } else {
          // Single cell update check track old vs new configuration states
          const oldValue = e.oldValue === undefined ? 'empty/cleared' : e.oldValue;
          const newValue = e.value === undefined ? 'empty/cleared' : e.value;
          details = 'Changed from [' + oldValue + '] to [' + newValue + ']';
        }
        
        // Editor user email identification fetches fallbacks
        let editor = 'Manual Editor';
        if (e.user && e.user.getEmail()) editor = e.user.getEmail();
        else if (Session.getActiveUser().getEmail()) editor = Session.getActiveUser().getEmail();

        // Audit sheet row tracking entries add registers updates
        auditSheet.appendRow([
          new Date(),
          editor,
          'Manual Sheet Edit (' + sheetName + ')',
          'Cell: ' + cell,
          details
        ]);
      }
    } catch(err) {
      // Silent error handler block: Audit log fail hone par main cell editing block na ho
    }
  }

  // 2. Auto-Sync checks: Equipment_Master sheet me naye entries status sheet tab status maps me sync do
  if (sheetName === CONFIG.SHEETS.EQUIPMENT_MASTER) {
    // Start index parameters updates capture checks range positions
    const startRow = range.getRow();
    const numRows = range.getNumRows();
    
    // Header title line update conditions updates ignores bypass
    if (startRow === 1 && numRows === 1) return;
    
    // Status management spreadsheet checks mapping pointer exists check
    const statusSheet = e.source.getSheetByName(CONFIG.SHEETS.CURRENT_STATUS);
    if (!statusSheet) return;

    // Collect equipment IDs to update sync arrays list keys
    const eqIdsToSync = [];
    const masterValues = sheet.getRange(startRow, 1, numRows, 1).getValues();
    
    // Master data coordinates list iterate keys collect checks limits loops
    for (let i = 0; i < masterValues.length; i++) {
      const r = startRow + i;
      if (r <= 1) continue; // Skip database headers indexes
      const eqId = masterValues[i][0] ? masterValues[i][0].toString().trim() : '';
      if (eqId) {
        eqIdsToSync.push(eqId); // Add ID to update queue
      }
    }
    
    // Agar sync updates identifiers list checks parameters empty returns
    if (eqIdsToSync.length === 0) return;

    // Existing ids fetch map tracking duplication records checking maps sets keys build
    const statusData = statusSheet.getDataRange().getValues();
    const existingStatusIds = new Set();
    for (let i = 1; i < statusData.length; i++) {
      if (statusData[i][0]) {
        existingStatusIds.add(statusData[i][0].toString().trim());
      }
    }
    
    // Agar current state map registers check values target not exists status tab append new available keys
    eqIdsToSync.forEach(eqId => {
      if (!existingStatusIds.has(eqId)) {
        statusSheet.appendRow([eqId, 'Available', '', '', '', '', '']);
        existingStatusIds.add(eqId); 
      }
    });
  }
}
