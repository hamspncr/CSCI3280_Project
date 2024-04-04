import { useEffect, useRef, useState } from "react";

const VoiceChat = () => {
  const [rooms, setRooms] = useState({});
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");
    ws.current.onopen = () => {
      console.log("Connected to server!");
      // Request the current list of rooms when the connection is opened
      ws.current.send(JSON.stringify({ event: 'get-rooms' }));
    };
  
    ws.current.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.event === 'update-rooms') {
        // Assuming the server sends an event 'update-rooms' with the updated list
        setRooms(message.payload);
      } else if (message.event === 'room-messages') {
        // Handle incoming messages for a room
        setCurrentRoomId(message.payload.id);
        setMessages(message.payload.messages);
      }
    };
  
    return () => {
      ws.current.close();
    };
  }, []);

  const handleCreateRoom = () => {
    const newRoomName = prompt("Enter room name:");
    if (newRoomName) {
      ws.current.send(JSON.stringify({ event: 'create-room', payload: { name: newRoomName } }));
    }
  };

  const handleJoinRoom = (roomId) => {
    const username = prompt("Enter your username:");
    if (username) {
      ws.current.send(JSON.stringify({ event: 'join-room', payload: { id: roomId, username: username } }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text && currentRoomId) {
      ws.current.send(JSON.stringify({ event: 'send-message', payload: { username: 'YourUsername', id: currentRoomId, text } }));
      setText("");
    }
  };

  return (
    <div className="bg-gray-800 min-h-screen text-white p-4">
      <h1 className="text-2xl font-bold mb-4">Voice Chat Rooms</h1>
      <button
        onClick={handleCreateRoom}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
      >
        Create Room
      </button>
      <table className="table-auto w-full mb-4">
        <thead>
          <tr className="bg-gray-700">
            <th className="px-4 py-2">Room Name</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(rooms).map(([id, room]) => (
            <tr key={id} className="bg-gray-600">
              <td className="border px-4 py-2">{room.name}</td>
              <td className="border px-4 py-2">
                <button
                  onClick={() => handleJoinRoom(id)}
                  className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded"
                >
                  Join
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {currentRoomId && (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-bold">Chat</h2>
            <ul className="mb-4 h-64 overflow-auto bg-gray-700 p-3">
              {messages.map((message, i) => (
                <li key={i} className="border-b border-gray-500 py-2">{message.name}: {message.content}</li>
              ))}
            </ul>
          </div>
          <form onSubmit={handleSubmit} className="mb-4 flex">
            <input
              type="text"
              value={text}
              placeholder="Enter text"
              onChange={(e) => setText(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
            <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px```jsx
4 rounded ml-2">Send</button>
          </form>
        </>
      )}
    </div>
  );
};

export default VoiceChat;