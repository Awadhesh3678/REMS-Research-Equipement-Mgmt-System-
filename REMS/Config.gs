/**
 * FILE: Config.gs
 * FUNCTIONALITY: The central configuration file for the REMS application. 
 * It holds the global CONFIG object, which defines the names of all Google Sheets, 
 * the Spreadsheet ID, the Web App URL, and Google Drive Folder IDs used for backups and QR codes.
 * Update this file if any underlying sheet names or URLs change.
 */

const CONFIG = {
  SPREADSHEET_ID:'1hTDARUtnu1gy7_p9_hjZNEj6zxawDjhqogSIke9zTPg',
  SHEETS: {
    EQUIPMENT_MASTER: 'Equipment_Master',
    CURRENT_STATUS: 'Current_Status',
    BOOKING_HISTORY: 'Booking_History',
    QUEUE: 'Queue',
    EMPLOYEE_DIRECTORY: 'Employee_Directory',
    SETTINGS: 'Settings',
    AUDIT_LOG: 'Audit_Log'
  },
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwTpQeEIfoIKaY3G2YT_gbDaNl5i15uqQpePs4LPqFBT53Y6FM_XJjqQmKnSVnn80bj/exec',
  DRIVE_FOLDERS: {
    QR_CODES: '1sCYxEuM1oy-Y4xkGintSCrPOYyxHjboa',
    BACKUP: '1YapKnZutvHrhJ0ff_mUIdnlpJdGiU_pX'
  }
};
