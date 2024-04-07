import Peer from "peerjs";
import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UsernameContext } from "../App";
import { audioToArrayBuffer } from "../utils/utils";

const VoiceChatRoom = () => {
  const { roomID } = useParams();
  const { username } = useContext(UsernameContext);
  const [loading, setLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState(null);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(false);

  const navigate = useNavigate();

  const ws = useRef(null);
  const joined = useRef(false);
  const peer = useRef(null);
  const myPeerId = useRef(null);
  const myStream = useRef(null);
  const activeCalls = useRef({});

  const context = useRef(null);
  const gain = useRef(null);
  const activeStreams = useRef({});
  const recorder = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");
    ws.current.onopen = async () => {
      setLoading(false);
      if (!username) {
        console.log("Something bad must've happened");
        navigate("/voice-chat");
      } else {
        context.current = new AudioContext();
        gain.current = context.current.createGain();
        gain.current.gain.value = 0.02; // make this state later
        gain.current.connect(context.current.destination);

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
              console.log("Answering a call from a joined user");
              activeCalls.current[call.peer] = call;
              // const remoteMediaStreamSource =
              //   context.current.createMediaStreamSource(remoteStream);
              // remoteMediaStreamSource.connect(gain.current);
              // context.current.resume();
              const incomingAudio = new Audio();
              incomingAudio.volume = 0.02;
              incomingAudio.srcObject = remoteStream;
              incomingAudio.play();

              activeStreams.current[call.peer] = remoteStream;
              //activeStreams.current.push(remoteStream);
            });
          });
        });
      }
    };

    ws.current.onmessage = ({ data }) => {
      const { event, payload } = JSON.parse(data);
      if (event === "join-room") {
        setRoomInfo(payload);
        if (!joined.current) {
          joined.current = true;
          payload.users.forEach((user) => {
            if (user.peerId !== myPeerId.current) {
              const call = peer.current.call(user.peerId, myStream.current);
              call.on("stream", (remoteStream) => {
                console.log("Calling everybody in the room");
                activeCalls.current[user.peerId] = call;
                // const remoteMediaStreamSource =
                //   context.current.createMediaStreamSource(remoteStream);
                // remoteMediaStreamSource.connect(gain.current);
                // context.current.resume();
                const incomingAudio = new Audio();
                incomingAudio.volume = 0.02;
                incomingAudio.srcObject = remoteStream;
                incomingAudio.play();

                activeStreams.current[user.peerId] = remoteStream;
                //activeStreams.current.push(remoteStream);
              });
            }
          });
        }
      } else if (event === "get-room") {
        setRoomInfo(payload);
      } else if (event === "leave-room") {
        const { newRoom, leaver } = payload;
        console.log(leaver);
        setRoomInfo(newRoom);

        activeCalls.current[leaver.peerId].close();
        delete activeCalls.current[leaver.peerId];
        delete activeStreams.current[leaver.peerId];
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
      activeCalls.current = {};
      activeStreams.current = {};

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

  // saveWave in utils automatically downloads it, this removes that
  const createWave = async (framedata, channels, rate, intPCM = false) => {
    const sample_width = 4; // decodeAudioData always gives floating point 32-bit samples
    const data_chunk_size = framedata.byteLength;
    const fmt_chunk_size = 16;
    const audio_format = intPCM ? 1 : 3; // Pretty much never going to be integer PCM
    const byterate = rate * channels * sample_width;
    const block_align = channels * sample_width;

    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // riff_chunk
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + data_chunk_size, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt_chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, fmt_chunk_size, true);
    view.setUint16(20, audio_format, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, byterate, true);
    view.setUint16(32, block_align, true);
    view.setUint16(34, sample_width * 8, true);

    // data_chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, data_chunk_size, true);

    const blob = new Blob([header, framedata], { type: "audio/wav" });
    const url = await readFileAsDataURL(blob);

    return url;
  };

  const readFileAsDataURL = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result;
        resolve(url);
      };
      reader.readAsDataURL(blob);
    });
  };

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
      if (enabled) {
        setMuted(true);
        myStream.current.getAudioTracks()[0].enabled = false;
      } else {
        setMuted(false);
        myStream.current.getAudioTracks()[0].enabled = true;
      }
    } else {
      console.log("No active stream found, something went wrong");
    }
  };

  const handleRecording = () => {
    if (!recording) {
      const mediaStreamDestination =
        context.current.createMediaStreamDestination();
      // activeStreams.current.forEach((stream) => {
      //   const sourceToDest = context.current.createMediaStreamSource(stream);
      //   sourceToDest.connect(mediaStreamDestination);
      // });

      Object.values(activeStreams.current).forEach((stream) => {
        const sourceToDest = context.current.createMediaStreamSource(stream);
        sourceToDest.connect(mediaStreamDestination);
      });

      const myStreamSource = context.current.createMediaStreamSource(
        myStream.current
      );
      myStreamSource.connect(mediaStreamDestination);

      recorder.current = new MediaRecorder(mediaStreamDestination.stream);

      const chunks = [];

      recorder.current.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      recorder.current.onstop = async () => {
        const combined = new Blob(chunks);
        const buf = await combined.arrayBuffer();
        const audioBuffer = await context.current.decodeAudioData(buf);

        const toSave = audioToArrayBuffer(audioBuffer);
        const url = await createWave(
          toSave,
          audioBuffer.numberOfChannels,
          audioBuffer.sampleRate
        );
        console.log(url);
        const send_message = {
          event: "send-message",
          payload: {
            id: roomID,
            messageInfo: {
              username: username,
              type: "audio/wav",
              content: url,
            },
          },
        };

        ws.current.send(JSON.stringify(send_message));
      };

      recorder.current.start();
      setRecording(true);
    } else {
      recorder.current.stop();
      setRecording(false);
    }
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
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                onClick={handleMute}
              >
                {!muted ? "Mute" : "Unmute"}
              </button>
              <button
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
                onClick={handleRecording}
              >
                {!recording ? "Start Recording" : "Stop Recording"}
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
                {roomInfo.messages.map((message, i) => {
                  if (message.type === "text") {
                    return (
                      <li key={i} className="border-b border-gray-500 py-2">
                        {message.username}: {message.content}
                      </li>
                    );
                  } else if (message.type === "audio/wav") {
                    return (
                      <li key={i}>
                        {message.username}{" "}
                        <a
                          className="text-blue-400 hover:text-blue-600 "
                          href={message.content}
                          download
                        >
                          Recorded the chat, click here to download
                        </a>
                      </li>
                    );
                  }
                })}
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
