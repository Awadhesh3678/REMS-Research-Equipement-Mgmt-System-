/**
 * FILE: EquipmentService.gs
 * FUNCTIONALITY: The core engine for the Equipment Status and Booking flows.
 * Contains all business logic for retrieving equipment data, validating employees,
 * booking equipment, joining the waitlist, extending sessions, and releasing equipment.
 */
const EquipmentService = {

  /**
   * Retrieves the current real-time details of a specific piece of equipment, 
   * including who is using it, when they will finish, and how many people are in the queue.
   * @param {string} equipmentId - The ID of the equipment to look up.
   * @returns {Object} Aggregated data from Equipment_Master and Current_Status.
   */
  getEquipmentDetails: function(equipmentId) {
    const masterObj = Repository.findByField(CONFIG.SHEETS.EQUIPMENT_MASTER, 'Equipment_ID', equipmentId);
    if (!masterObj) throw new Error('Equipment not found.');

    const statusObj = Repository.findByField(CONFIG.SHEETS.CURRENT_STATUS, 'Equipment_ID', equipmentId);

    const queueCount = Repository.getObjects(CONFIG.SHEETS.QUEUE)
                                  .filter(q => q.Equipment_ID === equipmentId).length;

    let currentUserId = '';
    if (statusObj && statusObj.Booking_ID) {
      const activeBooking = Repository.findByField(CONFIG.SHEETS.BOOKING_HISTORY, 'Booking_ID', statusObj.Booking_ID);
      if (activeBooking) {
        currentUserId = activeBooking.Employee_ID;
      }
    }



    return {
      equipmentId:   masterObj.Equipment_ID,
      equipmentName: masterObj.Equipment_Name,
      category:      masterObj.Category,
      location:      masterObj.Location,
      maxDuration:   masterObj.Max_Duration_Minutes,
      currentStatus: statusObj ? statusObj.Status : masterObj.Status,
      currentUser:   statusObj ? statusObj.Current_User : '',
      currentUserId: currentUserId,
      bookingId:     statusObj ? statusObj.Booking_ID : '',
      startTime:     statusObj && statusObj.Start_Time ? this.formatTime(statusObj.Start_Time) : '',
      endTime:       statusObj && statusObj.End_Time   ? this.formatTime(statusObj.End_Time)   : '',
      nextUser:      statusObj ? statusObj.Next_User : '',
      queueCount:    queueCount
    };
  },

  formatTime: function(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return dateStr; }
  },

  /**
   * Validates an employee against the Employee Directory and determines their state
   * relative to the requested equipment (e.g., active booking, in waitlist queue).
   * @param {string} equipmentId - The equipment they are checking in for.
   * @param {string} employeeId - Their Employee ID.
   * @returns {Object} State data dictating which screen the UI should show next.
   */
  checkEmployee: function(equipmentId, employeeId) {
    const empData = Repository.findByField(CONFIG.SHEETS.EMPLOYEE_DIRECTORY, 'Employee_ID', employeeId);
    if (!empData) throw new Error('Unauthorized: Your Employee ID is not registered. Please contact the manager.');

    const statusObj = Repository.findByField(CONFIG.SHEETS.CURRENT_STATUS, 'Equipment_ID', equipmentId);
    let hasActiveBooking = false;
    let bookingInfo = null;

    if (statusObj && statusObj.Booking_ID) {
      const booking = Repository.findByField(CONFIG.SHEETS.BOOKING_HISTORY, 'Booking_ID', statusObj.Booking_ID);
      if (booking && booking.Employee_ID.toString().trim() === employeeId.toString().trim()) {
        hasActiveBooking = true;
        bookingInfo = {
          bookingId: booking.Booking_ID,
          startTime: this.formatTime(booking.Booking_Start_Time),
          endTime:   this.formatTime(booking.Booking_End_Time),
          duration:  booking['For_How_Long_he_wants(hour)']
        };
      }
    }

    const allQueue = Repository.getObjects(CONFIG.SHEETS.QUEUE);
    const userQueue = allQueue.find(q => q.Equipment_ID === equipmentId && q.Employee_ID.toString().trim() === employeeId.toString().trim());

    return {
      authorized:       true,
      employeeName:     empData.Employee_Name,
      department:       empData.Department,
      hasActiveBooking: hasActiveBooking,
      bookingInfo:      bookingInfo,
      inQueue:          !!userQueue,
      queuePosition:    userQueue ? userQueue.Queue_Position : 0
    };
  },

  /**
   * Processes a new equipment booking.
   * Inserts a record into Booking_History and updates Current_Status.
   * @param {Object} data - Contains equipmentId, employeeId, and durationMin.
   * @returns {Object} Success object containing a confirmation message.
   */
  bookEquipment: function(data) {
    if (!data.equipmentId || !data.employeeId || !data.durationMin)
      throw new Error('Missing required booking information.');

    const empData = Repository.findByField(CONFIG.SHEETS.EMPLOYEE_DIRECTORY, 'Employee_ID', data.employeeId);
    if (!empData) throw new Error('Unauthorized: Employee ID not found in the Directory.');

    data.employeeName = empData.Employee_Name;
    data.department   = empData.Department;
    data.email        = empData.Email;

    const eqStatus = Repository.findByField(CONFIG.SHEETS.CURRENT_STATUS, 'Equipment_ID', data.equipmentId);
    const currentStatus = eqStatus ? (eqStatus.Status || '').toLowerCase() : 'available';
    if (eqStatus && currentStatus !== 'available')
      throw new Error('Equipment is currently not available for booking.');

    const bookingId = 'BK' + new Date().getTime();
    const startTime = new Date();
    const endTime   = new Date(startTime.getTime() + data.durationMin * 60000);

    Repository.appendRow(CONFIG.SHEETS.BOOKING_HISTORY, {
      Booking_ID:                    bookingId,
      Equipment_ID:                  data.equipmentId,
      Employee_ID:                   data.employeeId,
      Employee_Name:                 data.employeeName,
      Department:                    data.department,
      Email:                         data.email,
      Booking_Date:                  startTime,
      Booking_Start_Time:            startTime,
      Booking_End_Time:              endTime,
      'For_How_Long_he_wants(hour)': data.durationMin / 60,
      Booking_Status:                'Using',
      Confirmation_Status:           'Confirmed',
      Extension_Requested:           'No',
      Extension_Status:              'NA',
      Actual_Start:                  startTime,
      Actual_End:                    '',
      Created_On:                    new Date(),
      Last_Updated:                  new Date()
    });

    if (eqStatus) {
      eqStatus.Status       = 'Using';
      eqStatus.Current_User = data.employeeName;
      eqStatus.Booking_ID   = bookingId;
      eqStatus.Start_Time   = startTime;
      eqStatus.End_Time     = endTime;
      Repository.updateRow(CONFIG.SHEETS.CURRENT_STATUS, eqStatus._rowIndex, eqStatus);
    } else {
      Repository.appendRow(CONFIG.SHEETS.CURRENT_STATUS, {
        Equipment_ID:  data.equipmentId,
        Status:        'Using',
        Current_User:  data.employeeName,
        Booking_ID:    bookingId,
        Start_Time:    startTime,
        End_Time:      endTime,
        Next_User:     ''
      });
    }

    const masterObj = Repository.findByField(CONFIG.SHEETS.EQUIPMENT_MASTER, 'Equipment_ID', data.equipmentId);
    if (masterObj) {
      masterObj.Status = 'Using';
      Repository.updateRow(CONFIG.SHEETS.EQUIPMENT_MASTER, masterObj._rowIndex, masterObj);
    }

    Repository.logAudit('Employee', 'Booking Created',
      data.employeeName + ' booked ' + data.equipmentId + ' for ' + data.durationMin + ' min.',
      data.equipmentId, bookingId);

    return { success: true, bookingId: bookingId, message: 'Booking confirmed successfully!' };
  },

  /**
   * Adds an employee to the waitlist queue for a specific equipment.
   * Inserts a record into the Queue sheet and a 'Waiting' record into Booking_History.
   * @param {Object} data - Contains equipmentId and employeeId.
   * @returns {Object} Success object containing their queue position.
   */
  joinQueue: function(data) {
    if (!data.equipmentId || !data.employeeId)
      throw new Error('Missing required queue information.');

    const empData = Repository.findByField(CONFIG.SHEETS.EMPLOYEE_DIRECTORY, 'Employee_ID', data.employeeId);
    if (!empData) throw new Error('Unauthorized: Employee ID not found in the Directory.');

    data.employeeName = empData.Employee_Name;
    data.department   = empData.Department;
    data.email        = empData.Email;

    const queueId = 'Q' + new Date().getTime();
    const bookingId = 'BK' + new Date().getTime();
    const currentQueue = Repository.getObjects(CONFIG.SHEETS.QUEUE)
                                    .filter(q => q.Equipment_ID === data.equipmentId);
    const position = currentQueue.length + 1;

    Repository.appendRow(CONFIG.SHEETS.BOOKING_HISTORY, {
      Booking_ID:                    bookingId,
      Equipment_ID:                  data.equipmentId,
      Employee_ID:                   data.employeeId,
      Employee_Name:                 data.employeeName,
      Department:                    data.department,
      Email:                         data.email,
      Booking_Date:                  new Date(),
      Booking_Start_Time:            '',
      Booking_End_Time:              '',
      'For_How_Long_he_wants(hour)': (data.durationMin || 60) / 60,
      Booking_Status:                'Waiting',
      Confirmation_Status:           'Pending',
      Extension_Requested:           'No',
      Extension_Status:              'NA',
      Actual_Start:                  '',
      Actual_End:                    '',
      Created_On:                    new Date(),
      Last_Updated:                  new Date()
    });

    Repository.appendRow(CONFIG.SHEETS.QUEUE, {
      Queue_ID:       queueId,
      Equipment_ID:   data.equipmentId,
      Booking_ID:     bookingId,
      Employee_ID:    data.employeeId,
      Employee_Name:  data.employeeName,
      Email:          data.email,
      Queue_Position: position,
      Added_On:       new Date()
    });

    if (position === 1) {
      const eqStatus = Repository.findByField(CONFIG.SHEETS.CURRENT_STATUS, 'Equipment_ID', data.equipmentId);
      if (eqStatus) {
        eqStatus.Next_User = data.employeeName;
        Repository.updateRow(CONFIG.SHEETS.CURRENT_STATUS, eqStatus._rowIndex, eqStatus);
      }
    }

    Repository.logAudit('Employee', 'Joined Queue',
      data.employeeName + ' joined queue at position ' + position + '.',
      data.equipmentId);

    return { success: true, queuePosition: position, message: 'Added to waitlist at position ' + position + '.' };
  },

  /**
   * Internal helper function that handles the completion of a booking.
   * Marks the active booking as 'Completed' and auto-promotes the next person 
   * in the waitlist queue to 'Using'. If no queue, marks equipment as 'Available'.
   * @param {Object} statusObj - The Current_Status object of the equipment.
   */
  processBookingCompletion: function(statusObj) {
    const equipmentId = statusObj.Equipment_ID;
    const bookingId   = statusObj.Booking_ID;

    const booking = Repository.findByField(CONFIG.SHEETS.BOOKING_HISTORY, 'Booking_ID', bookingId);
    if (booking) {
      booking.Booking_Status = 'Completed';
      booking.Actual_End     = new Date();
      booking.Last_Updated   = new Date();
      Repository.updateRow(CONFIG.SHEETS.BOOKING_HISTORY, booking._rowIndex, booking);
    }

    const allQueue = Repository.getObjects(CONFIG.SHEETS.QUEUE);
    let queue = allQueue
      .filter(q => q.Equipment_ID === equipmentId)
      .sort((a, b) => new Date(a.Added_On).getTime() - new Date(b.Added_On).getTime());

    if (queue.length > 0) {
      const nextUser = queue[0];
      const existingBooking = Repository.findByField(CONFIG.SHEETS.BOOKING_HISTORY, 'Booking_ID', nextUser.Booking_ID);
      
      let durationHours = existingBooking ? existingBooking['For_How_Long_he_wants(hour)'] : 1;
      if (!durationHours || isNaN(durationHours)) durationHours = 1;
      
      const startTime = new Date();
      const endTime   = new Date(startTime.getTime() + (durationHours * 60 * 60000));
      const newBookingId = nextUser.Booking_ID || ('BK' + new Date().getTime());

      const queueSheet = Repository.getSheet(CONFIG.SHEETS.QUEUE);
      queueSheet.deleteRow(nextUser._rowIndex);
      Repository.clearCache(CONFIG.SHEETS.QUEUE); // ← cache invalidated after deleteRow
      SpreadsheetApp.flush();

      // Safely re-fetch queue from sheet to get guaranteed correct row indices
      const updatedAllQueue = Repository.getObjects(CONFIG.SHEETS.QUEUE);
      let updatedQueue = updatedAllQueue
        .filter(q => q.Equipment_ID === equipmentId)
        .sort((a, b) => new Date(a.Added_On).getTime() - new Date(b.Added_On).getTime());

      // Update the Queue_Position for the remaining people in the queue
      updatedQueue.forEach((qUser, index) => {
        qUser.Queue_Position = index + 1;
        Repository.updateRow(CONFIG.SHEETS.QUEUE, qUser._rowIndex, qUser);
      });
      
      // Update queue reference for Current_Status
      queue = updatedQueue;

      statusObj.Status       = 'Using';
      statusObj.Current_User = nextUser.Employee_Name;
      statusObj.Booking_ID   = newBookingId;
      statusObj.Start_Time   = startTime;
      statusObj.End_Time     = endTime;
      statusObj.Next_User    = queue.length > 0 ? queue[0].Employee_Name : '';
      Repository.updateRow(CONFIG.SHEETS.CURRENT_STATUS, statusObj._rowIndex, statusObj);

      if (existingBooking) {
        existingBooking.Booking_Status      = 'Using';
        existingBooking.Confirmation_Status = 'Confirmed';
        existingBooking.Booking_Start_Time  = startTime;
        existingBooking.Booking_End_Time    = endTime;
        existingBooking.Actual_Start        = startTime;
        existingBooking.Last_Updated        = new Date();
        Repository.updateRow(CONFIG.SHEETS.BOOKING_HISTORY, existingBooking._rowIndex, existingBooking);
      } else {
        Repository.appendRow(CONFIG.SHEETS.BOOKING_HISTORY, {
          Booking_ID:                    newBookingId,
          Equipment_ID:                  equipmentId,
          Employee_ID:                   nextUser.Employee_ID,
          Employee_Name:                 nextUser.Employee_Name,
          Department:                    nextUser.Department || '',
          Email:                         nextUser.Email || '',
          Booking_Date:                  startTime,
          Booking_Start_Time:            startTime,
          Booking_End_Time:              endTime,
          'For_How_Long_he_wants(hour)': durationHours,
          Booking_Status:                'Using',
          Confirmation_Status:           'Confirmed',
          Extension_Requested:           'No',
          Extension_Status:              'NA',
          Actual_Start:                  startTime,
          Actual_End:                    '',
          Created_On:                    new Date(),
          Last_Updated:                  new Date()
        });
      }

      const masterObj = Repository.findByField(CONFIG.SHEETS.EQUIPMENT_MASTER, 'Equipment_ID', equipmentId);
      if (masterObj) {
        masterObj.Status = 'Using';
        Repository.updateRow(CONFIG.SHEETS.EQUIPMENT_MASTER, masterObj._rowIndex, masterObj);
      }

      Repository.logAudit('System', 'Queue Promoted',
        nextUser.Employee_Name + ' promoted from queue.', equipmentId, newBookingId);

      if (nextUser.Email) {
        try {
          MailApp.sendEmail({
            to:       nextUser.Email,
            subject:  'REMS: Equipment Ready - ' + equipmentId,
            htmlBody: 'Hello <b>' + nextUser.Employee_Name + '</b>,<br><br>Good news! <b>' + equipmentId +
                      '</b> is now free and has been automatically reserved for you.<br>Please proceed to the lab.<br><br><i>- REMS System</i>'
          });
        } catch(e) { console.error('Email failed:', e); }
      }

    } else {
      statusObj.Status       = 'Available';
      statusObj.Current_User = '';
      statusObj.Booking_ID   = '';
      statusObj.Start_Time   = '';
      statusObj.End_Time     = '';
      statusObj.Next_User    = '';
      Repository.updateRow(CONFIG.SHEETS.CURRENT_STATUS, statusObj._rowIndex, statusObj);

      const masterObj = Repository.findByField(CONFIG.SHEETS.EQUIPMENT_MASTER, 'Equipment_ID', equipmentId);
      if (masterObj) {
        masterObj.Status = 'Available';
        Repository.updateRow(CONFIG.SHEETS.EQUIPMENT_MASTER, masterObj._rowIndex, masterObj);
      }

      Repository.logAudit('System', 'Equipment Freed', 'Equipment is now available.', equipmentId, bookingId);
    }
  },

  /**
   * Releases an equipment early before its booking time ends.
   * Calls processBookingCompletion to handle queue promotions.
   * @param {Object} data - Contains equipmentId and employeeId.
   * @returns {Object} Success object containing a confirmation message.
   */
  releaseEquipment: function(data) {
    if (!data.equipmentId || !data.employeeId)
      throw new Error('Missing information to release equipment.');

    const statusObj = Repository.findByField(CONFIG.SHEETS.CURRENT_STATUS, 'Equipment_ID', data.equipmentId);
    if (!statusObj || !['using','reserved'].includes((statusObj.Status || '').toLowerCase()))
      throw new Error('Equipment is not currently booked.');

    const booking = Repository.findByField(CONFIG.SHEETS.BOOKING_HISTORY, 'Booking_ID', statusObj.Booking_ID);
    if (!booking) throw new Error('Active booking record not found.');
    if (booking.Employee_ID.toString().trim() !== data.employeeId.toString().trim())
      throw new Error('Employee ID does not match. Only the current user can free this equipment.');

    this.processBookingCompletion(statusObj);

    Repository.logAudit('Employee', 'Released Early',
      'User ' + data.employeeId + ' released equipment early.',
      data.equipmentId, statusObj.Booking_ID);

    return { success: true, message: 'Equipment released successfully!' };
  },

  /**
   * Requests a time extension for a currently active equipment booking.
   * Extends the Booking_End_Time and Current_Status End_Time.
   * @param {Object} data - Contains equipmentId, employeeId, and durationMin.
   * @returns {Object} Success object containing a confirmation message.
   */
  extendEquipment: function(data) {
    if (!data.equipmentId || !data.employeeId || !data.durationMin)
      throw new Error('Missing information to extend equipment.');

    const statusObj = Repository.findByField(CONFIG.SHEETS.CURRENT_STATUS, 'Equipment_ID', data.equipmentId);
    if (!statusObj || !['using','reserved'].includes((statusObj.Status || '').toLowerCase()))
      throw new Error('Equipment is not currently booked.');

    const booking = Repository.findByField(CONFIG.SHEETS.BOOKING_HISTORY, 'Booking_ID', statusObj.Booking_ID);
    if (!booking) throw new Error('Active booking record not found.');
    if (booking.Employee_ID.toString().trim() !== data.employeeId.toString().trim())
      throw new Error('Employee ID does not match. Only the current user can extend.');

    const newEndTime = new Date(new Date(booking.Booking_End_Time).getTime() + data.durationMin * 60000);

    booking.Booking_End_Time    = newEndTime;
    booking.Extension_Requested = 'Yes';
    booking.Extension_Status    = 'Confirmed';
    booking.Last_Updated        = new Date();
    Repository.updateRow(CONFIG.SHEETS.BOOKING_HISTORY, booking._rowIndex, booking);

    statusObj.End_Time = newEndTime;
    Repository.updateRow(CONFIG.SHEETS.CURRENT_STATUS, statusObj._rowIndex, statusObj);

    Repository.logAudit('Employee', 'Booking Extended',
      'User ' + data.employeeId + ' extended by ' + data.durationMin + ' min.',
      data.equipmentId, statusObj.Booking_ID);

    return { success: true, message: 'Duration extended by ' + data.durationMin + ' minutes!' };
  },

  /**
   * Withdraws an employee from the waitlist queue for an equipment.
   * Cleans up the Queue sheet and the pending Booking_History record.
   * Re-calculates positions for anyone remaining in the queue.
   * @param {Object} data - Contains equipmentId and employeeId.
   * @returns {Object} Success object containing a confirmation message.
   */
  withdrawQueue: function(data) {
    if (!data.equipmentId || !data.employeeId)
      throw new Error('Missing information to withdraw from queue.');

    const allQueue = Repository.getObjects(CONFIG.SHEETS.QUEUE);
    const queueItem = allQueue.find(q => q.Equipment_ID === data.equipmentId && q.Employee_ID.toString().trim() === data.employeeId.toString().trim());
    
    if (!queueItem) throw new Error('You are not currently in the waitlist for this equipment.');

    // Delete the pending 'Waiting' booking completely to avoid data validation errors
    if (queueItem.Booking_ID) {
      const booking = Repository.findByField(CONFIG.SHEETS.BOOKING_HISTORY, 'Booking_ID', queueItem.Booking_ID);
      if (booking) {
        const bookingSheet = Repository.getSheet(CONFIG.SHEETS.BOOKING_HISTORY);
        bookingSheet.deleteRow(booking._rowIndex);
        Repository.clearCache(CONFIG.SHEETS.BOOKING_HISTORY); // ← cache invalidated after deleteRow
      }
    }

    // Delete from queue sheet
    const queueSheet = Repository.getSheet(CONFIG.SHEETS.QUEUE);
    queueSheet.deleteRow(queueItem._rowIndex);
    Repository.clearCache(CONFIG.SHEETS.QUEUE); // ← cache invalidated after deleteRow
    SpreadsheetApp.flush();

    // Recalculate remaining queue positions safely
    const updatedAllQueue = Repository.getObjects(CONFIG.SHEETS.QUEUE);
    let updatedQueue = updatedAllQueue
      .filter(q => q.Equipment_ID === data.equipmentId)
      .sort((a, b) => new Date(a.Added_On).getTime() - new Date(b.Added_On).getTime());

    updatedQueue.forEach((qUser, index) => {
      qUser.Queue_Position = index + 1;
      Repository.updateRow(CONFIG.SHEETS.QUEUE, qUser._rowIndex, qUser);
    });

    // If the person who withdrew was first in line, we must update Current_Status.Next_User
    if (queueItem.Queue_Position === 1) {
      const eqStatus = Repository.findByField(CONFIG.SHEETS.CURRENT_STATUS, 'Equipment_ID', data.equipmentId);
      if (eqStatus) {
        eqStatus.Next_User = updatedQueue.length > 0 ? updatedQueue[0].Employee_Name : '';
        Repository.updateRow(CONFIG.SHEETS.CURRENT_STATUS, eqStatus._rowIndex, eqStatus);
      }
    }

    Repository.logAudit('Employee', 'Withdrew from Queue', data.employeeId + ' left the queue manually.', data.equipmentId);

    return { success: true, message: 'You have been successfully removed from the waitlist.' };
  }
};
