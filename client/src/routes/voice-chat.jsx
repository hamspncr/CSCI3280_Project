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
  const my_id = useRef(null)
  const myStream = useRef(null)

  useEffect(() => {
    peer.current = new Peer(undefined, {
      host: "localhost",
      port: 8001,
      path: "/voice-chat",
    });

    peer.current.on("open", (id) => {
      console.log(`Connected to peer server with id ${id}`)
      my_id.current = id
    });

    peer.current.on("call", (call) => {
      console.log("Received a call")
      call.answer(myStream.current)
    })

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
        console.log(`${parsedData.join_id} has joined`)
        let all_user_ids = parsedData.user_ids
        console.log(all_user_ids)
        handleConnection(all_user_ids)
      }
      else if (parsedData.type === "peer-disconnected") {
        console.log(`${parsedData.leaver_id} has left`)
        let leaver_id = parsedData.leaver_id
        handleLeaving(leaver_id)
      }
    };

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      const video = document.createElement('video')
      video.id = my_id.current
      video.srcObject = stream
      myStream.current = stream
      video.play()
      document.querySelector(".video-grid").append(video)
    })

    const handleConnection = (all_ids) => {
      all_ids.forEach(user_id => {
        if (user_id != my_id.current) {
          const call = peer.current.call(user_id, myStream.current)
          // console.log(call)
          call.on("stream", userStream => {
            console.log("call received")
            /*
            const video = document.createElement('video')
            video.id = user_id
            video.srcObject = userVideoStream
            video.play()
            document.querySelector(".video-grid").append(video)
            */
          })   
        }
      })
    }

    
    const handleLeaving = (leaver_id) => {
      document.querySelectorAll(".video-grid video").forEach(video => {
        if (video.id === leaver_id) {
          video.remove()
        }
      })
    }
    

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

  /*
  navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
    streamRef.current = stream
    const video = document.createElement('video')
    video.srcObject = stream
    video.play()
    document.querySelector('.video-grid').append(video)
  })
  */

  // Placeholder CSS styles
  const videoGridCSS = {"display":"grid","gridTemplateColumns":"repeat(auto-fill, 300px)","gridAutoRows":"300px"}
  const videoCSS = {"width":"100%", "height":"100%", "objectFit":"cover"}

  return (
    <>
      <h1>Video</h1>
      <div className="video-grid" style={videoGridCSS}></div>
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
