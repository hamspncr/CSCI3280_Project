const WebSocket = require ('ws')

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

            console.log(`Room created with id ${id}, named ${name}`)
        } else if (event === 'join-room') {
            const {id, username} = payload
            const room = rooms[id]

            const user_info = {
                connection: ws,
                username: username
            }
            
            if (room) {
                room.users.push(user_info);
                console.log(`User joined ${room.name}`)
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
            } else {
                console.log(`Room not found`)
            }

            rooms.users.forEach(user => {
                if (user.readyState === WebSocket.OPEN) {
                    user.send(JSON.stringify(msg));
                }
            })
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