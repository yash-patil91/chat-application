const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Enable CORS to allow connections from your frontend
        methods: ["GET", "POST"]
    }
});
app.use(cors());

mongoose.connect('mongodb://localhost:27017/chat', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const messageSchema = new mongoose.Schema({
    content: String,
    sender: String, // Username of the sender
    receiver: String, // Username of the receiver
    timeStamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('MongoDB connected successfully');
});

// Manage socket connections
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('message', async ({ content, sender, receiver }) => {
        // Save message in the database
        const message = new Message({ content, sender, receiver });
        await message.save();

        // Emit the message to the receiver only
        socket.broadcast.emit(`message:${receiver}`, message);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

app.use(express.json());

// Fetch all messages between two users
app.get('/api/messages/:sender/:receiver', async (req, res) => {
    const { sender, receiver } = req.params;
    try {
        const messages = await Message.find({
            $or: [
                { sender, receiver },
                { sender: receiver, receiver: sender }
            ]
        });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/message', async (req, res) => {
    const { content, sender, receiver } = req.body;
    try {
        const message = new Message({ content, sender, receiver });
        await message.save();
        io.emit(`message:${receiver}`, message);
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

server.listen(5000, () => {
    console.log('Server running on port 5000');
});
