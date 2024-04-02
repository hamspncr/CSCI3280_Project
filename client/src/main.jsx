import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import './index.css';
import AudioEditor from './routes/audio-editor';
import Root from "./routes/root";
import VoiceChat from './routes/voice-chat';

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
  },
  {
    path: "audio-editor",
    element: <AudioEditor />,
  },
  {
    path: "voice-chat",
    element: <VoiceChat />, // Temporary
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
