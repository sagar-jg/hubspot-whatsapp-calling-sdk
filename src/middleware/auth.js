// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { HubSpotAccount } = require('../models');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
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

    req.user = {
      userId: decoded.userId,
      hubspotAccountId: decoded.hubspotAccountId,
      account: account
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    logger.error('Authentication error', { error: error.message });
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticateToken };