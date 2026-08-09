/**
 * FILE: Automation.gs
 * FUNCTIONALITY: Contains background cron jobs that must be set up via Google Apps Script 
 * Time-Driven Triggers (e.g., to run every 1 minute). 
 * Responsible for auto-expiring bookings and auto-promoting the waitlist queue.
 */

/**
 * Iterates through all currently used equipment. If the current time has passed 
 * the booking's end time, it automatically completes the booking and promotes 
 * the next person in the waitlist queue.
 */
function runQueueAndExpiryAutomation() {
  const currentStatusSheet = Repository.getSheet(CONFIG.SHEETS.CURRENT_STATUS);
  if (!currentStatusSheet) return;
  
  const currentStatuses = Repository.getObjects(CONFIG.SHEETS.CURRENT_STATUS);
  const now = new Date();
  
  currentStatuses.forEach(statusObj => {
    if ((statusObj.Status === 'Using' || statusObj.Status === 'Reserved') && statusObj.End_Time) {
      const endTime = new Date(statusObj.End_Time);
      
      // If booking has expired
      if (now > endTime) {
         EquipmentService.processBookingCompletion(statusObj);
      }
    }
  });
}
