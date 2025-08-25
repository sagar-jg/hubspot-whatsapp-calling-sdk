// src/routes/calling.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { Call } = require('../models');
const TwilioService = require('../services/TwilioService');
const HubSpotService = require('../services/HubSpotService');
const PermissionService = require('../services/PermissionService');
const CallRoutingService = require('../services/CallRoutingService');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/outbound', async (req, res) => {
  try {
    const { phoneNumber, contactId, hubspotAccountId, userId } = req.body;

    if (!phoneNumber || !hubspotAccountId) {
      return res.status(400).json({ 
        error: 'Missing required fields: phoneNumber, hubspotAccountId' 
      });
    }

    const { HubSpotAccount } = require('../models');
    const account = await HubSpotAccount.findByPk(hubspotAccountId);
    
    if (!account || !account.whatsapp_sender) {
      return res.status(404).json({ error: 'HubSpot account or WhatsApp sender not found' });
    }

    const cleanPhoneNumber = phoneNumber.replace('whatsapp:', '');

    const permissionResult = await PermissionService.requestPermissionIfNeeded(
      account.whatsapp_sender,
      cleanPhoneNumber,
      hubspotAccountId
    );

    if (permissionResult.status !== 'granted') {
      return res.json({
        success: false,
        reason: 'permission_required',
        permissionStatus: permissionResult.status,
        details: permissionResult
      });
    }

    const call = await Call.create({
      hubspot_contact_id: contactId,
      hubspot_account_id: hubspotAccountId,
      from_number: account.whatsapp_sender,
      to_number: cleanPhoneNumber,
      call_direction: 'outbound',
      contact_owner_id: userId,
      call_status: 'initiated'
    });

    const webhookUrl = `${process.env.BASE_URL}/webhook/voice/outbound/${call.id}`;
    const twilioCall = await TwilioService.initiateOutboundCall(
      account.whatsapp_sender,
      cleanPhoneNumber,
      webhookUrl
    );

    await call.update({ twilio_call_sid: twilioCall.sid });

    let engagementId = null;
    if (contactId) {
      try {
        const engagement = await HubSpotService.createCallEngagement(
          contactId,
          {
            direction: 'outbound',
            status: 'initiated',
            fromNumber: account.whatsapp_sender,
            toNumber: cleanPhoneNumber
          },
          hubspotAccountId
        );
        
        engagementId = engagement.id;
        await call.update({ hubspot_engagement_id: engagementId });
        
      } catch (engagementError) {
        logger.error('Failed to create engagement for outbound call', {
          error: engagementError.message,
          callId: call.id
        });
      }
    }

    res.json({
      success: true,
      callId: call.id,
      twilioCallSid: twilioCall.sid,
      engagementId: engagementId,
      status: 'initiated'
    });

  } catch (error) {
    logger.error('Error initiating outbound call', { error: error.message });
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

router.post('/request-permission', async (req, res) => {
  try {
    const { phoneNumber, hubspotAccountId } = req.body;

    if (!phoneNumber || !hubspotAccountId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { HubSpotAccount } = require('../models');
    const account = await HubSpotAccount.findByPk(hubspotAccountId);
    
    if (!account) {
      return res.status(404).json({ error: 'HubSpot account not found' });
    }

    const result = await PermissionService.requestPermissionIfNeeded(
      account.whatsapp_sender,
      phoneNumber.replace('whatsapp:', ''),
      hubspotAccountId
    );

    res.json(result);

  } catch (error) {
    logger.error('Error requesting call permission', { error: error.message });
    res.status(500).json({ error: 'Failed to request permission' });
  }
});

router.get('/permission-status/:phoneNumber/:accountId', async (req, res) => {
  try {
    const { phoneNumber, accountId } = req.params;
    
    const result = await PermissionService.checkCallPermission(
      phoneNumber.replace('whatsapp:', ''),
      accountId
    );

    res.json(result);

  } catch (error) {
    logger.error('Error checking permission status', { error: error.message });
    res.status(500).json({ error: 'Failed to check permission status' });
  }
});

router.get('/history/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const calls = await Call.findAll({
      where: { hubspot_account_id: accountId },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(calls);

  } catch (error) {
    logger.error('Error fetching call history', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

router.post('/availability', async (req, res) => {
  try {
    const { userId, isAvailable } = req.body;
    
    CallRoutingService.setUserAvailability(userId, isAvailable);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating availability', { error: error.message });
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

module.exports = router;