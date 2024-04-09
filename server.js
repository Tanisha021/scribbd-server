const express = require('express')
const http = require("http")
const socketIo = require("socket.io")
const redis = require("redis")

const app = express()
const server = http.createServer(app);

//create socket io server
const io = socketIo(server);

//create redish client
const redisClient = redis.createClient();

const CHAT_ROOM_PREFIX = 'chat_room:';
const AVAILABLE_ROOMS_KEY = 'available_rooms';

//socket.io event connection
io.on('connection', socket => {
    
    //join room
    socket.on('joinRoom', room => {
      socket.join(room);
      redisClient.sadd(`${CHAT_ROOM_PREFIX}${room}:active_users`, socket.id);
      redisClient.sadd(AVAILABLE_ROOMS_KEY, room);
  
      socket.to(room).emit('userJoin', socket.id);
      updateAvailableRooms();
    });
  
    //send message
    socket.on('sendMessage', ({ room, message }) => {
      redisClient.rpush(`${CHAT_ROOM_PREFIX}${room}:messages`, JSON.stringify({
        user: socket.id,
        message,
        // timestamp: Date.now(),
      }));
      io.to(room).emit('message', {
        user: socket.id,
        message,
        // timestamp: Date.now(),
      });
    });
  
    socket.on('disconnect', () => {
      redisClient.smembers(AVAILABLE_ROOMS_KEY, (err, rooms) => {
        if (err) {
          console.error(err);
          return;
        }
  
        rooms.forEach(room => {
          redisClient.smembers(`${CHAT_ROOM_PREFIX}${room}:active_users`, (err, members) => {
            if (err) {
              console.error(err);
              return;
            }
            //filter the active memeber left in room
            const remainingUsers = members.filter(member => member !== socket.id);
            
            // Update Active Users in the Room
            redisClient.del(`${CHAT_ROOM_PREFIX}${room}:active_users`);
            remainingUsers.forEach(user => redisClient.sadd(`${CHAT_ROOM_PREFIX}${room}:active_users`, user));
          });
  
          socket.to(room).emit('userLeave', socket.id);
        });
  
        updateAvailableRooms();
      });
    });
  
    function updateAvailableRooms() {
      redisClient.smembers(AVAILABLE_ROOMS_KEY, (err, rooms) => {
        if (err) {
          console.error(err);
          return;
        }
  
        io.emit('updateRooms', Array.from(rooms));
      });
    }
  });
  
  server.listen(3000, () => {
    console.log('Server running on port 3000');
  });