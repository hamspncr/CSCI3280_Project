import { useEffect, useRef, useState } from "react";

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
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");
    ws.current.onopen = () => {
      console.log("Connected to server!");
    };

    ws.current.onmessage = ({ data }) => {
      setMessages((prev) => [...prev, data]);
    };

    return () => {
      ws.current.close();
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

  return (
    <>
      <h1>Send sound data: </h1>
      <button>Click me to mute/unmute</button>
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
