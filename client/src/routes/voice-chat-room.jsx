import { useContext, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { UsernameContext } from "../main";

const VoiceChatRoom = () => {
  const { roomID } = useParams();
  const { username } = useContext(UsernameContext);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");
    ws.current.onopen = () => {
      setLoading(false);
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

      console.log(join_room)
      ws.current.send(JSON.stringify(join_room));
    };

    ws.current.onmessage = ({ data }) => {
      const { event, payload } = JSON.parse(data);
      if (event === "join-room") {
        setJoined(true);
        setRoomInfo(payload);
      } else if (event === "get-room") {
        setRoomInfo(payload);
      }
    };

    return () => {
      ws.current.close();
    };
  }, []);

  return (
    <>
      {loading ? (
        <div>Connecting to server...</div>
      ) : !roomInfo ? (
        <div>Room not found</div>
      ) : !joined ? (
        <div>Joining room</div>
      ) : (
        <div>
          {roomInfo.users.map((user, i) => (
            <li key={i}>{user.username}</li>
          ))}
        </div>
      )}
    </>
  );
};

export default VoiceChatRoom;
