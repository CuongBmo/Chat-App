const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const NodeRSA = require('node-rsa');
const cloudinary = require('./config/cloudinaryConfig'); // Import Cloudinary

const { generateAndSaveKeys, loadKeys } = require('./keys');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage });

mongoose.connect('mongodb+srv://cuong:123@cluster0.zwotlpk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(() => {
    console.log('Đã kết nối đến MongoDB');
}).catch((err) => {
    console.error('Lỗi kết nối đến MongoDB:', err);
});

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    avatar: String,
});

const User = mongoose.model('User', userSchema);

const chatSchema = new mongoose.Schema({
    senderId: String,
    username: String,
    message: String,
    time: String,
    avatar: String,
});

const Chat = mongoose.model('Chat', chatSchema);

if (!fs.existsSync('./public.key') || !fs.existsSync('./private.key')) {
    generateAndSaveKeys();
}

const { publicKey, privateKey } = loadKeys();
const key = new NodeRSA();
key.importKey(privateKey, 'private');

app.post('/register', upload.single('avatar'), async (req, res) => {
    const { username, password } = req.body;
    let avatar = null;

    if (req.file) {
        try {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'avatars',
                use_filename: true,
                unique_filename: false
            });
            avatar = result.secure_url;
            fs.unlinkSync(req.file.path); // Xóa file sau khi upload
        } catch (error) {
            console.error('Lỗi khi upload avatar:', error);
            return res.status(500).send('Lỗi khi upload avatar');
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
        username,
        password: hashedPassword,
        avatar,
    });

    try {
        await newUser.save();
        res.status(201).send('Đăng ký thành công');
    } catch (err) {
        console.error('Lỗi khi đăng ký:', err);
        if (err.code === 11000) { // Duplicate username
            return res.status(400).send('Tên người dùng đã tồn tại');
        }
        res.status(500).send('Lỗi khi đăng ký');
    }
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
        return res.status(400).send('Không tìm thấy người dùng');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(400).send('Mật khẩu không đúng');
    }

    const messages = await Chat.find({});
    const decryptedMessages = messages.map(msg => ({
        ...msg._doc,
        message: key.decrypt(msg.message, 'utf8')
    }));

    res.status(200).send({ username: user.username, avatar: user.avatar, messages: decryptedMessages });
});

const connectedUsers = {};

io.on('connection', (socket) => {
    console.log('Một người dùng đã kết nối:', socket.id);

    socket.on('registerUser', async (username) => {
        console.log('Đăng ký người dùng:', username);
        connectedUsers[socket.id] = { username, id: socket.id };
        io.emit('userList', Object.values(connectedUsers));
        
        // Gửi tin nhắn lịch sử đến người dùng mới kết nối
        const messages = await Chat.find({});
        const decryptedMessages = messages.map(msg => ({
            ...msg._doc,
            message: key.decrypt(msg.message, 'utf8')
        }));
        socket.emit('historicalMessages', decryptedMessages);
    });

    socket.on('sendMessage', async (data) => {
        const { senderId, message, username, time } = data;
        console.log(`Gửi tin nhắn từ ${username}`);

        const user = await User.findOne({ username });

        const encryptedMessage = key.encrypt(message, 'base64');

        const chatMessage = new Chat({
            senderId,
            username,
            message: encryptedMessage,
            time,
            avatar: user.avatar,
        });

        await chatMessage.save();

        io.emit('receiveMessage', { senderId, message, username, time, avatar: user.avatar });
    });

    socket.on('typing', (username) => {
        socket.broadcast.emit('typing', username);
    });

    socket.on('stopTyping', (username) => {
        socket.broadcast.emit('stopTyping', username);
    });

    socket.on('disconnect', () => {
        console.log('Người dùng ngắt kết nối:', socket.id);
        delete connectedUsers[socket.id];
        io.emit('userList', Object.values(connectedUsers));
    });
});

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});

app.get('/messages', async (req, res) => {
    const messages = await Chat.find({});
    const decryptedMessages = messages.map(msg => ({
        ...msg._doc,
        message: key.decrypt(msg.message, 'utf8')
    }));

    res.status(200).send(decryptedMessages);
});
//endpoint để lấy các tin nhắn mới
app.get('/messages/new', async (req, res) => {
    const lastMessageTime = req.query.lastMessageTime;
    const messages = await Chat.find({ time: { $gt: lastMessageTime } });
    const decryptedMessages = messages.map(msg => ({
        ...msg._doc,
        message: key.decrypt(msg.message, 'utf8')
    }));

    res.status(200).send(decryptedMessages);
});
