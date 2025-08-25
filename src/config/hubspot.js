require('dotenv').config();

module.exports = {
  clientId: process.env.HUBSPOT_CLIENT_ID,
  clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
  appId: process.env.HUBSPOT_APP_ID,
  redirectUri: process.env.HUBSPOT_REDIRECT_URI,
  scopes: [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.calls.read',
    'crm.objects.calls.write',
    'crm.objects.owners.read',
    'crm.associations.read',
    'crm.associations.write',
    'settings.calling.read',
    'settings.calling.write'
  ]
};