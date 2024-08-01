const socket = io();

let username = '';
let avatar = '';

function login() {
    username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    }).then(response => response.json())
      .then(data => {
          if (data.username) {
              avatar = data.avatar;
              socket.emit('registerUser', username);

              // Lưu trữ thông tin đăng nhập vào localStorage
              localStorage.setItem('username', data.username);
              localStorage.setItem('avatar', data.avatar);

              document.getElementById('login').style.display = 'none';
              document.getElementById('chat').style.display = 'flex';

              // Hiển thị tên người dùng đã đăng nhập
              document.getElementById('loggedInUser').textContent = `Logged in as: ${username}`;

              // Làm trống khung tin nhắn để tránh trùng lặp
              const messageContainer = document.getElementById('messageContainer');
              messageContainer.innerHTML = '';

              data.messages.forEach(msg => {
                  displayMessage({
                      message: `${msg.username}: ${msg.message}`,
                      type: msg.username === username ? 'sent' : 'received',
                      time: msg.time,
                      avatar: msg.avatar
                  });
              });
          }             
          // Cập nhật lastMessageTime với thời gian của tin nhắn cuối cùng
          if (data.messages.length > 0) {
              lastMessageTime = data.messages[data.messages.length - 1].time;
          }
      });
}


function logout() {
    socket.emit('logout'); // Emit an event for logout
    localStorage.removeItem('username');
    localStorage.removeItem('avatar');
    document.getElementById('login').style.display = 'block';
    document.getElementById('chat').style.display = 'none';
    username = '';
    avatar = '';
    location.reload(); // Tải lại trang để chắc chắn rằng không còn thông tin người dùng lưu trữ
}

// Thêm sự kiện cho nút đăng xuất
document.getElementById('logoutButton').addEventListener('click', logout);

function register() {
    const registerUsername = document.getElementById('registerUsername').value;
    const registerPassword = document.getElementById('registerPassword').value;
    const registerAvatar = document.getElementById('registerAvatar').files[0];

    const formData = new FormData();
    formData.append('username', registerUsername);
    formData.append('password', registerPassword);
    formData.append('avatar', registerAvatar);

    fetch('/register', {
        method: 'POST',
        body: formData,
    }).then(response => {
        if (response.status === 201) {
            alert('User registered successfully');
        } else {
            response.text().then(text => alert('Error registering user: ' + text));
        }
    });
}

function sendMessage() {
    const message = document.getElementById('messageInput').value;
    if (message.trim() !== '') {
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        socket.emit('sendMessage', { senderId: socket.id, message, username, time: currentTime });
        document.getElementById('messageInput').value = '';
        displayMessage({ message: `You: ${message}`, type: 'sent', time: currentTime, avatar });
    } else {
        alert('Please type a message');
    }
}

socket.on('receiveMessage', (data) => {
    const { senderId, message, username, time, avatar } = data;
    if (senderId !== socket.id) {
        displayMessage({ message: `${username}: ${message}`, type: 'received', time, avatar });
    }
});

socket.on('typing', (username) => {
    const typingElement = document.getElementById('typingIndicator');
    if (!typingElement) {
        const typingIndicator = document.createElement('div');
        typingIndicator.id = 'typingIndicator';
        typingIndicator.textContent = `${username} đang nhập tin nhắn...`;
        document.getElementById('messages').appendChild(typingIndicator);
    }
});

socket.on('stopTyping', (username) => {
    const typingElement = document.getElementById('typingIndicator');
    if (typingElement) {
        typingElement.remove();
    }
});


function displayMessage({ message, type, time, avatar }) {
    const messageContainer = document.getElementById('messageContainer');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;

    const avatarElement = document.createElement('img');
    avatarElement.className = 'avatar';
    avatarElement.src = avatar;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;

    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = time;

    messageElement.appendChild(avatarElement);
    messageElement.appendChild(messageContent);
    messageElement.appendChild(messageTime);

    messageContainer.appendChild(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;

    // Cập nhật lastMessageTime
    lastMessageTime = time;
}

const typingTimeout = 3000; // 3 seconds
let typingTimer;

document.getElementById('messageInput').addEventListener('input', () => {
    socket.emit('typing', username);

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('stopTyping', username);
    }, typingTimeout);
});

document.getElementById('messageInput').addEventListener('blur', () => {
    socket.emit('stopTyping', username);
});

document.getElementById('messageInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
        socket.emit('stopTyping', username);
    }
});

document.addEventListener('DOMContentLoaded', (event) => {
    const storedUsername = localStorage.getItem('username');
    const storedAvatar = localStorage.getItem('avatar');

    if (storedUsername && storedAvatar) {
        username = storedUsername;
        avatar = storedAvatar;
        socket.emit('registerUser', username);

        document.getElementById('login').style.display = 'none';
        document.getElementById('chat').style.display = 'flex';

        // Hiển thị tên người dùng đã đăng nhập
        document.getElementById('loggedInUser').textContent = `Logged in as: ${username}`;

        // Tải lại các tin nhắn từ server
        fetch('/messages')
            .then(response => response.json())
            .then(messages => {
                const messageContainer = document.getElementById('messageContainer');
                messageContainer.innerHTML = '';

                messages.forEach(msg => {
                    displayMessage({
                        message: `${msg.username}: ${msg.message}`,
                        type: msg.username === username ? 'sent' : 'received',
                        time: msg.time,
                        avatar: msg.avatar
                    });
                });
            });
        }
});
//thêm hàm để lấy tin nhắn mới
let lastMessageTime = null;

function fetchNewMessages() {
    let url = '/messages/new';
    if (lastMessageTime) {
        url += `?lastMessageTime=${lastMessageTime}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(messages => {
            if (messages.length > 0) {
                messages.forEach(msg => {
                    displayMessage({
                        message: `${msg.username}: ${msg.message}`,
                        type: msg.username === username ? 'sent' : 'received',
                        time: msg.time,
                        avatar: msg.avatar
                    });
                });

                // Cập nhật lastMessageTime với thời gian của tin nhắn cuối cùng
                lastMessageTime = messages[messages.length - 1].time;
            }
        });
}

// Thiết lập interval để lấy các tin nhắn mới mỗi 1 giây
setInterval(fetchNewMessages, 1000);
