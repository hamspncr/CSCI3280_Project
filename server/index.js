const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8000 });

wss.on("connection", (ws) => {
  console.log("a user has connected :))");

  ws.on("message", (message) => {
    // Receiving binary data (like your voice)
    if (message instanceof Buffer) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    } else {
      try {
        const data = JSON.parse(message);
        const { event } = data;
        if (event === "text-chat") {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
  });

  ws.on("close", () => {
    console.log("byebye user :(");
  });
});
