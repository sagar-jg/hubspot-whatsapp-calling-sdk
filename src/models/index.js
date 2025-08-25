// src/models/index.js
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: 'postgres',
  logging: config.logging,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Import models
const Call = require('./Call')(sequelize, Sequelize.DataTypes);
const CallPermission = require('./CallPermission')(sequelize, Sequelize.DataTypes);
const HubSpotAccount = require('./HubSpotAccount')(sequelize, Sequelize.DataTypes);

// Define associations
Call.belongsTo(HubSpotAccount, { foreignKey: 'hubspot_account_id' });
CallPermission.belongsTo(HubSpotAccount, { foreignKey: 'hubspot_account_id' });

const models = {
  Call,
  CallPermission,
  HubSpotAccount,
  sequelize,
  Sequelize
};

module.exports = models;