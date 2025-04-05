// public/app.js - Updated for remote connections
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loginScreen = document.getElementById('loginScreen');
  const chatContainer = document.getElementById('chatContainer');
  const nameInput = document.getElementById('nameInput');
  const passwordInput = document.getElementById('passwordInput');
  const loginButton = document.getElementById('loginButton');
  const messagesContainer = document.getElementById('messages');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');
  const recordButton = document.getElementById('recordButton');
  const stopRecordButton = document.getElementById('stopRecordButton');
  const recordingIndicator = document.getElementById('recordingIndicator');
  const recordingTime = document.getElementById('recordingTime');
  const quickBtn1 = document.getElementById('quickBtn1');
  const quickBtn2 = document.getElementById('quickBtn2');
  const quickBtn3 = document.getElementById('quickBtn3');
  const quickMsg1 = document.getElementById('quickMsg1');
  const quickMsg2 = document.getElementById('quickMsg2');
  const quickMsg3 = document.getElementById('quickMsg3');
  const saveQuickMsgsBtn = document.getElementById('saveQuickMsgs');
  const wallpaperOptions = document.querySelectorAll('.wallpaper-option');
  const userStatusDiv = document.getElementById('userStatus');
  
  // Constants - shared password can be changed
  const SHARED_PASSWORD = "your-shared-secret-password";
  
  // App state
  let username = '';
  let socket;
  let mediaRecorder;
  let audioChunks = [];
  let recordingInterval;
  let recordingSeconds = 0;
  
  // Load saved settings
  loadSettings();
  
  // Event Listeners
  loginButton.addEventListener('click', login);
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') passwordInput.focus();
  });
  
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
  
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  recordButton.addEventListener('click', startRecording);
  stopRecordButton.addEventListener('click', stopRecording);
  
  quickBtn1.addEventListener('click', () => fillQuickMessage(1));
  quickBtn2.addEventListener('click', () => fillQuickMessage(2));
  quickBtn3.addEventListener('click', () => fillQuickMessage(3));
  
  saveQuickMsgsBtn.addEventListener('click', saveQuickMessages);
  
  // Keyboard shortcuts for quick messages
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === '1' || e.key === '2' || e.key === '3') && chatContainer.classList.contains('chat-container')) {
      e.preventDefault();
      fillQuickMessage(parseInt(e.key));
    }
  });
  
  // Wallpaper selection
  wallpaperOptions.forEach(option => {
    option.addEventListener('click', () => {
      const wallpaper = option.getAttribute('data-wallpaper');
      setWallpaper(wallpaper);
      localStorage.setItem('chatWallpaper', wallpaper);
    });
  });
  
  // Functions
  function login() {
    if (nameInput.value.trim() === '') {
      alert('Please enter your name');
      return;
    }
    
    if (passwordInput.value !== SHARED_PASSWORD) {
      alert('Incorrect password');
      return;
    }
    
    username = nameInput.value.trim();
    
    // Connect to Socket.IO
    socket = io();
    
    // Register user
    socket.emit('register-user', username, passwordInput.value, (response) => {
      if (response.success) {
        loginScreen.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        // Listen for messages
        socket.on('chat-message', receiveMessage);
        socket.on('new-voice-message', receiveVoiceMessage);
        socket.on('user-status', updateUserStatus);
        socket.on('user-list', initializeUserList);
        
        // Update quick message buttons
        updateQuickButtons();
        
        // Set saved wallpaper
        const savedWallpaper = localStorage.getItem('chatWallpaper') || 'default';
        setWallpaper(savedWallpaper);
      } else {
        alert(response.message);
      }
    });
  }
  
  function initializeUserList(users) {
    userStatusDiv.innerHTML = '';
    users.forEach(user => {
      addUserStatus(user, user === username ? 'You (Online)' : 'Online');
    });
  }
  
  function updateUserStatus(userData) {
    const { username: user, status } = userData;
    addUserStatus(user, status === 'online' ? 'Online' : 'Offline');
  }
  
  function addUserStatus(user, status) {
    const existingUser = document.getElementById(`user-${user}`);
    
    if (existingUser) {
      existingUser.querySelector('.status-indicator').className = 
        `status-indicator ${status.toLowerCase().includes('online') ? 'online' : 'offline'}`;
      existingUser.querySelector('.status-text').textContent = status;
    } else {
      const userEl = document.createElement('div');
      userEl.id = `user-${user}`;
      userEl.className = 'user-status-item';
      userEl.innerHTML = `
        <div class="status-indicator ${status.toLowerCase().includes('online') ? 'online' : 'offline'}"></div>
        <div class="user-name">${user}</div>
        <div class="status-text">${status}</div>
      `;
      userStatusDiv.appendChild(userEl);
    }
  }
  
  function sendMessage() {
    const message = messageInput.value.trim();
    if (message === '') return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    socket.emit('chat-message', {
      sender: username,
      content: message,
      timestamp
    });
    
    messageInput.value = '';
  }
  
  function receiveMessage(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', msg.sender === username ? 'self' : 'other');
    
    messageDiv.innerHTML = `
      ${msg.sender !== username ? `<div class="message-sender">${msg.sender}</div>` : ''}
      <div class="message-content">${msg.content}</div>
      <div class="message-time">${msg.timestamp}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }
  
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };
      
      mediaRecorder.onstop = sendVoiceMessage;
      
      // Start recording
      mediaRecorder.start();
      recordButton.classList.add('hidden');
      stopRecordButton.classList.remove('hidden');
      recordingIndicator.classList.remove('hidden');
      
      // Recording timer
      recordingSeconds = 0;
      updateRecordingTime();
      recordingInterval = setInterval(updateRecordingTime, 1000);
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check your permissions.");
    }
  }
  
  function updateRecordingTime() {
    recordingSeconds++;
    const minutes = Math.floor(recordingSeconds / 60);
    const seconds = recordingSeconds % 60;
    recordingTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      
      // Stop all audio tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      
      // Reset UI
      stopRecordButton.classList.add('hidden');
      recordButton.classList.remove('hidden');
      recordingIndicator.classList.add('hidden');
      
      // Clear timer
      clearInterval(recordingInterval);
    }
  }
  
  function sendVoiceMessage() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    // Create FormData and send to server
    const formData = new FormData();
    formData.append('audio', audioBlob);
    
    // Send as binary data to server
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/upload-voice?sender=${encodeURIComponent(username)}`, true);
    xhr.send(audioBlob);
  }
  
  function receiveVoiceMessage(msg) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', msg.sender === username ? 'self' : 'other');
    
    const audioUrl = `/voice-messages/${msg.filename}`;
    const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
      ${msg.sender !== username ? `<div class="message-sender">${msg.sender}</div>` : ''}
      <div class="voice-message">
        <audio controls src="${audioUrl}"></audio>
      </div>
      <div class="message-time">${timestamp}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }
  
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  function fillQuickMessage(number) {
    const quickMessages = JSON.parse(localStorage.getItem('quickMessages') || '{}');
    const message = quickMessages[`msg${number}`];
    
    if (message) {
      messageInput.value = message;
      messageInput.focus();
    }
  }
  
  function saveQuickMessages() {
    const quickMessages = {
      msg1: quickMsg1.value.trim(),
      msg2: quickMsg2.value.trim(),
      msg3: quickMsg3.value.trim()
    };
    
    localStorage.setItem('quickMessages', JSON.stringify(quickMessages));
    updateQuickButtons();
    alert('Quick messages saved!');
  }
  
  function updateQuickButtons() {
    const quickMessages = JSON.parse(localStorage.getItem('quickMessages') || '{}');
    
    quickBtn1.textContent = quickMessages.msg1 ? 
      (quickMessages.msg1.length > 10 ? quickMessages.msg1.substring(0, 7) + '...' : quickMessages.msg1) : 
      'Quick 1';
      
    quickBtn2.textContent = quickMessages.msg2 ? 
      (quickMessages.msg2.length > 10 ? quickMessages.msg2.substring(0, 7) + '...' : quickMessages.msg2) : 
      'Quick 2';
      
    quickBtn3.textContent = quickMessages.msg3 ? 
      (quickMessages.msg3.length > 10 ? quickMessages.msg3.substring(0, 7) + '...' : quickMessages.msg3) : 
      'Quick 3';
  }
  
  function setWallpaper(wallpaper) {
    messagesContainer.setAttribute('data-wallpaper', wallpaper);
    
    // Adjust text colors based on wallpaper
    if (wallpaper === 'gradient') {
      messagesContainer.classList.add('dark-wallpaper');
    } else {
      messagesContainer.classList.remove('dark-wallpaper');
    }
  }
  
  function loadSettings() {
    // Load quick messages
    const quickMessages = JSON.parse(localStorage.getItem('quickMessages') || '{}');
    quickMsg1.value = quickMessages.msg1 || '';
    quickMsg2.value = quickMessages.msg2 || '';
    quickMsg3.value = quickMessages.msg3 || '';
  }
});
