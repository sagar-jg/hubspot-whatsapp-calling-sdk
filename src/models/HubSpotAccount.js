// src/models/HubSpotAccount.js
module.exports = (sequelize, DataTypes) => {
  const HubSpotAccount = sequelize.define('HubSpotAccount', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    hubspot_account_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    access_token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    whatsapp_sender: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    calling_settings: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'hubspot_accounts',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['hubspot_account_id'] },
      { fields: ['is_active'] }
    ]
  });

  return HubSpotAccount;
};