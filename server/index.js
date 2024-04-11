const fs = require("fs");
const https = require("https");
const WebSocket = require("ws");
const crypto = require("crypto");

const options = {
  cert: fs.readFileSync("../voice-record-chat.crt"),
  key: fs.readFileSync("../private.key"),
};

const server = https.createServer(options);

const wss = new WebSocket.Server({ server });

// Stores all room information like a dictionary. Key is the id, value is the room information
// Obviously won't persist if server is restarted
const rooms = {
  "0b01c8f2-e484-41a4-932a-e1af9f959d0b": {
    name: "test-room",
    users: [],
    messages: [],
  },
};

// This is more of a template than anything, unused
const broadcastRoomInfo = (rooms) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(rooms));
    }
  });
};

wss.on("connection", (ws) => {
  console.log("User connected");

  ws.on("message", (message) => {
    // "event" is the type of message we're getting. We handle each events differently
    const { event, payload } = JSON.parse(message);
    if (event === "get-rooms") {
      // Some connection requested all room info, used when showing list of all rooms
      const response = {
        event: "get-rooms",
        payload: rooms,
      };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    } else if (event === "get-room") {
      // Some connection requested the room info with a specific id, used when trying to join a room
      const { id } = payload;
      const response = {
        event: "get-room",
        payload: rooms[id],
      };
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(response));
      }
    } else if (event === "create-room") {
      // Some connection requests to create a room
      const { name } = payload;
      const id = crypto.randomUUID();
      rooms[id] = {
        name: name,
        users: [],
        messages: [],
      };

      const response = {
        event: "create-room",
        payload: {},
      };

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response));
        }
      });
      console.log(`Room created with id ${id}, named ${name}`);
    } else if (event === "join-room") {
      // Some connection requests to join a room with specific id
      const { id, username, userId } = payload;
      const room = rooms[id];

      const user_info = {
        connection: ws,
        username: username,
        userId: userId,
      };

      if (room) {
        console.log(`${username} joined ${room.name}, ${id}`);
        room.users.push(user_info);

        const response = {
          event: "join-room",
          payload: room,
        };

        room.users.forEach((user) => {
          if (user.connection.readyState === WebSocket.OPEN) {
            user.connection.send(JSON.stringify(response));
          }
        });
      } else {
        console.log(`Room not found`);
      }
    } else if (event === "leave-room") {
      // Some connection (deliberately) left the room
      const { id, username } = payload;
      const room = rooms[id];

      if (room) {
        console.log(`${username} left ${room.name}, ${id}`);
        Object.values(rooms).forEach((room) => {
          const index = room.users.findIndex((user) => user.connection === ws);
          if (index !== -1) {
            const leaver = room.users[index];
            room.users.splice(index, 1);

            const response = {
              event: "leave-room",
              payload: {
                newRoom: room,
                leaver: leaver,
              },
            };
            room.users.forEach((user) => {
              if (user.connection.readyState === WebSocket.OPEN) {
                user.connection.send(JSON.stringify(response));
              }
            });
          }
        });
      }
    } else if (event === "send-message") {
      // Some user sent a text message OR recorded audio
      const { id, messageInfo } = payload;
      const room = rooms[id];

      if (room) {
        const response = {
          event: "send-message",
          payload: messageInfo,
        };
        room.messages.push(messageInfo);
        room.users.forEach((user) => {
          if (user.connection.readyState === WebSocket.OPEN) {
            user.connection.send(JSON.stringify(response));
          }
        });
      } else {
        console.log(`Room not found`);
      }
    } else if (event === "reaction") {
      // Some user added a reaction to any of the messages
      const { id, messageInfo } = payload;
      const room = rooms[id];

      if (room) {
        const { messageId, reactionType } = messageInfo;
        const response = {
          event: "reaction",
          payload: messageInfo,
        };
        room.messages.forEach((message) => {
          if (message.messageId === messageId) {
            message.reactions[reactionType] += 1;
          }
        });
        room.users.forEach((user) => {
          if (user.connection.readyState === WebSocket.OPEN) {
            user.connection.send(JSON.stringify(response));
          }
        });
      } else {
        console.log(`Room not found`);
      }
    } else if (event === "audio") {
      // Legacy method of broadcasting audio, WebRTC performs way better and
      // is actually P2P so we're using that
      const { id } = payload;
      const room = rooms[id];

      room.users.forEach((user) => {
        if (user.connection.readyState === WebSocket.OPEN && user !== ws) {
          user.connection.send(JSON.stringify(payload));
        }
      });
    } else if (event === "send-offer") {
      // Some connection sends a WebRTC offer, this will redirect the offer to the appropriate user
      const { id, receiverId } = payload;
      const room = rooms[id];

      const response = {
        event: "send-offer",
        payload: payload,
      };

      room.users.forEach((user) => {
        if (user.userId === receiverId) {
          user.connection.send(JSON.stringify(response));
        }
      });
    } else if (event === "send-answer") {
      // Some connection received an offer and created their WebRTC answer, this will redirect to the appropriate user
      const { id, receiverId } = payload;
      const room = rooms[id];

      const response = {
        event: "send-answer",
        payload: payload,
      };

      room.users.forEach((user) => {
        if (user.userId === receiverId) {
          user.connection.send(JSON.stringify(response));
        }
      });
    } else if (event === "send-ice-candidate") {
      // Some connection found ice candidates to use for their connection, redirects to the appropriate user
      // An ice candidate is a potential route from a user's ip to their actual browser tab
      // Users can't just directly connect from receiving their ip, the ice candidate is the specific
      // route they can use to reach each other, creating a P2P connection between them
      const { id, receiverId } = payload;
      const room = rooms[id];

      const response = {
        event: "send-ice-candidate",
        payload: payload,
      };

      room.users.forEach((user) => {
        if (user.userId === receiverId) {
          user.connection.send(JSON.stringify(response));
        }
      });
    }
  });

  ws.on("close", () => {
    console.log("User disconnected");
    Object.values(rooms).forEach((room) => {
      const index = room.users.findIndex((user) => user.connection === ws);
      if (index !== -1) {
        const leaver = room.users[index];
        room.users.splice(index, 1);

        const response = {
          event: "leave-room",
          payload: {
            newRoom: room,
            leaver: leaver,
          },
        };
        
        // This happens when a user accidentally disconnects (closes browser tab) the same event
        // is used because there really isn't any meaningful difference to both scenarios
        room.users.forEach((user) => {
          if (user.connection.readyState === WebSocket.OPEN) {
            user.connection.send(JSON.stringify(response));
          }
        });
      }
    });
  });
});

server.listen(8000, process.env.HOST || undefined);
