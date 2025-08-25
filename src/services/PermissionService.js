// src/services/PermissionService.js
const { CallPermission } = require('../models');
const TwilioService = require('./TwilioService');
const logger = require('../utils/logger');

class PermissionService {
  async checkCallPermission(phoneNumber, hubspotAccountId) {
    const permission = await CallPermission.findOne({
      where: {
        contact_phone: phoneNumber,
        hubspot_account_id: hubspotAccountId
      }
    });

    if (!permission) {
      return { hasPermission: false, reason: 'no_permission_record' };
    }

    if (permission.permission_status !== 'granted') {
      return { 
        hasPermission: false, 
        reason: 'permission_not_granted',
        status: permission.permission_status 
      };
    }

    if (permission.expires_at && new Date() > permission.expires_at) {
      await permission.update({ permission_status: 'expired' });
      return { hasPermission: false, reason: 'permission_expired' };
    }

    return { hasPermission: true, permission };
  }

  async requestPermissionIfNeeded(fromNumber, toNumber, hubspotAccountId) {
    const permissionCheck = await this.checkCallPermission(toNumber, hubspotAccountId);
    
    if (permissionCheck.hasPermission) {
      return { status: 'granted', permission: permissionCheck.permission };
    }

    const canRequest = await this.canRequestPermission(toNumber, hubspotAccountId);
    
    if (!canRequest.allowed) {
      return { status: 'rate_limited', reason: canRequest.reason };
    }

    try {
      await TwilioService.requestCallPermission(fromNumber, toNumber, hubspotAccountId);
      return { status: 'permission_requested' };
    } catch (error) {
      logger.error('Failed to request permission', { error: error.message });
      return { status: 'error', error: error.message };
    }
  }

  async handlePermissionResponse(phoneNumber, response, hubspotAccountId) {
    try {
      const permission = await CallPermission.findOne({
        where: {
          contact_phone: phoneNumber,
          hubspot_account_id: hubspotAccountId,
          permission_status: 'pending'
        }
      });

      if (!permission) {
        logger.warn('Permission response received but no pending request found', { phoneNumber });
        return;
      }

      const updateData = {
        permission_status: response === 'ACCEPTED' ? 'granted' : 'denied'
      };

      if (response === 'ACCEPTED') {
        updateData.granted_at = new Date();
        updateData.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }

      await permission.update(updateData);
      
      logger.info('Permission response processed', { 
        phoneNumber, 
        response, 
        status: updateData.permission_status 
      });

    } catch (error) {
      logger.error('Failed to handle permission response', { 
        error: error.message, 
        phoneNumber 
      });
      throw error;
    }
  }

  async canRequestPermission(phoneNumber, hubspotAccountId) {
    const permission = await CallPermission.findOne({
      where: {
        contact_phone: phoneNumber,
        hubspot_account_id: hubspotAccountId
      }
    });

    if (!permission) {
      return { allowed: true };
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (permission.last_request_at && permission.last_request_at > twentyFourHoursAgo) {
      return { 
        allowed: false, 
        reason: 'rate_limited_24h',
        nextAllowedAt: new Date(permission.last_request_at.getTime() + 24 * 60 * 60 * 1000)
      };
    }

    const recentRequests = await CallPermission.count({
      where: {
        contact_phone: phoneNumber,
        hubspot_account_id: hubspotAccountId,
        last_request_at: {
          [require('sequelize').Op.gte]: sevenDaysAgo
        }
      }
    });

    if (recentRequests >= 2) {
      return { 
        allowed: false, 
        reason: 'rate_limited_7d',
        requestCount: recentRequests
      };
    }

    return { allowed: true };
  }
}

module.exports = new PermissionService();