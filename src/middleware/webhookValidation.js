// src/middleware/webhookValidation.js
const twilio = require('twilio');
const logger = require('../utils/logger');

const validateTwilioWebhook = (req, res, next) => {
  try {
    const twilioSignature = req.headers['x-twilio-signature'];
    
    if (!twilioSignature) {
      logger.warn('Missing Twilio signature header');
      return res.status(403).json({ error: 'Missing signature' });
    }

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // Convert form data to object for validation
    const params = {};
    if (req.body) {
      for (const [key, value] of Object.entries(req.body)) {
        params[key] = value;
      }
    }
    
    // Validate webhook signature
    const isValidRequest = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      twilioSignature,
      url,
      params
    );

    if (!isValidRequest) {
      logger.warn('Invalid Twilio webhook signature', { 
        url,
        signature: twilioSignature 
      });
      return res.status(403).json({ error: 'Invalid webhook signature' });
    }

    next();
  } catch (error) {
    logger.error('Webhook validation error', { error: error.message });
    res.status(500).json({ error: 'Webhook validation failed' });
  }
};

module.exports = { validateTwilioWebhook };