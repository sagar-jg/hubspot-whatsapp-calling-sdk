// src/services/TwilioService.js
const twilio = require('twilio');
const { Call, CallPermission } = require('../models');
const logger = require('../utils/logger');

class TwilioService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }

  /**
   * Send WhatsApp call permission request
   */
  async requestCallPermission(fromNumber, toNumber, hubspotAccountId) {
    try {
      // Create call permission request template
      const message = await this.client.messages.create({
        contentSid: process.env.TWILIO_CALL_PERMISSION_TEMPLATE_SID,
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`
      });

      // Update permission record
      await CallPermission.upsert({
        contact_phone: toNumber,
        hubspot_account_id: hubspotAccountId,
        permission_status: 'pending',
        request_count: sequelize.literal('request_count + 1'),
        last_request_at: new Date()
      });

      logger.info('Call permission requested', { 
        messageId: message.sid, 
        to: toNumber 
      });

      return message;
    } catch (error) {
      logger.error('Failed to request call permission', { error: error.message });
      throw error;
    }
  }

  /**
   * Initiate outbound WhatsApp call
   */
  async initiateOutboundCall(fromNumber, toNumber, webhookUrl) {
    try {
      const call = await this.client.calls.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`,
        url: webhookUrl,
        statusCallback: `${process.env.BASE_URL}/webhook/voice/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });

      logger.info('Outbound call initiated', { 
        callSid: call.sid, 
        to: toNumber 
      });

      return call;
    } catch (error) {
      logger.error('Failed to initiate outbound call', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate TwiML for incoming calls
   */
  generateInboundTwiML(contactOwnerId, callId) {
    const twiml = new twilio.twiml.VoiceResponse();
    
    if (contactOwnerId && contactOwnerId !== 'fallback') {
      // Ring timeout and routing logic
      const dial = twiml.dial({
        timeout: 30,
        callerId: process.env.WHATSAPP_SENDER_NUMBER,
        action: `${process.env.BASE_URL}/webhook/voice/dial-status`,
        method: 'POST'
      });

      // Add client endpoint for browser-based calling
      dial.client(`user_${contactOwnerId}`, {
        statusCallback: `${process.env.BASE_URL}/webhook/voice/client-status`,
        statusCallbackMethod: 'POST'
      });
    } else {
      // Fallback - play message and record voicemail
      twiml.say('Hello! Thank you for calling. The person you are trying to reach is not available right now.');
    }

    // Always add voicemail option
    twiml.say('Please leave a message after the tone, and we will get back to you as soon as possible.');
    twiml.record({
      action: `${process.env.BASE_URL}/webhook/voice/recording`,
      method: 'POST',
      maxLength: 120,
      transcribe: true,
      recordingStatusCallback: `${process.env.BASE_URL}/webhook/voice/recording-status`
    });

    twiml.say('Thank you for your message. Goodbye!');

    return twiml.toString();
  }

  /**
   * Send voice call button template
   */
  async sendVoiceCallButton(fromNumber, toNumber, templateSid, variables = {}) {
    try {
      const message = await this.client.messages.create({
        contentSid: templateSid,
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`,
        contentVariables: JSON.stringify(variables)
      });

      logger.info('Voice call button sent', { 
        messageId: message.sid, 
        to: toNumber 
      });

      return message;
    } catch (error) {
      logger.error('Failed to send voice call button', { error: error.message });
      throw error;
    }
  }
}

module.exports = new TwilioService();