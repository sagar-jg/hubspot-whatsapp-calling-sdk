// src/models/CallPermission.js
module.exports = (sequelize, DataTypes) => {
  const CallPermission = sequelize.define('CallPermission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    contact_phone: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    hubspot_account_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    permission_status: {
      type: DataTypes.ENUM('pending', 'granted', 'denied', 'expired', 'revoked'),
      defaultValue: 'pending'
    },
    granted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    request_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_request_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'call_permissions',
    timestamps: true,
    underscored: true,
    indexes: [
      { 
        fields: ['contact_phone', 'hubspot_account_id'],
        unique: true
      },
      { fields: ['permission_status'] },
      { fields: ['expires_at'] }
    ]
  });

  return CallPermission;
};