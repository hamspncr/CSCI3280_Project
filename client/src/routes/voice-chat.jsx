import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UsernameContext } from "../main";

const VoiceChat = () => {
  const { username, setUsername } = useContext(UsernameContext);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState(null);
  const [createRoomInfo, setCreateRoomInfo] = useState({ name: "" });
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
        <div className="bg-gray-800 min-h-screen text-white p-4">
          Connecting to server...
        </div>
      ) : (
        <div className="bg-gray-800 min-h-screen text-white p-4">
          <input
            className="border text-sm rounded-lg p-2.5 bg-gray-700 border-gray-600 placeholder-gray-400"
            type="text"
            value={username}
            placeholder="Enter display name:"
            onChange={(e) => setUsername(e.target.value)}
          />
          <hr />
          <h1>Create Room:</h1>
          <form onSubmit={handleCreateRoom}>
            <input
              className="border text-sm rounded-lg p-2.5 bg-gray-700 border-gray-600 placeholder-gray-400"
              type="text"
              value={createRoomInfo.name}
              placeholder="Name"
              onChange={(e) => setCreateRoomInfo({ name: e.target.value })}
            />
            <button
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
              disabled={
                createRoomInfo.name.trim() === "" || username.trim() === ""
              }
              type="submit"
            >
              Create Room
            </button>
          </form>
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
            onClick={handleRefresh}
          >
            Refresh room info
          </button>
          <table className="table-auto w-full mb-4">
            <thead>
              <tr className="bg-gray-700">
                <th className="px-4 py-2">Room Name</th>
                <th className="px-4 py-2">Users</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms &&
                Object.entries(rooms).map(([id, room]) => (
                  <tr key={id} className="bg-gray-600">
                    <td className="border px-4 py-2">{room.name}</td>
                    <td className="border px-4 py-2">
                      {`${room.users
                        .map((user) => `${user.username}, `)
                        .join("")}`}
                    </td>
                    <td className="border px-4 py-2">
                      {username && (
                        <Link disabled to={`/voice-chat/${id}`}>
                          Join
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default VoiceChat;
