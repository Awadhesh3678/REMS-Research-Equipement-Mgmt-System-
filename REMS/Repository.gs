/**
 * FILE: Repository.gs
 * FUNCTIONALITY: The Data Access Layer. Abstracts away direct interactions with Google Sheets API 
 * (SpreadsheetApp). Provides cached CRUD (Create, Read, Update, Delete) methods for transforming 
 * spreadsheet rows into javascript objects and vice versa, significantly speeding up data access.
 */
const Repository = {
  _spreadsheetCache: null,
  _objectsCache: {},

  /**
   * Gets the main spreadsheet object. Uses caching to prevent duplicate API calls per execution.
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The Google Spreadsheet object.
   */
  getSpreadsheet: function() {
    if (!this._spreadsheetCache) {
      this._spreadsheetCache = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    }
    return this._spreadsheetCache;
  },

  /**
   * Gets a specific sheet by its name.
   * @param {string} sheetName - The exact name of the sheet (use CONFIG.SHEETS constants).
   * @returns {GoogleAppsScript.Spreadsheet.Sheet} The Google Sheet object.
   */
  getSheet: function(sheetName) {
    return this.getSpreadsheet().getSheetByName(sheetName);
  },

  /**
   * Reads all data from a sheet and parses it into an array of Javascript objects based on header names.
   * Caches the result so subsequent calls during the same execution are instantaneous.
   * @param {string} sheetName - The name of the sheet to read.
   * @returns {Array<Object>} An array where each object represents a row.
   */
  getObjects: function(sheetName) {
    if (this._objectsCache[sheetName]) {
      return this._objectsCache[sheetName];
    }

    const sheet = this.getSheet(sheetName);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      this._objectsCache[sheetName] = [];
      return [];
    }

    const headers = data[0];
    const rows = data.slice(1);
    
    const parsedObjects = rows.map((row, rowIndex) => {
      let obj = { _rowIndex: rowIndex + 2 }; // 1-based index, +1 for header
      headers.forEach((header, colIndex) => {
        if (header) {
          obj[header.toString().trim()] = row[colIndex];
        }
      });
      return obj;
    });

    this._objectsCache[sheetName] = parsedObjects;
    return parsedObjects;
  },

  /**
   * Finds the first row (as an object) where the specified field matches the given value.
   * Uses string comparison to avoid type mismatch issues between numbers and strings.
   * @param {string} sheetName - The sheet to search in.
   * @param {string} field - The exact header column name to match against.
   * @param {string|number} value - The value to search for.
   * @returns {Object|null} The matching object/row, or null if not found.
   */
  findByField: function(sheetName, field, value) {
    const objects   = this.getObjects(sheetName);
    const valStr    = value !== null && value !== undefined ? value.toString().trim() : '';
    return objects.find(obj => {
      const fieldVal = obj[field] !== null && obj[field] !== undefined
                       ? obj[field].toString().trim() : '';
      return fieldVal === valStr;
    }) || null;
  },

  /**
   * Appends a new row to the bottom of the specified sheet.
   * @param {string} sheetName - The target sheet.
   * @param {Object} rowDataObj - Key-value pairs representing column headers and their new values.
   */
  appendRow: function(sheetName, rowDataObj) {
    const sheet = this.getSheet(sheetName);
    if (!sheet) return;
    
    try {
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) throw new Error("Sheet '" + sheetName + "' has no headers (0 columns). Please run Setup Database.");
      
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const rowArray = headers.map(header => {
        const key = header ? header.toString().trim() : '';
        return rowDataObj[key] !== undefined ? rowDataObj[key] : '';
      });
      sheet.appendRow(rowArray);
      SpreadsheetApp.flush();
      
      // Clear cache for this sheet since data has mutated
      this._objectsCache[sheetName] = null;
    } catch (e) {
      throw new Error("Error appending to " + sheetName + ": " + e.message);
    }
  },
  
  /**
   * Updates an existing row in a sheet, preserving any formulas that might exist in the row.
   * @param {string} sheetName - The target sheet.
   * @param {number} rowIndex - The actual row index in the spreadsheet (1-based). Available as _rowIndex on objects.
   * @param {Object} rowDataObj - Key-value pairs of the updated data.
   */
  updateRow: function(sheetName, rowIndex, rowDataObj) {
    const sheet = this.getSheet(sheetName);
    if (!sheet) return;
    
    try {
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) throw new Error("Sheet '" + sheetName + "' has no columns.");
      if (rowIndex < 1) throw new Error("Invalid rowIndex: " + rowIndex);
      
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const existingFormulas = sheet.getRange(rowIndex, 1, 1, headers.length).getFormulas()[0];
      
      const rowArray = headers.map((header, i) => {
        // If the cell currently has a formula, preserve it to prevent destroying it
        // and to prevent 'Service error' from trying to write back a CellImage object.
        if (existingFormulas[i] && existingFormulas[i].toString().startsWith('=')) {
          return existingFormulas[i];
        }
        
        const key = header ? header.toString().trim() : '';
        let val = rowDataObj[key] !== undefined ? rowDataObj[key] : '';
        
        // Failsafe: if val is a weird object (like a CellImage returned by getValues), clear it to prevent crash
        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
          val = ''; 
        }
        return val;
      });
      
      const range = sheet.getRange(rowIndex, 1, 1, lastCol);
      range.setValues([rowArray]);
      SpreadsheetApp.flush();
      
      // Clear cache for this sheet since data has mutated
      this._objectsCache[sheetName] = null;
    } catch (e) {
      throw new Error("Error updating " + sheetName + " at row " + rowIndex + ": " + e.message);
    }
  },

  /**
   * Explicitly clears the memory cache for a given sheet (or all sheets).
   * MUST be called after any direct sheet API calls (like deleteRow) that bypass Repository mutators.
   * @param {string} [sheetName] - Optional. If provided, clears only this sheet's cache.
   */
  clearCache: function(sheetName) {
    if (sheetName) {
      this._objectsCache[sheetName] = null;
    } else {
      this._objectsCache = {}; // clear all caches
    }
  },

  /**
   * Logs a standardized audit record into the Audit_Log sheet.
   * @param {string} actor - Who performed the action (e.g. Employee Name, 'System', 'Trigger').
   * @param {string} action - Short description of the action (e.g. 'Booked', 'Released').
   * @param {string} details - A human-readable description of exactly what happened.
   * @param {string} [equipmentId=''] - The ID of the affected equipment.
   * @param {string} [bookingId=''] - The ID of the affected booking, if any.
   */
  logAudit: function(actor, action, details, equipmentId = '', bookingId = '') {
    this.appendRow(CONFIG.SHEETS.AUDIT_LOG, {
      Timestamp: new Date(),
      User: actor,
      Action: action,
      Equipment: equipmentId,
      Details: details
    });
  }
};
