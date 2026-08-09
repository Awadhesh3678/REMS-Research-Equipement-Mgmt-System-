/**
 * FILE: ProfileService.gs
 * FUNCTIONALITY: Handles backend data retrieval for the User Profile screen. 
 * Queries the Booking_History and Equipment_Master sheets to assemble a user's 
 * active bookings and past usage history.
 */
const ProfileService = {
  
  /**
   * Retrieves the user profile and their active/past bookings.
   * @param {string} employeeId - The Employee ID to query.
   * @returns {Object} Profile data including employee details, active bookings, and history.
   */
  getUserProfile: function(employeeId) {
    if (!employeeId) throw new Error('Employee ID is required.');
    
    // 1. Get Employee Info
    const empData = Repository.findByField(CONFIG.SHEETS.EMPLOYEE_DIRECTORY, 'Employee_ID', employeeId);
    if (!empData) throw new Error('Employee ID not found in the Directory.');

    const profile = {
      employeeId: empData.Employee_ID,
      employeeName: empData.Employee_Name,
      department: empData.Department,
      activeBookings: [],
      history: []
    };

    // 2. Fetch Booking History for this user
    const allBookings = Repository.getObjects(CONFIG.SHEETS.BOOKING_HISTORY);
    const userBookings = allBookings.filter(b => b.Employee_ID.toString().trim() === employeeId.toString().trim());

    // 3. Fetch Equipment Master to get Names/Details
    const eqMaster = Repository.getObjects(CONFIG.SHEETS.EQUIPMENT_MASTER);
    const eqMap = {};
    eqMaster.forEach(eq => {
      eqMap[eq.Equipment_ID] = eq.Equipment_Name;
    });

    // 3.5 Fetch Current Status and Queue to validate active states
    const activeStatuses = Repository.getObjects(CONFIG.SHEETS.CURRENT_STATUS);
    const activeQueue = Repository.getObjects(CONFIG.SHEETS.QUEUE);
    const validActiveBookingIds = new Set(activeStatuses.map(s => s.Booking_ID).filter(id => id));
    const validQueueBookingIds = new Set(activeQueue.map(q => q.Booking_ID).filter(id => id));

    // 4. Sort user bookings by Date (newest first)
    userBookings.sort((a, b) => {
      return new Date(b.Booking_Date).getTime() - new Date(a.Booking_Date).getTime();
    });

    // 5. Categorize Bookings
    userBookings.forEach(b => {
      const eqName = eqMap[b.Equipment_ID] || b.Equipment_ID;
      
      let currentStatus = (b.Booking_Status || '').toString().trim();
      
      // Self-healing: Detect if a booking is marked as 'Using' or 'Waiting' but is actually a ghost (no longer in Current_Status/Queue)
      if (currentStatus === 'Using' && !validActiveBookingIds.has(b.Booking_ID)) {
        currentStatus = 'Completed'; // Auto-correct for the UI
      }
      if (currentStatus === 'Waiting' && !validQueueBookingIds.has(b.Booking_ID)) {
        currentStatus = 'Withdrawn'; // Auto-correct for the UI
      }

      const bookingData = {
        bookingId: b.Booking_ID,
        equipmentId: b.Equipment_ID,
        equipmentName: eqName,
        status: currentStatus,
        date: this.formatDate(b.Booking_Date),
        startTime: b.Booking_Start_Time ? this.formatTime(b.Booking_Start_Time) : '--:--',
        endTime: b.Booking_End_Time ? this.formatTime(b.Booking_End_Time) : '--:--',
        duration: b['For_How_Long_he_wants(hour)'] || 0
      };

      if (currentStatus === 'Using' || currentStatus === 'Waiting') {
        profile.activeBookings.push(bookingData);
      } else {
        // Any other state (Completed, Finished, Withdrawn, etc.) goes to history
        profile.history.push(bookingData);
      }
    });

    return profile;
  },

  /**
   * Helper function to format an ISO date string into a readable time (HH:MM AM/PM).
   */
  formatTime: function(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return dateStr; }
  },

  /**
   * Helper function to format an ISO date string into a readable date (e.g., Jan 1, 2026).
   */
  formatDate: function(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch(e) { return dateStr; }
  }

};
