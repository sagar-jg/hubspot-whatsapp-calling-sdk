module.exports = {
  CALL_STATUSES: {
    INITIATED: 'initiated',
    RINGING: 'ringing',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    NO_ANSWER: 'no-answer',
    BUSY: 'busy'
  },
  
  CALL_DIRECTIONS: {
    INBOUND: 'inbound',
    OUTBOUND: 'outbound'
  },
  
  PERMISSION_STATUSES: {
    PENDING: 'pending',
    GRANTED: 'granted',
    DENIED: 'denied',
    EXPIRED: 'expired',
    REVOKED: 'revoked'
  },
  
  PERMISSION_LIMITS: {
    MAX_REQUESTS_24H: 1,
    MAX_REQUESTS_7D: 2,
    PERMISSION_DURATION_DAYS: 7,
    MAX_CALLS_24H: 5
  },
  
  SOCKET_EVENTS: {
    REGISTER_USER: 'register_user',
    INCOMING_CALL: 'incoming_call',
    CALL_STATUS_UPDATE: 'call_status_update',
    ACCEPT_CALL: 'accept_call',
    REJECT_CALL: 'reject_call',
    UPDATE_AVAILABILITY: 'update_availability'
  }
};