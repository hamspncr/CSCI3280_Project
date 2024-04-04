import React, { createContext } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import AudioEditor from "./routes/audio-editor";
import Root from "./routes/root";
import VoiceChat from "./routes/voice-chat";
import VoiceChatRoom from "./routes/voice-chat-room";

export const UsernameContext = createContext(null);

export const App = () => {
  const [username, setUsername] = React.useState("");
  return (
    <UsernameContext.Provider value={{username, setUsername}}>
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* <RouterProvider router={router} /> */}
    <App />
  </React.StrictMode>
);
