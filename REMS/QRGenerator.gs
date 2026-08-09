/**
 * FILE: QRGenerator.gs
 * FUNCTIONALITY: Generates QR codes for new equipment added to the Equipment_Master sheet.
 * It compiles these QR codes into a "Master QR Labels" spreadsheet in a designated Google Drive 
 * folder and can optionally email them to administrators for printing.
 */

/**
 * Iterates through the Equipment_Master sheet. For any equipment missing a QR URL,
 * it generates a QR code image link and adds it to the master sheet.
 * It also exports a formatted list of new QR codes to the "Master QR Labels" spreadsheet.
 */
function generateQRCodesForEquipment() {
  const masterSheet = Repository.getSheet(CONFIG.SHEETS.EQUIPMENT_MASTER);
  if (!masterSheet) {
    Logger.log("Equipment_Master sheet not found.");
    return;
  }
  
  const data = masterSheet.getDataRange().getValues();
  if (data.length < 2) return; // Only headers or empty

  const headers = data[0];
  const eqIdColIndex = headers.indexOf('Equipment_ID');
  const eqNameColIndex = headers.indexOf('Equipment_Name');
  let qrUrlColIndex = headers.indexOf('QR_URL');
  
  // If QR_URL column doesn't exist on master sheet, append it
  if (qrUrlColIndex === -1) {
    qrUrlColIndex = headers.length;
    masterSheet.getRange(1, qrUrlColIndex + 1).setValue('QR_URL');
  }
  
  const timeStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDERS.QR_CODES);
    const existingFiles = folder.getFilesByName("Master QR Labels");
    let spreadsheet;
    
    // 1. Check if the Master file already exists
    if (existingFiles.hasNext()) {
      spreadsheet = SpreadsheetApp.openById(existingFiles.next().getId());
    } else {
      // 2. If not, create it and move it to the QR_Codes folder
      spreadsheet = SpreadsheetApp.create("Master QR Labels");
      const file = DriveApp.getFileById(spreadsheet.getId());
      file.moveTo(folder);
    }
    
    // 3. Create a new tab inside the Master file for today's generated labels
    const sheet = spreadsheet.insertSheet(`Labels ${timeStr}`);
    
    // 3. Set up the 4 columns requested
    sheet.getRange(1, 1, 1, 4).setValues([["Sr. No.", "Equipment ID", "Equipment Name", "QR Scanner Code"]]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#e2e8f0");
    
    let rowIndex = 2;
    
    // 4. Loop through master data and generate rows
    for (let i = 1; i < data.length; i++) {
      const equipmentId = data[i][eqIdColIndex];
      const equipmentName = data[i][eqNameColIndex];
      
      if (equipmentId) {
        const bookingUrl = CONFIG.WEB_APP_URL + "?equipment_id=" + encodeURIComponent(equipmentId);
        const qrApiUrl = "https://quickchart.io/qr?size=300x300&text=" + encodeURIComponent(bookingUrl);
        const formula = `=IMAGE("${qrApiUrl}")`;
        
        // Write text values
        sheet.getRange(rowIndex, 1, 1, 3).setValues([[rowIndex - 1, equipmentId, equipmentName || '-']]);
        
        // Write QR image formula to the printable sheet
        sheet.getRange(rowIndex, 4).setFormula(formula);
        
        // Make the row tall enough for the QR code to be scannable when printed
        sheet.setRowHeight(rowIndex, 200);
        rowIndex++;
        
        // --- NEW: Also write it back to the Master Sheet ---
        masterSheet.getRange(i + 1, qrUrlColIndex + 1).setFormula(formula);
        masterSheet.setRowHeight(i + 1, 200);
      }
    }
    
    // Resize the Master sheet QR column
    masterSheet.setColumnWidth(qrUrlColIndex + 1, 200);
    
    // 5. Clean up formatting (Column widths and alignments)
    sheet.setColumnWidth(1, 80);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 200);
    sheet.setColumnWidth(4, 200);
    
    // Center everything beautifully
    sheet.getRange(1, 1, rowIndex - 1, 4).setHorizontalAlignment("center").setVerticalAlignment("middle");
    
    if (SpreadsheetApp.getActiveSpreadsheet()) {
      SpreadsheetApp.getUi().alert('Success', `A printable QR Labels sheet has been generated inside your QR_Codes Drive Folder!`, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    
  } catch (e) {
    Logger.log("Failed to generate QR Sheet: " + e.message);
    if (SpreadsheetApp.getActiveSpreadsheet()) {
      SpreadsheetApp.getUi().alert('Error', 'Failed to generate QR Codes: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }
}

/**
 * Creates a custom menu if this script is bound to a spreadsheet.
 * Allows managers to click "REMS Menu > Generate QR Codes".
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('REMS Menu')
      .addItem('Setup Database', 'setupDatabase')
      .addItem('Generate QR Codes', 'generateQRCodesForEquipment')
      .addItem('Run Manual Backup', 'runDatabaseBackup')
      .addToUi();
  } catch (e) {
    // If running as a standalone script or web app, getUi() might throw an error.
    // It's safe to ignore if the script isn't bound to the spreadsheet.
    Logger.log("Cannot create custom menu (script likely not bound to a spreadsheet).");
  }
}
