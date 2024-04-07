import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UsernameContext } from "../App";

const VoiceChatRoom = () => {
  const { roomID } = useParams();
  const { username } = useContext(UsernameContext);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");
    ws.current.onopen = () => {
      setLoading(false);
      if (!username) {
        console.log("Something bad must've happened");
        navigate("/voice-chat");
      } else {
        const get_room = {
          event: "get-room",
          payload: {
            id: roomID,
          },
        };

        ws.current.send(JSON.stringify(get_room));

        const join_room = {
          event: "join-room",
          payload: {
            id: roomID,
            username: username,
          },
        };

        console.log(join_room);
        ws.current.send(JSON.stringify(join_room));
      }
    };

    ws.current.onmessage = ({ data }) => {
      const { event, payload } = JSON.parse(data);
      if (event === "join-room") {
        setJoined(true);
        setRoomInfo(payload);
      } else if (event === "get-room") {
        setRoomInfo(payload);
      } else if (event === "leave-room") {
        setRoomInfo(payload);
      } else if (event === "send-message") {
        setRoomInfo((prev) => ({
          ...prev,
          messages: [...prev.messages, payload],
        }));
      }
    };

    return () => {
      ws.current.close();
    };
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
    navigate("/voice-chat")
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
        </div>
      )}
    </>
  );
};

export default VoiceChatRoom;
