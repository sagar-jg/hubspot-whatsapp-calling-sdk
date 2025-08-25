// src/middleware/validation.js
const { body, param, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

const validatePhoneNumber = (field) => {
  return body(field)
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format');
};

const validateOutboundCall = [
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('hubspotAccountId').isUUID().withMessage('Valid HubSpot account ID required'),
  body('contactId').optional().isInt().withMessage('Contact ID must be integer'),
  handleValidationErrors
];

const validatePermissionRequest = [
  body('phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('hubspotAccountId').isUUID().withMessage('Valid HubSpot account ID required'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validatePhoneNumber,
  validateOutboundCall,
  validatePermissionRequest
};