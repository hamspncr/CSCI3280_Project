import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";

const VoiceChat = () => {
  const [messages, setMessages] = useState([]);
  // Code for WebSocket connection (note 'ws' only works in the server, need to use native WebSocket object for frontend)
  /*
    Legacy code (in case it is needed later)
    const ws = new WebSocket("ws://localhost:8000")
    ws.addEventListener('open', () => {
        console.log("Connected to server!")
    })
    */
  const ws = useRef(null)
  const peer = useRef(null)

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000")
    ws.current.onopen = () => {
      console.log("Connected to server!")
    };

    ws.current.onmessage = ({ data }) => {
      const parsedData = JSON.parse(data);
      if (parsedData.type === "message") {
        setMessages((prev) => [...prev, parsedData.message]);
      }
      else if (parsedData.type === "peer-connected") {
        //
      }
      else if (parsedData.type === "peer-disconnected") {
        //
      }
    };

    peer.current = new Peer(undefined, {
      host: "localhost",
      port: 8001,
      path: "/voice-chat",
    });

    peer.current.on("open", (id) => {
      console.log(`Connected to peer server with id ${id}`)
    });

    return () => {
      console.log("Disconnected from server.")
      ws.current.close();
      peer.current.destroy();
    };
  }, []);

  const [text, setText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text) {
      ws.current.send(text);
    }
    setText("");
  };

  // Placeholder CSS styles
  const videoGridCSS = {"display":"grid","gridTemplateColumns":"repeat(auto-fill, 300px)","gridAutoRows":"300px"}
  const videoCSS = {"width":"100%", "height":"100%", "objectFit":"cover"}

  return (
    <>
      <h1>Video</h1>
      <div className="video-grid" style={videoGridCSS}>

      </div>
      <hr />
      <h1>Send messages:</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={text}
          placeholder="Enter text"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Send!</button>
      </form>
      <ul>
        {messages.map((message, i) => (
          <li key={i}>{message}</li>
        ))}
      </ul>
    </>
  );
};

export default VoiceChat;
