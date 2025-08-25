// src/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { HubSpotAccount } = require('../models');

const router = express.Router();

router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const account = await HubSpotAccount.findOne({
      where: { 
        hubspot_account_id: decoded.hubspotAccountId,
        is_active: true 
      }
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found or inactive' });
    }

    res.json({
      valid: true,
      userId: decoded.userId,
      hubspotAccountId: decoded.hubspotAccountId,
      account: {
        id: account.id,
        whatsappSender: account.whatsapp_sender,
        callingSettings: account.calling_settings
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({ error: 'Token validation failed' });
  }
});

module.exports = router;