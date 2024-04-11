import { createContext, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AudioEditor from "./routes/audio-editor";
import Root from "./routes/root";
import VoiceChat from "./routes/voice-chat";
import VoiceChatRoom from "./routes/voice-chat-room";

export const UsernameContext = createContext(null);

// The core of the app, handles routing and context is essentially global variables for every section of our app
export const App = () => {
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState(crypto.randomUUID())
  const [voiceChanger, setVoiceChanger] = useState("normal")
  return (
    <UsernameContext.Provider value={{username, setUsername, userId, setUserId, voiceChanger, setVoiceChanger}}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/audio-editor" element={<AudioEditor />} />
          <Route path="/voice-chat" element={<VoiceChat />} />
          <Route path="/voice-chat/:roomID" element={<VoiceChatRoom />} />
        </Routes>
      </BrowserRouter>
    </UsernameContext.Provider>
  );
};