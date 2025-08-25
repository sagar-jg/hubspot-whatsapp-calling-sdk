// src/routes/webhooks.js
const express = require('express');
const twilio = require('twilio');
const { Call } = require('../models');
const TwilioService = require('../services/TwilioService');
const CallRoutingService = require('../services/CallRoutingService');
const HubSpotService = require('../services/HubSpotService');
const PermissionService = require('../services/PermissionService');
const { validateTwilioWebhook } = require('../middleware/webhookValidation');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/voice/inbound', validateTwilioWebhook, async (req, res) => {
  try {
    const { From, To, CallSid } = req.body;
    
    const fromNumber = From.replace('whatsapp:', '');
    const toNumber = To.replace('whatsapp:', '');
    
    logger.info('Incoming WhatsApp call received', { 
      callSid: CallSid, 
      from: fromNumber, 
      to: toNumber 
    });

    const { HubSpotAccount } = require('../models');
    const account = await HubSpotAccount.findOne({
      where: { whatsapp_sender: toNumber }
    });

    if (!account) {
      logger.error('No HubSpot account found for WhatsApp sender', { toNumber });
      return res.status(404).send('Account not found');
    }

    const routing = await CallRoutingService.routeIncomingCall(
      fromNumber, 
      toNumber, 
      CallSid, 
      account.id
    );

    if (routing.userInfo && routing.contactOwnerId) {
      const io = req.app.get('socketio');
      io.to(routing.userInfo.socketId).emit('incoming_call', {
        callSid: CallSid,
        fromNumber,
        contact: routing.contact,
        callId: routing.call.id
      });
    }

    const twiml = TwilioService.generateInboundTwiML(
      routing.contactOwnerId || 'fallback', 
      routing.call.id
    );

    res.type('text/xml').send(twiml);

  } catch (error) {
    logger.error('Error handling incoming call', { error: error.message });
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Sorry, we are experiencing technical difficulties. Please try again later.');
    res.type('text/xml').send(twiml.toString());
  }
});

router.post('/voice/status', validateTwilioWebhook, async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    
    const call = await Call.findOne({
      where: { twilio_call_sid: CallSid }
    });

    if (call) {
      const updateData = {
        call_status: CallStatus.toLowerCase(),
        call_duration: CallDuration ? parseInt(CallDuration) : call.call_duration
      };

      await call.update(updateData);

      if (CallStatus === 'completed' && call.hubspot_contact_id) {
        try {
          const engagement = await HubSpotService.createCallEngagement(
            call.hubspot_contact_id,
            {
              direction: call.call_direction,
              status: CallStatus,
              duration: CallDuration,
              fromNumber: call.from_number,
              toNumber: call.to_number,
              recordingUrl: call.recording_url
            },
            call.hubspot_account_id
          );

          await call.update({ 
            hubspot_engagement_id: engagement.id 
          });
        } catch (hubspotError) {
          logger.error('Failed to create HubSpot engagement', { 
            error: hubspotError.message,
            callSid: CallSid 
          });
        }
      }

      const io = req.app.get('socketio');
      io.emit('call_status_update', {
        callSid: CallSid,
        status: CallStatus,
        duration: CallDuration,
        callId: call.id
      });

      logger.info('Call status updated', { 
        callSid: CallSid, 
        status: CallStatus 
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling call status update', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/sms/incoming', validateTwilioWebhook, async (req, res) => {
  try {
    const { 
      From, 
      To, 
      Body, 
      ButtonPayload, 
      MessageType 
    } = req.body;

    if (Body === 'VOICE_CALL_REQUEST' && MessageType === 'interactive') {
      const fromNumber = From.replace('whatsapp:', '');
      const toNumber = To.replace('whatsapp:', '');
      
      const { HubSpotAccount } = require('../models');
      const account = await HubSpotAccount.findOne({
        where: { whatsapp_sender: toNumber }
      });

      if (account) {
        await PermissionService.handlePermissionResponse(
          fromNumber,
          ButtonPayload,
          account.id
        );

        logger.info('Permission response processed', {
          from: fromNumber,
          response: ButtonPayload
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling SMS webhook', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/voice/recording', validateTwilioWebhook, async (req, res) => {
  try {
    const { CallSid, RecordingUrl, TranscriptionText } = req.body;
    
    const call = await Call.findOne({
      where: { twilio_call_sid: CallSid }
    });

    if (call) {
      const updateData = { recording_url: RecordingUrl };
      if (TranscriptionText) {
        updateData.transcription = TranscriptionText;
      }
      
      await call.update(updateData);
      
      logger.info('Recording URL updated', { 
        callSid: CallSid, 
        recordingUrl: RecordingUrl 
      });
    }

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.hangup();
    
    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    logger.error('Error handling recording webhook', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/voice/dial-status', validateTwilioWebhook, async (req, res) => {
  try {
    const { CallSid, DialCallStatus } = req.body;
    
    logger.info('Dial status update', { callSid: CallSid, status: DialCallStatus });
    
    const call = await Call.findOne({
      where: { twilio_call_sid: CallSid }
    });

    if (call) {
      await call.update({ call_status: DialCallStatus.toLowerCase() });
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling dial status', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/voice/client-status', validateTwilioWebhook, async (req, res) => {
  try {
    const { CallSid, CallStatus } = req.body;
    
    logger.info('Client status update', { callSid: CallSid, status: CallStatus });
    
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling client status', { error: error.message });
    res.status(500).send('Error');
  }
});

router.post('/voice/recording-status', validateTwilioWebhook, async (req, res) => {
  try {
    const { CallSid, RecordingStatus } = req.body;
    
    logger.info('Recording status update', { callSid: CallSid, status: RecordingStatus });
    
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling recording status', { error: error.message });
    res.status(500).send('Error');
  }
});

module.exports = router;