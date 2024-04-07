import Peer from "peerjs";
import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UsernameContext } from "../App";

const VoiceChatRoom = () => {
  const { roomID } = useParams();
  const { username } = useContext(UsernameContext);
  const [loading, setLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState(null);
  const [message, setMessage] = useState("");

  const navigate = useNavigate();
  const ws = useRef(null);

  const joined = useRef(false);
  const roomInfoRef = useRef(roomInfo);
  const peer = useRef(null);
  const myPeerId = useRef(null);
  const myStream = useRef(null);
  const activeCalls = useRef({});

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
              console.log("Answering a call from a joined user")
              activeCalls.current[call.peer] = call;
              const incomingAudio = new Audio();
              incomingAudio.volume = 0.02;
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
        roomInfoRef.current = payload;
        if (!joined.current) {
          joined.current = true;
          payload.users.forEach((user) => {
            if (user.peerId !== myPeerId.current) {
              const call = peer.current.call(user.peerId, myStream.current);
              call.on("stream", (remoteStream) => {
                console.log("Calling everybody in the room")
                activeCalls.current[user.peerId] = call;
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
        roomInfoRef.current = payload;
      } else if (event === "leave-room") {
        const { newRoom, leaver } = payload;
        setRoomInfo(newRoom);
        roomInfoRef.current = newRoom;
        activeCalls.current[leaver.peerId].close();
        delete activeCalls.current[leaver.peerId];
      } else if (event === "send-message") {
        setRoomInfo((prev) => ({
          ...prev,
          messages: [...prev.messages, payload],
        }));
        roomInfoRef.current = {...roomInfoRef.current, messages: [...roomInfoRef.current.messages, payload]}
      } else if (event === "reaction") {
        // Updating reactions on client side
        const currentRoomInfo = roomInfoRef.current
        const targetMessageId = payload.messageId
        const targetReaction = payload.reactionType
        let newReactionCount = 0
        
        currentRoomInfo.messages.forEach(message => {
          if (message.id === targetMessageId) {
            message.reactions[targetReaction] += 1
            console.log(`Reaction for ${targetMessageId} of type ${targetReaction} is now ${message.reactions[targetReaction]}`)
            newReactionCount = message.reactions[targetReaction]
          }
        })
        
        // Show visual changes on front-end
        const reactionsContainer = document.querySelector(`#${targetMessageId} .reactions-container`)
        if (targetReaction === "good") {
          reactionsContainer.querySelector(".reaction-good").textContent = newReactionCount
        } else if (targetReaction === "love") {
          reactionsContainer.querySelector(".reaction-love").textContent = newReactionCount
        } else if (targetReaction === "haha") {
          reactionsContainer.querySelector(".reaction-haha").textContent = newReactionCount
        } else if (targetReaction === "fire") {
          reactionsContainer.querySelector(".reaction-fire").textContent = newReactionCount
        } else if (targetReaction === "bad") {
          reactionsContainer.querySelector(".reaction-bad").textContent = newReactionCount
        } else {
          console.log(`Invalid reaction type ${targetReaction}`)
        }
        
        setRoomInfo(currentRoomInfo)
        roomInfoRef.current = currentRoomInfo
        console.log(roomInfoRef.current)
      }
    };

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(activeCalls.current).forEach((call) => call.close());
      activeCalls.current = {};

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
            id: "reaction-" + Math.trunc(Math.random() * 100000000).toString(),  // Each message is assigned its own unique ID
            reactions: {
              good: 0,
              love: 0,
              haha: 0,
              fire: 0,
              bad: 0,
            },
            content: message,
          },
        },
      };

      ws.current.send(JSON.stringify(send_message));
    }
    setMessage("");
  };

  const handleReaction = (messageId, reactionType) => {
    // console.log(`Reaction for ${messageId} of type ${reactionType}`)
    const reaction = {
      event: "reaction",
      payload: {
        id: roomID,
        messageInfo : {
          messageId: messageId,
          reactionType: reactionType,
        }
      }
    }

    ws.current.send(JSON.stringify(reaction))
  }

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
          Finding room...
        </div>
      ) : (
        <div className="bg-gray-800 min-h-screen text-white p-4">
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
            onClick={handleLeaveRoom}
          >
            Leave
          </button>
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
                  <li key={i} className="border-b border-gray-500 py-2" id={message.id}>
                    {message.username}: {message.content}
                    <br/>
                    <span className="reactions-container border-2 rounded-lg border-white inline-flex flex-auto gap-2">
                      <button onClick={() => handleReaction(message.id, "good")}>👍 <span className="reaction-good">{message.reactions["good"] || 0}</span></button>
                      <button onClick={() => handleReaction(message.id, "love")}>❤️ <span className="reaction-love">{message.reactions["love"] || 0}</span></button>
                      <button onClick={() => handleReaction(message.id, "haha")}>😂 <span className="reaction-haha">{message.reactions["haha"] || 0}</span></button>
                      <button onClick={() => handleReaction(message.id, "fire")}>🔥 <span className="reaction-fire">{message.reactions["fire"] || 0}</span></button>
                      <button onClick={() => handleReaction(message.id, "bad")}>🖕 <span className="reaction-bad">{message.reactions["bad"] || 0}</span></button>
                    </span>
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
        </div>
      )}
    </>
  );
};

export default VoiceChatRoom;
