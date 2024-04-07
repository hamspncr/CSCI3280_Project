const WebSocket = require('ws')
const crypto = require('crypto')
const { PeerServer } = require("peer");

const peerServer = PeerServer({ port: 8001, path: "/peer-server" });

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
            const response = {
                event: 'get-rooms',
                payload: rooms
            }
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(response))
            }
        } else if (event === 'get-room') {
            const {id} = payload
            const response = {
                event: 'get-room',
                payload: rooms[id]
            }
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(response))
            }
        } else if (event === 'create-room') {
            const {name} = payload
            const id = crypto.randomUUID();
            rooms[id] = {
                name: name,
                users: [],
                messages: []
            }

            const response = {
                event: 'create-room',
                payload: {}
            }
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(response))
                }
            })
            console.log(`Room created with id ${id}, named ${name}`)
        } else if (event === 'join-room') {
            const {id, username, peerId} = payload
            const room = rooms[id]

            const user_info = {
                connection: ws,
                username: username,
                peerId: peerId
            }
            
            if (room) {
                console.log(`${username} joined ${room.name}, ${id}`)
                room.users.push(user_info);

                const response = {
                    event: "join-room",
                    payload: room
                }

                room.users.forEach(user => {
                    if (user.connection.readyState === WebSocket.OPEN) {
                        user.connection.send(JSON.stringify(response));
                    }
                })
            } else {
                console.log(`Room not found`)
            }

        } else if (event === 'leave-room') {
            const {id, username} = payload
            const room = rooms[id]

            if (room) {
                console.log(`${username} left ${room.name}, ${id}`)
                Object.values(rooms).forEach(room => {
                    const index = room.users.findIndex(user => user.connection === ws);
                    if (index !== -1) {
                        const leaver = room.users[index]
                        room.users.splice(index, 1);
        
                        const response = {
                            event: "leave-room",
                            payload: {
                                newRoom: room,
                                leaver: leaver
                            }
                        }
                        room.users.forEach(user => {
                            if (user.connection.readyState === WebSocket.OPEN) {
                                user.connection.send(JSON.stringify(response));
                            }
                        })
                    }
                })

            }
        } else if (event === 'send-message') {
            const {id, messageInfo} = payload
            const room = rooms[id]

            if (room) {
                const response = {
                    event: "send-message",
                    payload: messageInfo
                }
                room.messages.push(messageInfo)
                room.users.forEach(user => {
                    if (user.connection.readyState === WebSocket.OPEN) {
                        user.connection.send(JSON.stringify(response));
                    }
                })
            } else {
                console.log(`Room not found`)
            }
        // Very not done
        } else if (event === 'audio') {
            const {id} = payload
            const room = rooms[id]

            room.users.forEach(user => {
                if (user.connection.readyState === WebSocket.OPEN && user !== ws) {
                    user.connection.send(JSON.stringify(payload));
                }
            })
        }
    })

    ws.on('close', () => {
        console.log("User disconnected")
        Object.values(rooms).forEach(room => {
            const index = room.users.findIndex(user => user.connection === ws);
            if (index !== -1) {
                const leaver = room.users[index]
                room.users.splice(index, 1);

                const response = {
                    event: "leave-room",
                    payload: {
                        newRoom: room,
                        leaver: leaver
                    }
                }
                room.users.forEach(user => {
                    if (user.connection.readyState === WebSocket.OPEN) {
                        user.connection.send(JSON.stringify(response));
                    }
                })
            }
        })
    })
})