// src/routes/hubspot.js
const express = require('express');
const { Client } = require('@hubspot/api-client');
const jwt = require('jsonwebtoken');
const { HubSpotAccount } = require('../models');
const HubSpotService = require('../services/HubSpotService');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/install', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const hubspotClient = new Client();
    const tokenResponse = await hubspotClient.oauth.tokensApi.create(
      'authorization_code',
      code,
      process.env.HUBSPOT_REDIRECT_URI,
      process.env.HUBSPOT_CLIENT_ID,
      process.env.HUBSPOT_CLIENT_SECRET
    );

    hubspotClient.setAccessToken(tokenResponse.accessToken);
    const accountInfo = await hubspotClient.oauth.accessTokensApi.get(tokenResponse.accessToken);

    const account = await HubSpotAccount.upsert({
      hubspot_account_id: accountInfo.hubId.toString(),
      access_token: tokenResponse.accessToken,
      refresh_token: tokenResponse.refreshToken,
      token_expires_at: new Date(Date.now() + tokenResponse.expiresIn * 1000),
      is_active: true
    });

    try {
      await HubSpotService.configureCallingSettings(accountInfo.hubId.toString(), {
        name: 'WhatsApp Business Calling',
        url: `${process.env.BASE_URL}/calling-widget`
      });
    } catch (settingsError) {
      logger.error('Failed to configure calling settings during installation', {
        error: settingsError.message,
        hubspotAccountId: accountInfo.hubId
      });
    }

    const token = jwt.sign(
      { 
        hubspotAccountId: accountInfo.hubId.toString(),
        userId: accountInfo.userId 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info('HubSpot app installed successfully', { 
      hubspotAccountId: accountInfo.hubId 
    });

    res.redirect(`${process.env.FRONTEND_URL}/installation-complete?token=${token}`);

  } catch (error) {
    logger.error('Error during HubSpot installation', { error: error.message });
    res.status(500).json({ error: 'Installation failed' });
  }
});

router.get('/config/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const account = await HubSpotAccount.findOne({
      where: { hubspot_account_id: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({
      accountId: account.hubspot_account_id,
      whatsappSender: account.whatsapp_sender,
      callingSettings: account.calling_settings,
      isActive: account.is_active
    });

  } catch (error) {
    logger.error('Error fetching account config', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

router.post('/config/:accountId/whatsapp-sender', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { whatsappSender } = req.body;

    const account = await HubSpotAccount.findOne({
      where: { hubspot_account_id: accountId }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.update({ whatsapp_sender: whatsappSender });

    res.json({ success: true });

  } catch (error) {
    logger.error('Error updating WhatsApp sender', { error: error.message });
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

module.exports = router;