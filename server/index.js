const WebSocket = require ('ws')
const { PeerServer } = require("peer")

const peerServer = PeerServer({ port: 8001, path: "/voice-chat" })

const wss = new WebSocket.Server({ port: 8000 })

const connectedUsers = new Set()

peerServer.on('connection', (client) => { 
    console.log(`PeerJS: New client connected with id=${client.id}`);
    connectedUsers.add(client.id);
    console.log("Connected users: ", connectedUsers)
    wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'peer-connected', join_id: client.id, user_ids: Array.from(connectedUsers)}));
        }
    });
});
  
peerServer.on('disconnect', (client) => { 
    console.log(`PeerJS: Client disconnected with id=${client.id}`);
    connectedUsers.delete(client.id);
    console.log("Connected users: ", connectedUsers)
    wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'peer-disconnected', leaver_id: client.id, user_ids: Array.from(connectedUsers)}));
        }
    });
});

wss.on('connection', ws => {
    console.log(`User connected`)

    // Listen for messages being sent to server from clients
    ws.on('message', message => {
        console.log(`Broadcasting ${message} to all users`) 
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'message', message: message.toString()}))
            }
        })
    })

    // Listen for close
    ws.on('close', () => {
        console.log(`User disconnected`)
    })
})