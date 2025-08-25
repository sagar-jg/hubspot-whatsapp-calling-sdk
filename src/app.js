// src/app.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');

const { sequelize } = require('./models');
const CallRoutingService = require('./services/CallRoutingService');
const logger = require('./utils/logger');

// Import routes
const webhookRoutes = require('./routes/webhooks');
const callingRoutes = require('./routes/calling');
const hubspotRoutes = require('./routes/hubspot');
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing - CRITICAL: Twilio sends form-urlencoded data
app.use('/webhook', express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for calling widget
app.use('/calling-widget', express.static(path.join(__dirname, '../public/calling-widget')));

// Make Socket.IO available to routes
app.set('socketio', io);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/webhook', webhookRoutes);
app.use('/api/calling', callingRoutes);
app.use('/api/hubspot', hubspotRoutes);
app.use('/api/auth', authRoutes);

// Calling widget route
app.get('/calling-widget', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/calling-widget/index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Socket.IO client connected', { socketId: socket.id });

  socket.on('register_user', async (data) => {
    try {
      const { token } = data;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId || decoded.hubspotAccountId;
      
      socket.userId = userId;
      socket.hubspotAccountId = decoded.hubspotAccountId;
      
      socket.join(`user_${userId}`);
      
      CallRoutingService.registerUser(userId, socket.id);
      
      socket.emit('registration_success', { userId });
      logger.info('User registered via Socket.IO', { userId, socketId: socket.id });
      
    } catch (error) {
      logger.error('Socket.IO user registration failed', { error: error.message });
      socket.emit('registration_error', { error: 'Invalid token' });
    }
  });

  socket.on('accept_call', async (data) => {
    try {
      const { callSid, callId } = data;
      
      io.emit('call_accepted', {
        callSid,
        callId,
        acceptedBy: socket.userId
      });
      
      logger.info('Call accepted via Socket.IO', { callSid, userId: socket.userId });
      
    } catch (error) {
      logger.error('Error handling call acceptance', { error: error.message });
    }
  });

  socket.on('reject_call', async (data) => {
    try {
      const { callSid, callId } = data;
      
      io.emit('call_rejected', {
        callSid,
        callId,
        rejectedBy: socket.userId
      });
      
      logger.info('Call rejected via Socket.IO', { callSid, userId: socket.userId });
      
    } catch (error) {
      logger.error('Error handling call rejection', { error: error.message });
    }
  });

  socket.on('update_availability', (data) => {
    try {
      const { isAvailable } = data;
      
      if (socket.userId) {
        CallRoutingService.setUserAvailability(socket.userId, isAvailable);
        logger.info('User availability updated via Socket.IO', { 
          userId: socket.userId, 
          isAvailable 
        });
      }
    } catch (error) {
      logger.error('Error updating user availability', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      CallRoutingService.unregisterUser(socket.userId);
      logger.info('User disconnected from Socket.IO', { 
        userId: socket.userId, 
        socketId: socket.id 
      });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Database connection and server start
async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`🚀 WhatsApp-HubSpot Calling App running on http://localhost:${PORT}`);
      console.log(`📞 Calling Widget: http://localhost:${PORT}/calling-widget`);
      console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    sequelize.close();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    sequelize.close();
    process.exit(0);
  });
});

startServer();

module.exports = app;