import { useEffect, useRef, useState } from "react";

const VoiceChat = () => {
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(false);
  // Code for WebSocket connection (note 'ws' only works in the server, need to use native WebSocket object for frontend)
  /*
    Legacy code (in case it is needed later)
    const ws = new WebSocket("ws://localhost:8000")
    ws.addEventListener('open', () => {
        console.log("Connected to server!")
    })
    */
  const ws = useRef(null);

  const context = useRef(null);
  const gain = useRef(null);
  const recorder = useRef(null);
  const compressor = useRef(null);
  const recordInterval = useRef(null);

  const id = useRef(crypto.randomUUID());

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");
    ws.current.onopen = () => {
      console.log("Connected to server!");

      context.current = new AudioContext();
      gain.current = context.current.createGain();
      gain.current.connect(context.current.destination);
      compressor.current = context.current.createDynamicsCompressor();
      compressor.current.threshold.setValueAtTime(-50, context.current.currentTime);
      compressor.current.knee.setValueAtTime(40, context.current.currentTime);
      compressor.current.ratio.setValueAtTime(12, context.current.currentTime);
      compressor.current.attack.setValueAtTime(0, context.current.currentTime);
      compressor.current.release.setValueAtTime(0.25, context.current.currentTime);
      compressor.current.connect(gain.current.destination);
    };

    ws.current.onmessage = async (message) => {
      if (message.data instanceof Blob) {
        gain.current.gain.value = 0.02;

        const source = context.current.createBufferSource();
        source.buffer = await context.current.decodeAudioData(
          await message.data.arrayBuffer()
        );
        source.connect(gain.current);
        source.start();
        console.log(message.data);
      } else {
        try {
          const { event, payload } = JSON.parse(message.data);
          if (event === "text-chat") {
            const { text } = payload;
            setMessages((prev) => [...prev, text]);
          }
        } catch (error) {
          console.error(error);
        }
      }
    };

    return () => {
      ws.current.close();
    };
  }, []);

  const [text, setText] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text) {
      const data = {
        event: "text-chat",
        payload: {
          text: text,
          user: id.current,
        },
      };
      ws.current.send(JSON.stringify(data));
    }
    setText("");
  };

  const handleRecording = async () => {
    if (!recording) {
      const formatting = {
        audio: {
          channelCount: 1,
          sampleSize: 16,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(formatting);
      recorder.current = new MediaRecorder(stream);

      recorder.current.ondataavailable = (e) => {
        ws.current.send(e.data);
      };

      recorder.current.start();
      setRecording(true);

      recordInterval.current = setInterval(() => {
        recorder.current.stop();
        recorder.current.start();
      }, 200); // If you make it any smaller the audio gets way choppier
    } else {
      clearInterval(recordInterval.current);
      recorder.current.stop();
      setRecording(false);
    }
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
      <button onClick={handleRecording}>send audio</button>
      <ul>
        {messages.map((message, i) => (
          <li key={i}>{message}</li>
        ))}
      </ul>
    </>
  );
};

export default VoiceChat;
