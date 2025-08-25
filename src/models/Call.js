// src/models/Call.js
module.exports = (sequelize, DataTypes) => {
  const Call = sequelize.define('Call', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    twilio_call_sid: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    hubspot_contact_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    hubspot_engagement_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    hubspot_account_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    from_number: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    to_number: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    call_direction: {
      type: DataTypes.ENUM('inbound', 'outbound'),
      allowNull: false
    },
    call_status: {
      type: DataTypes.ENUM('initiated', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy'),
      defaultValue: 'initiated'
    },
    call_duration: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    recording_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    transcription: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    contact_owner_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'calls',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['twilio_call_sid'] },
      { fields: ['hubspot_contact_id'] },
      { fields: ['hubspot_account_id'] },
      { fields: ['call_status'] }
    ]
  });

  return Call;
};