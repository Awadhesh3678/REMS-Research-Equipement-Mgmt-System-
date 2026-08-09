/**
 * FILE: BackupService.gs
 * FUNCTIONALITY: Handles creating a copy of the active database spreadsheet
 * and saving it to the configured Google Drive Backup folder. This function
 * is typically triggered manually by an Admin or set up as a nightly cron job.
 */

/**
 * Creates a duplicate of the entire Google Sheets database and saves it 
 * to the backup folder with a timestamped filename. Logs the result in Audit_Log.
 */
function runDatabaseBackup() {
  try {
    const spreadsheet = Repository.getSpreadsheet();
    const spreadsheetName = spreadsheet.getName();
    const spreadsheetId = spreadsheet.getId();
    
    // Format today's date for the backup filename
    const today = new Date();
    const dateString = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm");
    const backupName = `[BACKUP] ${spreadsheetName} - ${dateString}`;
    
    // Get the source file and target folder
    const sourceFile = DriveApp.getFileById(spreadsheetId);
    const backupFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDERS.BACKUP);
    
    // Create the copy directly inside the backup folder
    sourceFile.makeCopy(backupName, backupFolder);
    
    // Log the backup
    Repository.logAudit('System', 'Backup Created', `Database successfully backed up to Backup folder as: ${backupName}`);
    
    if (SpreadsheetApp.getActiveSpreadsheet()) {
      SpreadsheetApp.getUi().alert('Success', 'Database backup has been created in your Backup folder.', SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (error) {
    Logger.log("Backup failed: " + error.toString());
    if (SpreadsheetApp.getActiveSpreadsheet()) {
      SpreadsheetApp.getUi().alert('Error', 'Backup failed: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }
}
