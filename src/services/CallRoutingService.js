// src/services/CallRoutingService.js
const { Call } = require('../models');
const HubSpotService = require('./HubSpotService');
const logger = require('../utils/logger');

class CallRoutingService {
  constructor() {
    this.activeUsers = new Map(); // Track online users
  }

  registerUser(userId, socketId) {
    this.activeUsers.set(userId, {
      socketId,
      lastSeen: new Date(),
      isAvailable: true
    });
    
    logger.info('User registered as online', { userId, socketId });
  }

  unregisterUser(userId) {
    this.activeUsers.delete(userId);
    logger.info('User unregistered', { userId });
  }

  async routeIncomingCall(fromNumber, toNumber, callSid, hubspotAccountId) {
    try {
      const contact = await HubSpotService.searchContactByPhone(fromNumber, hubspotAccountId);
      
      let contactOwnerId = null;
      let routingDecision = 'fallback';

      if (contact && contact.properties.hubspot_owner_id) {
        contactOwnerId = contact.properties.hubspot_owner_id;
        
        if (this.activeUsers.has(contactOwnerId)) {
          const userInfo = this.activeUsers.get(contactOwnerId);
          if (userInfo.isAvailable) {
            routingDecision = 'owner';
          } else {
            routingDecision = 'owner_busy';
          }
        } else {
          routingDecision = 'owner_offline';
        }
      } else {
        routingDecision = 'no_contact_or_owner';
      }

      const call = await Call.create({
        twilio_call_sid: callSid,
        hubspot_contact_id: contact ? contact.id : null,
        hubspot_account_id: hubspotAccountId,
        from_number: fromNumber,
        to_number: toNumber,
        call_direction: 'inbound',
        contact_owner_id: contactOwnerId,
        call_status: 'initiated'
      });

      logger.info('Call routed', { 
        callSid, 
        routingDecision, 
        contactOwnerId,
        contactId: contact?.id 
      });

      return {
        call,
        contact,
        contactOwnerId,
        routingDecision,
        userInfo: contactOwnerId ? this.activeUsers.get(contactOwnerId) : null
      };

    } catch (error) {
      logger.error('Failed to route incoming call', { 
        error: error.message, 
        callSid 
      });
      throw error;
    }
  }

  setUserAvailability(userId, isAvailable) {
    if (this.activeUsers.has(userId)) {
      const userInfo = this.activeUsers.get(userId);
      userInfo.isAvailable = isAvailable;
      userInfo.lastSeen = new Date();
      
      logger.info('User availability updated', { userId, isAvailable });
    }
  }

  getUserInfo(userId) {
    return this.activeUsers.get(userId);
  }
}

module.exports = new CallRoutingService();