import Peer from "peerjs";
import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UsernameContext } from "../main";

const VoiceChatRoom = () => {
  const { roomID } = useParams();
  const { username } = useContext(UsernameContext);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const ws = useRef(null);
  const peer = useRef(null);
  const myPeerId = useRef(null);
  const myStream = useRef(null);
  const activeCalls = useRef({});

  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const startRecording = () => {
    mediaRecorderRef.current = new MediaRecorder(myStream.current, {
      mimeType: 'audio/webm',
    });
    
    mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    });
    
    mediaRecorderRef.current.addEventListener('stop', () => {
      const audioBlob = new Blob(recordedChunksRef.current, {
        type: 'audio/webm',
      });
      const audioUrl = URL.createObjectURL(audioBlob);
      const newRecording = {
        url: audioUrl,
        blob: audioBlob,
      };
      setRecordings((prevRecordings) => [...prevRecordings, newRecording]);
      recordedChunksRef.current = [];
    });
    
    mediaRecorderRef.current.start();
    setIsRecording(true);
  };
  
  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");
    ws.current.onopen = async () => {
      setLoading(false);
      if (!username) {
        console.log("Something bad must've happened");
        navigate("/voice-chat");
      } else {
        myStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        const get_room = {
          event: "get-room",
          payload: {
            id: roomID,
          },
        };

        ws.current.send(JSON.stringify(get_room));

        peer.current = new Peer(undefined, {
          host: "localhost",
          port: 8001,
          path: "/peer-server",
        });

        peer.current.on("open", (id) => {
          myPeerId.current = id;
          const join_room = {
            event: "join-room",
            payload: {
              id: roomID,
              username: username,
              peerId: id,
            },
          };
          ws.current.send(JSON.stringify(join_room));

          peer.current.on("call", (call) => {
            call.answer(myStream.current);
            call.on("stream", (remoteStream) => {
              const incomingAudio = new Audio();
              incomingAudio.volume = 1;
              incomingAudio.srcObject = remoteStream;
              incomingAudio.play();
            });
          });
        });
      }
    };

    ws.current.onmessage = ({ data }) => {
      const { event, payload } = JSON.parse(data);
      if (event === "join-room") {
        setRoomInfo(payload);
        if (!joined) {
          setJoined(true);
          payload.users.forEach((user) => {
            if (user.peerId !== myPeerId.current) {
              const call = peer.current.call(user.peerId, myStream.current);
              activeCalls.current[user.peerId] = call;
              call.on("stream", (remoteStream) => {
                const incomingAudio = new Audio();
                incomingAudio.volume = 0.02;
                incomingAudio.srcObject = remoteStream;
                incomingAudio.play();
              });
            }
          });
        }
      } else if (event === "get-room") {
        setRoomInfo(payload);
      } else if (event === "leave-room") {
        const { newRoom, leaver } = payload;
        console.log(leaver)
        setRoomInfo(newRoom);

        activeCalls.current[leaver.peerId].close();
        delete activeCalls.current[leaver.peerId];
      } else if (event === "send-message") {
        setRoomInfo((prev) => ({
          ...prev,
          messages: [...prev.messages, payload],
        }));
      }
    };

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(activeCalls.current).forEach((call) => call.close());

      if (peer.current) {
        peer.current.destroy();
      }
      if (myStream.current) {
        myStream.current = null;
      }
      ws.current.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMessage = (e) => {
    e.preventDefault();

    if (message.trim() !== "") {
      const send_message = {
        event: "send-message",
        payload: {
          id: roomID,
          messageInfo: {
            username: username,
            type: "text",
            content: message,
          },
        },
      };

      ws.current.send(JSON.stringify(send_message));
    }
    setMessage("");
  };

  const handleLeaveRoom = () => {
    const leave_room = {
      event: "leave-room",
      payload: {
        id: roomID,
        username: username,
      },
    };

    ws.current.send(JSON.stringify(leave_room));
    navigate("/voice-chat");
  };

  const handleMute = () => {
    if (myStream.current) {
      const enabled = myStream.current.getAudioTracks()[0].enabled;
      const button = document.querySelector(".shut-up");
      if (enabled) {
        myStream.current.getAudioTracks()[0].enabled = false;
        button.innerHTML = "speak";
        alert("You have been muted");
      } else {
        myStream.current.getAudioTracks()[0].enabled = true;
        button.innerHTML = "shh";
        alert("You have been unmuted");
      }
    } else {
      alert("No active stream found");
      console.log("No active stream found, something went wrong")
    }
  }

  return (
    <>
      {!username ? (
        <div className="bg-gray-800 min-h-screen text-white p-4">
          {`You shouldn't be here (probably disconnected?)`}
        </div>
      ) : loading ? (
        <div className="bg-gray-800 min-h-screen text-white p-4">
          Connecting to server...
        </div>
      ) : !roomInfo ? (
        <div className="bg-gray-800 min-h-screen text-white p-4">
          Room not found
        </div>
      ) : !joined ? (
        <div className="bg-gray-800 min-h-screen text-white p-4">
          Joining room
        </div>
      ) : (
        <div className="bg-gray-800 min-h-screen text-white p-4">
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
            onClick={handleLeaveRoom}
          >
            Leave
          </button>
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold">Voice Controls</h2>
              <button
                className="shut-up bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                onClick={handleMute}
              >
                shh
              </button>
            </div>
          </div>
          <table className="table-auto w-full mb-4">
            <thead>
              <tr className="bg-gray-700">
                <th className="px-4 py-2">Users</th>
              </tr>
            </thead>
            <tbody>
              {roomInfo.users &&
                roomInfo.users.map((user, i) => (
                  <tr key={i} className="bg-gray-600">
                    <td className="border px-4 py-2">{user.username}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold">Chat</h2>
              <ul className="mb-4 h-64 overflow-auto bg-gray-700 p-3">
                {roomInfo.messages.map((message, i) => (
                  <li key={i} className="border-b border-gray-500 py-2">
                    {message.username}: {message.content}
                  </li>
                ))}
              </ul>
            </div>
            <form onSubmit={handleMessage} className="mb-4 flex">
              <input
                className="w-full border text-sm rounded-lg p-2.5 bg-gray-700 border-gray-600 placeholder-gray-400"
                type="text"
                value={message}
                placeholder="Enter text"
                onChange={(e) => setMessage(e.target.value)}
              />
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ml-2"
              >
                Send
              </button>
            </form>
          </div>
          <div>
            <h2 className="text-xl font-bold">Recordings</h2>
            {isRecording ? (
              <button
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                onClick={stopRecording}
              >
                Stop Recording
              </button>
            ) : (
              <button
                className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
                onClick={startRecording}
              >
                Start Recording
              </button>
            )}
            
            <ul>
              {recordings.map((recording, index) => (
                <li key={index}>
                  <audio controls src={recording.url}></audio>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceChatRoom;
