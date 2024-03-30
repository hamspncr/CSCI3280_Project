const WebSocket = require ('ws')

const wss = new WebSocket.Server({ port: 8000 })

wss.on('connection', ws => {

    console.log("a user has connected :))")

    // Listen for messages being sent to server from clients
    ws.on('message', data => {
        console.log("Message received: " + data)
    })

    // Listen for close
    ws.on('close', () => {
        console.log("byebye user :(")
    })
})