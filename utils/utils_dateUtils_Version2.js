const moment = require('moment');

// Get current date in YYYY-MM-DD format
const getCurrentDate = () => {
  return moment().format('YYYY-MM-DD');
};

// Get day of week from date
const getDayOfWeek = (date) => {
  return moment(date).format('dddd');
};

// Check if a date string is valid
const isValidDate = (dateString) => {
  return moment(dateString, 'YYYY-MM-DD', true).isValid();
};

// Parse date from various formats
const parseDate = (input) => {
  // Try to parse various date formats
  const formats = [
    'YYYY-MM-DD',
    'DD-MM-YYYY',
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'DD MMM YYYY',
    'MMM DD, YYYY'
  ];
  
  for (const format of formats) {
    const date = moment(input, format);
    if (date.isValid()) {
      return date.format('YYYY-MM-DD');
    }
  }
  
  // Handle relative dates
  const lowerInput = input.toLowerCase();
  
  if (lowerInput === 'today' || lowerInput === 'now') {
    return getCurrentDate();
  }
  
  if (lowerInput === 'yesterday') {
    return moment().subtract(1, 'days').format('YYYY-MM-DD');
  }
  
  if (lowerInput === 'tomorrow') {
    return moment().add(1, 'days').format('YYYY-MM-DD');
  }
  
  // Try to match "last monday", "next friday", etc.
  const dayMatch = lowerInput.match(/^(last|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (dayMatch) {
    const direction = dayMatch[1]; // "last" or "next"
    const day = dayMatch[2];
    const dayNumber = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day);
    
    let date = moment().day(dayNumber);
    
    if (direction === 'last' || (direction === 'next' && date.isSameOrBefore(moment(), 'day'))) {
      date = date.add(direction === 'last' ? -7 : 7, 'days');
    }
    
    return date.format('YYYY-MM-DD');
  }
  
  return null;
};

module.exports = {
  getCurrentDate,
  getDayOfWeek,
  isValidDate,
  parseDate
};