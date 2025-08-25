require('dotenv').config();

module.exports = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  whatsappSender: process.env.TWILIO_WHATSAPP_SENDER,
  voiceApplicationSid: process.env.TWILIO_VOICE_APPLICATION_SID,
  callPermissionTemplateSid: process.env.TWILIO_CALL_PERMISSION_TEMPLATE_SID,
  voiceCallTemplateSid: process.env.TWILIO_VOICE_CALL_TEMPLATE_SID
};