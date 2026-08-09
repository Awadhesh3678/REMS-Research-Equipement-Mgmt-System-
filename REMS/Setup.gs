/**
 * FILE: Setup.gs
 * FUNCTIONALITY: A one-time utility script used to bootstrap the system.
 * It automatically creates the necessary tabs (sheets) and populates the required 
 * header row schema if they do not already exist in the database spreadsheet.
 */

/**
 * Iterates over the required CONFIG.SHEETS schema and creates them in the Spreadsheet.
 * Appends the bolded header columns.
 */
function setupDatabase() {
  const ss = Repository.getSpreadsheet();
  
  const schema = {
    [CONFIG.SHEETS.EQUIPMENT_MASTER]: [
      'Equipment_ID', 'Equipment_Name', 'Category', 'Location', 'Max_Duration_Minutes', 'QR_URL', 'Status', 'Active'
    ],
    [CONFIG.SHEETS.CURRENT_STATUS]: [
      'Equipment_ID', 'Status', 'Current_User', 'Booking_ID', 'Start_Time', 'End_Time', 'Next_User'
    ],
    [CONFIG.SHEETS.EMPLOYEE_DIRECTORY]: [
      'Employee_ID', 'Employee_Name', 'Department', 'Email'
    ],
    [CONFIG.SHEETS.BOOKING_HISTORY]: [
      'Booking_ID', 'Equipment_ID', 'Employee_ID', 'Employee_Name', 'Department', 'Email', 'Booking_Date', 'Booking_Start_Time', 'Booking_End_Time', 'For_How_Long_he_wants(hour)', 'Booking_Status', 'Confirmation_Status', 'Extension_Requested', 'Extension_Status', 'Actual_Start', 'Actual_End', 'Created_On', 'Last_Updated'
    ],
    [CONFIG.SHEETS.QUEUE]: [
      'Queue_ID', 'Equipment_ID', 'Booking_ID', 'Employee_ID', 'Employee_Name', 'Email', 'Queue_Position', 'Added_On'
    ],
    [CONFIG.SHEETS.SETTINGS]: [
      'Setting', 'Value'
    ],
    [CONFIG.SHEETS.AUDIT_LOG]: [
      'Timestamp', 'User', 'Action', 'Equipment', 'Details'
    ]
  };

  for (const sheetName in schema) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log(`Created new sheet: ${sheetName}`);
    }
    
    const headers = schema[sheetName];
    const existingRange = sheet.getDataRange();
    
    // If sheet is completely empty, add headers
    if (existingRange.getNumRows() === 0 || (existingRange.getNumRows() === 1 && existingRange.getValues()[0].join('') === "")) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
      Logger.log(`Set headers for ${sheetName}`);
    }
  }
  
  Logger.log("Database setup complete.");
}
