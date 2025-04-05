// server.js - Updated for remote deployment
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Store registered users (for this private two-person chat)
const authorizedUsers = new Set();
const MAX_USERS = 2;

// Store voice messages
const voiceMessagesDir = path.join(__dirname, 'voice_messages');
if (!fs.existsSync(voiceMessagesDir)) {
  fs.mkdirSync(voiceMessagesDir);
}

// Handle voice message uploads
app.post('/upload-voice', (req, res) => {
  const timestamp = Date.now();
  const filename = `voice_${timestamp}.webm`;
  const filePath = path.join(voiceMessagesDir, filename);
  
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    fs.writeFile(filePath, buffer, err => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error saving voice message');
      }
      io.emit('new-voice-message', { 
        filename, 
        sender: req.query.sender,
        timestamp
      });
      res.status(200).send({ filename });
    });
  });
});

// Serve voice messages
app.get('/voice-messages/:filename', (req, res) => {
  const filePath = path.join(voiceMessagesDir, req.params.filename);
  res.sendFile(filePath);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected');
  let currentUser = null;
  
  // Register user
  socket.on('register-user', (username, password, callback) => {
    // If we already have 2 users and this username isn't one of them
    if (authorizedUsers.size >= MAX_USERS && !authorizedUsers.has(username)) {
      callback({ success: false, message: 'Chat is full (max 2 users)' });
      return;
    }
    
    // Add user to authorized list if new
    if (!authorizedUsers.has(username)) {
      authorizedUsers.add(username);
    }
    
    currentUser = username;
    callback({ success: true });
    
    // Notify others of user status
    socket.broadcast.emit('user-status', { username, status: 'online' });
    
    // Send current user list to the new user
    const onlineUsers = Array.from(authorizedUsers);
    socket.emit('user-list', onlineUsers);
  });
  
  // Handle text messages
  socket.on('chat-message', (msg) => {
    io.emit('chat-message', msg);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected');
    if (currentUser) {
      socket.broadcast.emit('user-status', { username: currentUser, status: 'offline' });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
