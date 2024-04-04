const WebSocket = require ('ws')
const crypto = require('crypto');

const wss = new WebSocket.Server({ port: 8000 })

const rooms = {
"0b01c8f2-e484-41a4-932a-e1af9f959d0b": {
name: "test-room",
users: [],
messages: []
}
}

const broadcastRoomInfo = (rooms) => {
wss.clients.forEach(client => {
if (client.readyState === WebSocket.OPEN) {
client.send(JSON.stringify(rooms))
}
})
}

wss.on('connection', ws => {
console.log("User connected")

ws.on('message', message => {
    const {event, payload} = JSON.parse(message)
    if (event === 'get-rooms') {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(rooms))
        }
    } else if (event === 'create-room') {
        const {name} = payload
        const id = crypto.randomUUID();
        rooms[id] = {
            name: name,
            users: [],
            messages: []
        }
        // Now broadcast the updated rooms to all clients
        broadcastRoomInfo({ event: 'update-rooms', payload: rooms });

    } else if (event === 'join-room') {
        const {id, username} = payload
        const room = rooms[id]

        const user_info = {
            connection: ws,
            username: username
        }
        
        console.log(`User ${username} joined room ${id}`)
        if (room) {
            console.log(`User joined ${room.name}`)
            room.users.push(user_info);

            room.users.forEach(user => {
                if (user.connection.readyState === WebSocket.OPEN) {
                    user.connection.send(JSON.stringify(room));
                }
            })
        } else {
            console.log(`Room not found`)
        }

    } else if (event === 'send-message') {
        const {username, id, text} = payload
        const room = rooms[id]

        if (room) {
            const msg = {
                name: username,
                content: text
            }
            room.messages.push(msg)
            room.users.forEach(user => {
                if (user.connection.readyState === WebSocket.OPEN) {
                    user.connection.send(JSON.stringify(msg));
                }
            })
        } else {
            console.log(`Room not found`)
        }
    }
})

ws.on('close', () => {
    console.log("User disconnected")
    Object.values(rooms).forEach(room => {
        const index = room.users.findIndex(user => user.connection === ws);
        if (index !== -1) {
            room.users.splice(index, 1);
        }
    })
})
})