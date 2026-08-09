/**
 * HomeDashboardService.gs
 * Handles backend logic specifically for the REMS Home Dashboard feature.
 * Completely modular and removable without affecting core systems.
 */

const HomeDashboardService = {

  /**
   * Fetches all equipment from the master list and merges their real-time 
   * status from the Current_Status sheet.
   * @returns {Array} List of equipment objects formatted for the frontend cards.
   */
  apiGetAllEquipmentStatus: function() {
    try {
      const masterData = Repository.getObjects(CONFIG.SHEETS.EQUIPMENT_MASTER);
      const statusData = Repository.getObjects(CONFIG.SHEETS.CURRENT_STATUS);
      
      const equipmentList = masterData.filter(eq => eq.Equipment_ID).map(eq => {
        const statusObj = statusData.find(s => s.Equipment_ID === eq.Equipment_ID);
        
        return {
          equipmentId: eq.Equipment_ID,
          equipmentName: eq.Equipment_Name,
          category: eq.Category,
          location: eq.Location,
          // If no active status is found, assume Available.
          currentStatus: statusObj ? statusObj.Status : (eq.Status || 'Available')
        };
      });
      
      return equipmentList;
    } catch(e) {
      Logger.log("Error in HomeDashboardService.apiGetAllEquipmentStatus: " + e.message);
      return { error: e.message };
    }
  }

};
