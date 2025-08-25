// src/services/HubSpotService.js
const { Client } = require('@hubspot/api-client');
const { HubSpotAccount } = require('../models');
const logger = require('../utils/logger');

class HubSpotService {
  constructor() {
    this.clients = new Map(); // Cache clients by account ID
  }

  async getClient(hubspotAccountId) {
    if (this.clients.has(hubspotAccountId)) {
      return this.clients.get(hubspotAccountId);
    }

    const account = await HubSpotAccount.findOne({
      where: { hubspot_account_id: hubspotAccountId }
    });

    if (!account) {
      throw new Error('HubSpot account not found');
    }

    if (new Date() > account.token_expires_at) {
      await this.refreshAccessToken(account);
    }

    const client = new Client({ accessToken: account.access_token });
    this.clients.set(hubspotAccountId, client);
    return client;
  }

  async searchContactByPhone(phoneNumber, hubspotAccountId) {
    try {
      const client = await this.getClient(hubspotAccountId);
      
      const searchRequest = {
        filterGroups: [{
          filters: [{
            propertyName: 'phone',
            operator: 'EQ',
            value: phoneNumber
          }, {
            propertyName: 'mobilephone',
            operator: 'EQ',
            value: phoneNumber
          }]
        }],
        properties: ['firstname', 'lastname', 'email', 'phone', 'mobilephone', 'hubspot_owner_id'],
        limit: 1
      };

      const response = await client.crm.contacts.searchApi.doSearch(searchRequest);
      
      if (response.results && response.results.length > 0) {
        return response.results[0];
      }

      return null;
    } catch (error) {
      logger.error('Failed to search contact by phone', { 
        error: error.message, 
        phoneNumber 
      });
      throw error;
    }
  }

  async createCallEngagement(contactId, callData, hubspotAccountId) {
    try {
      const client = await this.getClient(hubspotAccountId);

      const engagementData = {
        properties: {
          hs_call_title: `WhatsApp Call - ${callData.direction}`,
          hs_call_body: `WhatsApp ${callData.direction} call ${callData.status}`,
          hs_call_direction: callData.direction.toUpperCase(),
          hs_call_duration: callData.duration || 0,
          hs_call_from_number: callData.fromNumber,
          hs_call_to_number: callData.toNumber,
          hs_call_status: callData.status,
          hs_call_source: 'WhatsApp Business',
          hs_timestamp: new Date().toISOString(),
          ...(callData.recordingUrl && { hs_call_recording_url: callData.recordingUrl })
        }
      };

      const response = await client.crm.objects.calls.basicApi.create(engagementData);
      
      if (contactId) {
        try {
          await client.crm.associations.v4.basicApi.create(
            'calls',
            response.id,
            'contacts',
            contactId,
            [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 194 }]
          );
        } catch (associationError) {
          logger.warn('Failed to create call-contact association', { 
            error: associationError.message,
            callId: response.id,
            contactId 
          });
        }
      }
      
      logger.info('Call engagement created', { 
        engagementId: response.id, 
        contactId 
      });

      return response;
    } catch (error) {
      logger.error('Failed to create call engagement', { 
        error: error.message, 
        contactId 
      });
      throw error;
    }
  }

  async configureCallingSettings(hubspotAccountId, settings) {
    try {
      const client = await this.getClient(hubspotAccountId);

      const callingSettings = {
        name: settings.name || 'WhatsApp Business Calling',
        url: settings.url || `${process.env.BASE_URL}/calling-widget`,
        height: settings.height || 600,
        width: settings.width || 400,
        isReady: true,
        supportsCustomObjects: true
      };

      const response = await client.crm.extensions.calling.settingsApi.create(
        process.env.HUBSPOT_APP_ID,
        callingSettings
      );

      logger.info('Calling settings configured', { 
        hubspotAccountId, 
        settings: callingSettings 
      });

      return response;
    } catch (error) {
      logger.error('Failed to configure calling settings', { 
        error: error.message, 
        hubspotAccountId 
      });
      throw error;
    }
  }

  async refreshAccessToken(account) {
    try {
      const tokenClient = new Client();
      const response = await tokenClient.oauth.tokensApi.create(
        'refresh_token',
        undefined,
        undefined,
        process.env.HUBSPOT_CLIENT_ID,
        process.env.HUBSPOT_CLIENT_SECRET,
        account.refresh_token
      );

      await account.update({
        access_token: response.accessToken,
        refresh_token: response.refreshToken || account.refresh_token,
        token_expires_at: new Date(Date.now() + response.expiresIn * 1000)
      });

      const newClient = new Client({ accessToken: response.accessToken });
      this.clients.set(account.hubspot_account_id, newClient);

      logger.info('Access token refreshed', { 
        hubspotAccountId: account.hubspot_account_id 
      });

    } catch (error) {
      logger.error('Failed to refresh access token', { 
        error: error.message, 
        hubspotAccountId: account.hubspot_account_id 
      });
      throw error;
    }
  }
}

module.exports = new HubSpotService();