import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as Tone from 'tone';
import { UsernameContext } from "../App";
import { audioToArrayBuffer } from "../utils/utils";

const VoiceChatRoom = () => {
  const { roomID } = useParams();
  const { username, userId, voiceChanger } = useContext(UsernameContext);
  const [loading, setLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState(null);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(false);

  const navigate = useNavigate();

  const ws = useRef(null);
  const joined = useRef(false);
  const roomInfoRef = useRef(null);
  //const myStream = useRef(null);
  const peerConnectionObjects = useRef({});
  const activeStreams = useRef({});
  const userMediaRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const destNodeRef = useRef(null);

  const context = useRef(null);
  const recorder = useRef(null);

  useEffect(() => {
    const hostName = import.meta.env.VITE_HOST || "localhost";
    const wssUrl = "wss://" + hostName + ":8000";
    ws.current = new WebSocket(wssUrl);
    ws.current.onopen = async () => {
      setLoading(false);
      if (!username) {
        console.log("Something bad must've happened");
        navigate("/voice-chat");
      } else {
        context.current = new AudioContext();
        
        /*
        myStream.current = await navigator.mediaDevices.getUserMedia({
          audio: true,
          noiseSuppression: true,
          echoCancellation: true,
        });
        */

        userMediaRef.current = new Tone.UserMedia();
        await userMediaRef.current.open();

        destNodeRef.current = Tone.context.createMediaStreamDestination();

        if (voiceChanger !== "normal") {
          if (voiceChanger === "deep") {
            const pitchShift = new Tone.PitchShift(-2);
            userMediaRef.current.connect(pitchShift)
            pitchShift.connect(destNodeRef.current);
            const chebyshev = new Tone.Chebyshev(2);
            userMediaRef.current.connect(chebyshev)
            chebyshev.connect(destNodeRef.current);
          } else if (voiceChanger === "chipmunk") {
            const pitchShift = new Tone.PitchShift(5);
            userMediaRef.current.connect(pitchShift)
            pitchShift.connect(destNodeRef.current);
          } else if (voiceChanger === "echo") {
            const pingPong = new Tone.PingPongDelay("4n", 0.2);
            userMediaRef.current.connect(pingPong)
            pingPong.connect(destNodeRef.current);
          }

          mediaStreamRef.current = destNodeRef.current._nativeAudioNode.stream;
        }
        else {
          mediaStreamRef.current = userMediaRef.current._stream;
        }

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
            userId: userId,
          },
        };
        ws.current.send(JSON.stringify(join_room));
      }
    };

    ws.current.onmessage = async ({ data }) => {
      const { event, payload } = JSON.parse(data);
      if (event === "join-room") {
        setRoomInfo(payload);
        roomInfoRef.current = payload;
        if (!joined.current) {
          joined.current = true;
          payload.users.forEach(async (user) => {
            if (user.userId !== userId) {
              peerConnectionObjects.current[user.userId] =
                new RTCPeerConnection({
                  iceServers: [
                    {
                      urls: [
                        "stun:stun.l.google.com:19302",
                        "stun:stun1.l.google.com:19302",
                      ],
                    },
                  ],
                });

              /*
              myStream.current.getAudioTracks().forEach((track) => {
                peerConnectionObjects.current[user.userId].addTrack(
                  track,
                  myStream.current
                );
              });
              */

              mediaStreamRef.current.getAudioTracks().forEach(track => {
                peerConnectionObjects.current[user.userId].addTrack(
                  track,
                  mediaStreamRef.current);
              });

              const offer = await peerConnectionObjects.current[
                user.userId
              ].createOffer();
              await peerConnectionObjects.current[
                user.userId
              ].setLocalDescription(offer);

              const send_offer = {
                event: "send-offer",
                payload: {
                  id: roomID,
                  senderId: userId,
                  receiverId: user.userId,
                  offer: offer,
                },
              };

              ws.current.send(JSON.stringify(send_offer));

              peerConnectionObjects.current[user.userId].onicecandidate = (
                e
              ) => {
                if (e.candidate) {
                  const send_ice_candidate = {
                    event: "send-ice-candidate",
                    payload: {
                      id: roomID,
                      senderId: userId,
                      receiverId: user.userId,
                      icecandidate: e.candidate,
                    },
                  };
                  ws.current.send(JSON.stringify(send_ice_candidate));
                }
              };
              peerConnectionObjects.current[user.userId].ontrack = (e) => {
                const [remoteStream] = e.streams;
                remoteStream.getAudioTracks().forEach((track) => {
                  activeStreams.current[user.userId] = new MediaStream();
                  activeStreams.current[user.userId].addTrack(
                    track,
                    activeStreams.current[user.userId]
                  );
                });

                const incomingAudio = new Audio();
                incomingAudio.volume = 0.05; // haha
                incomingAudio.srcObject = remoteStream;
                incomingAudio.play();
              };

              peerConnectionObjects.current[
                user.userId
              ].onconnectionstatechange = () => {
                if (
                  peerConnectionObjects.current[user.userId].connectionState ===
                  "closed"
                ) {
                  delete peerConnectionObjects.current[user.userId];
                }
              };
            }
          });
        }
      } else if (event === "get-room") {
        setRoomInfo(payload);
      } else if (event === "leave-room") {
        const { newRoom, leaver } = payload;
        setRoomInfo(newRoom);
        roomInfoRef.current = newRoom;
        peerConnectionObjects.current[leaver.userId].close();
        delete peerConnectionObjects.current[leaver.userId];
        delete activeStreams.current[leaver.userId];
      } else if (event === "send-message") {
        setRoomInfo((prev) => ({
          ...prev,
          messages: [...prev.messages, payload],
        }));
        roomInfoRef.current = {
          ...roomInfoRef.current,
          messages: [...roomInfoRef.current.messages, payload],
        };
      } else if (event === "reaction") {
        const { messageId, reactionType } = payload;
        roomInfoRef.current.messages.forEach((message) => {
          if (message.messageId === messageId) {
            message.reactions[reactionType] += 1;
          }
        });

        setRoomInfo((prev) => ({
          ...prev,
          messages: roomInfoRef.current.messages,
        }));
      } else if (event === "send-offer") {
        const { senderId, receiverId, offer } = payload;

        peerConnectionObjects.current[senderId] = new RTCPeerConnection({
          iceServers: [
            {
              urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
              ],
            },
          ],
        });

        /*
        myStream.current.getAudioTracks().forEach((track) => {
          peerConnectionObjects.current[senderId].addTrack(
            track,
            myStream.current
          );
        });
        */

        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          peerConnectionObjects.current[senderId].addTrack(
            track,
            mediaStreamRef.current
          );
        });

        peerConnectionObjects.current[senderId].ontrack = (e) => {
          const [remoteStream] = e.streams;
          remoteStream.getAudioTracks().forEach((track) => {
            activeStreams.current[senderId] = new MediaStream();
            activeStreams.current[senderId].addTrack(
              track,
              activeStreams.current[senderId]
            );
          });

          const incomingAudio = new Audio();
          incomingAudio.volume = 0.05; // haha
          incomingAudio.srcObject = remoteStream;
          incomingAudio.play();
        };

        const remoteDesc = new RTCSessionDescription(offer);
        await peerConnectionObjects.current[senderId].setRemoteDescription(
          remoteDesc
        );

        const answer = await peerConnectionObjects.current[
          senderId
        ].createAnswer();
        await peerConnectionObjects.current[senderId].setLocalDescription(
          answer
        );

        const send_answer = {
          event: "send-answer",
          payload: {
            id: roomID,
            senderId: receiverId,
            receiverId: senderId,
            answer: answer,
          },
        };

        ws.current.send(JSON.stringify(send_answer));
      } else if (event === "send-answer") {
        const { senderId, answer } = payload;

        const remoteDesc = new RTCSessionDescription(answer);
        await peerConnectionObjects.current[senderId].setRemoteDescription(
          remoteDesc
        );
      } else if (event === "send-ice-candidate") {
        const { senderId, icecandidate } = payload;

        try {
          await peerConnectionObjects.current[senderId].addIceCandidate(
            icecandidate
          );
        } catch (err) {
          console.log(err);
        }
      }
    };

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(peerConnectionObjects.current).forEach((conn) =>
        conn.close()
      );
      activeStreams.current = {};

      /*
      if (myStream.current) {
        myStream.current.getTracks().forEach(track => track.stop());
        myStream.current = null;
      }
      */
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (destNodeRef.current) {
        destNodeRef.current = null;
      }

      if (userMediaRef.current) {
        userMediaRef.current.close()
        userMediaRef.current = null;
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
            messageId: crypto.randomUUID(),
            content: message,
            reactions: {
              good: 0,
              love: 0,
              haha: 0,
              fire: 0,
              bad: 0,
            },
          },
        },
      };

      ws.current.send(JSON.stringify(send_message));
    }
    setMessage("");
  };

  const handleReaction = (messageId, reactionType) => {
    const reaction = {
      event: "reaction",
      payload: {
        id: roomID,
        messageInfo: {
          messageId: messageId,
          reactionType: reactionType,
        },
      },
    };

    ws.current.send(JSON.stringify(reaction));
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
    if (mediaStreamRef.current) {
      const enabled = mediaStreamRef.current.getAudioTracks()[0].enabled;
      if (enabled) {
        setMuted(true);
        mediaStreamRef.current.getAudioTracks()[0].enabled = false;
      } else {
        setMuted(false);
        mediaStreamRef.current.getAudioTracks()[0].enabled = true;
      }
    } else {
      console.log("No active stream found, something went wrong");
    }
  };

  const handleRecording = () => {
    if (!recording) {
      const mediaStreamDestination =
        context.current.createMediaStreamDestination();

      Object.values(activeStreams.current).forEach((stream) => {
        const sourceToDest = context.current.createMediaStreamSource(stream);
        sourceToDest.connect(mediaStreamDestination);
      });

      const myStreamSource = context.current.createMediaStreamSource(
        mediaStreamRef.current
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

        const send_message = {
          event: "send-message",
          payload: {
            id: roomID,
            messageInfo: {
              username: username,
              type: "audio/wav",
              messageId: crypto.randomUUID(),
              content: url,
              reactions: {
                good: 0,
                love: 0,
                haha: 0,
                fire: 0,
                bad: 0,
              },
            },
          },
        };

        ws.current.send(JSON.stringify(send_message));
      };

      recorder.current.start(500);
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
            disabled={recording}
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
                {roomInfo.messages.map((message) => {
                  if (message.type === "text") {
                    return (
                      <li
                        key={message.messageId}
                        className="border-b border-gray-500 py-2"
                      >
                        {message.username}: {message.content}
                        <br />
                        <span className="reactions-container border-2 rounded-lg border-white inline-flex flex-auto gap-2">
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "good")
                            }
                          >
                            👍{" "}
                            <span className="reaction-good">
                              {message.reactions["good"] || 0}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "love")
                            }
                          >
                            ❤️{" "}
                            <span className="reaction-love">
                              {message.reactions["love"] || 0}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "haha")
                            }
                          >
                            😂{" "}
                            <span className="reaction-haha">
                              {message.reactions["haha"] || 0}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "fire")
                            }
                          >
                            🔥{" "}
                            <span className="reaction-fire">
                              {message.reactions["fire"] || 0}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "bad")
                            }
                          >
                            🖕{" "}
                            <span className="reaction-bad">
                              {message.reactions["bad"] || 0}
                            </span>
                          </button>
                        </span>
                      </li>
                    );
                  } else if (message.type === "audio/wav") {
                    return (
                      <li key={message.messageId}>
                        {message.username}{" "}
                        <a
                          className="text-blue-400 hover:text-blue-600 "
                          href={message.content}
                          download
                        >
                          Recorded the chat, click here to download
                        </a>
                        <br />
                        <span className="reactions-container border-2 rounded-lg border-white inline-flex flex-auto gap-2">
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "good")
                            }
                          >
                            👍{" "}
                            <span className="reaction-good">
                              {message.reactions["good"] || 0}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "love")
                            }
                          >
                            ❤️{" "}
                            <span className="reaction-love">
                              {message.reactions["love"] || 0}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "haha")
                            }
                          >
                            😂{" "}
                            <span className="reaction-haha">
                              {message.reactions["haha"] || 0}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "fire")
                            }
                          >
                            🔥{" "}
                            <span className="reaction-fire">
                              {message.reactions["fire"] || 0}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleReaction(message.messageId, "bad")
                            }
                          >
                            🖕{" "}
                            <span className="reaction-bad">
                              {message.reactions["bad"] || 0}
                            </span>
                          </button>
                        </span>
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
