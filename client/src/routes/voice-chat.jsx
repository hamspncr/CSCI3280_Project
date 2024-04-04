import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UsernameContext } from "../main";

const VoiceChat = () => {
  const { username, setUsername } = useContext(UsernameContext);
  const [loading, setLoading] = useState(true);
  //const [username, setUsername] = useState("");
  const [rooms, setRooms] = useState(null);
  const [createRoomInfo, setCreateRoomInfo] = useState({ name: "" });
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
      setLoading(false);

      const request_rooms = {
        event: "get-rooms",
        payload: {},
      };
      ws.current.send(JSON.stringify(request_rooms));
    };

    ws.current.onmessage = ({ data }) => {
      const { event, payload } = JSON.parse(data);
      if (event === "get-rooms") {
        setRooms(payload);
      } else if (event === "create-room") {
        handleRefresh();
      }
    };

    return () => {
      ws.current.close();
    };
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const create_room = {
      event: "create-room",
      payload: {
        name: createRoomInfo.name,
      },
    };
    setCreateRoomInfo({ name: "" });

    ws.current.send(JSON.stringify(create_room));
  };

  const handleRefresh = () => {
    const request_rooms = {
      event: "get-rooms",
      payload: {},
    };
    ws.current.send(JSON.stringify(request_rooms));
  };

  return (
    <>
      {loading ? (
        <div>Connecting to server...</div>
      ) : (
        <div>
          <input
            type="text"
            value={username}
            placeholder="Enter display name:"
            onChange={(e) => setUsername(e.target.value)}
          />
          <hr />
          <h1>Create Room:</h1>
          <form onSubmit={handleCreateRoom}>
            <input
              type="text"
              value={createRoomInfo.name}
              placeholder="Name"
              onChange={(e) => setCreateRoomInfo({ name: e.target.value })}
            />
            <button
              disabled={
                createRoomInfo.name.trim() === "" || username.trim() === ""
              }
              type="submit"
            >
              Create Room
            </button>
          </form>
          <button onClick={handleRefresh}>Refresh rooms</button>
          <h1>Available rooms:</h1>
          <ul>
            {rooms &&
              Object.entries(rooms).map(([id, room]) => (
                <li key={id}><Link disabled to={`/voice-chat/${id}`}>{room.name}</Link></li>
              ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default VoiceChat;
