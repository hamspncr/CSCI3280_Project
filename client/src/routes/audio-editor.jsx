import { useEffect, useRef, useState } from "react";
import {
  audioToArrayBuffer,
  createWaveBlob,
  framesToAudioBuffer,
  overwriteSection,
  parseFMT,
  readWave,
  saveWave,
  speech2text,
  trimAudioBuffer,
} from "../utils/utils";

// handle functions are self-explanatory

const AudioEditor = () => {
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [recording, setRecording] = useState(false);
  const [overwriting, setOverwriting] = useState(false);
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [paused, setPaused] = useState(false);
  const [testing, setTesting] = useState(false);
  const [audioLibrary, setAudioLibrary] = useState({});
  const [loadedAudioData, setLoadedAudioData] = useState(null);
  const [volume, setVolume] = useState(0.02);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");

  const context = useRef(null);
  const recorder = useRef(null);
  const gain = useRef(null);
  const testStream = useRef(null);

  useEffect(() => {
    // In order for the audio library to persist, we use the IndexedDB API (part of JavaScript)
    const dbreq = indexedDB.open("audioLibrary", 1);
    context.current = new AudioContext();

    // First time launching the app, so the db doesn't exist
    dbreq.onupgradeneeded = () => {
      const db = dbreq.result;
      db.createObjectStore("audioEntries", { keyPath: "id" });
    };

    dbreq.onsuccess = () => {
      const db = dbreq.result;

      const trans = db.transaction(["audioEntries"], "readonly");
      const store = trans.objectStore("audioEntries");

      const requestStore = store.getAll();

      requestStore.onsuccess = () => {
        // Updating the audioLibrary on app load, audioBuffer couldn't be saved to
        // the IndexedDB directly, so the DB stores an ArrayBuffer of the frameData,
        // and other metadata (sampleRate, etc.) to reconstruct the audioBuffer
        // once loaded
        requestStore.result.forEach((entry) => {
          const audioBuffer = framesToAudioBuffer(
            entry.sampleRate,
            entry.numberOfChannels,
            entry.sampleWidth,
            entry.audioData,
            context.current
          );
          setAudioLibrary((library) => ({
            ...library,
            [entry.id]: {
              name: entry.name,
              audioData: audioBuffer,
            },
          }));
        });
      };

      trans.oncomplete = () => {
        db.close();
      };

      trans.onerror = () => {
        db.close();
      }
    };
  }, []);

  // More of a helper function to update both the audioLibrary state and the IndexedDB
  const updateAudioLibrary = (id, name, audioBuffer) => {
    const dbreq = indexedDB.open("audioLibrary", 1);

    dbreq.onsuccess = () => {
      const db = dbreq.result;

      const trans = db.transaction(["audioEntries"], "readwrite");
      const store = trans.objectStore("audioEntries");

      // The IndexedDB couldn't store the audioBuffer directly, so it's converted
      // into an ArrayBuffer of uncompressed PCM sample data, and it's other
      // information is stored so that the audioBuffer can be recreated once loaded
      const frames = audioToArrayBuffer(audioBuffer);
      const entry = {
        id: id,
        name: name,
        audioData: frames,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleWidth: 4,
      };

      store.add(entry);

      trans.oncomplete = () => {
        db.close();
        setAudioLibrary((library) => ({
          ...library,
          [id]: {
            name: name,
            audioData: audioBuffer,
          },
        }));
      };

      trans.onerror = () => {
        db.close();
      };
    };
  };

  // Helper function for removing audio from audioLibrary state and IndexedDB
  const deleteFromAudioLibrary = (id) => {
    const dbreq = indexedDB.open("audioLibrary", 1);

    dbreq.onsuccess = () => {
      const db = dbreq.result;

      const trans = db.transaction(["audioEntries"], "readwrite");
      const store = trans.objectStore("audioEntries");

      store.delete(id);

      trans.oncomplete = () => {
        db.close();
        const updated = { ...audioLibrary };
        delete updated[id];
        setAudioLibrary(updated);
      };

      trans.onerror = () => {
        db.close();
      };
    };
  };

  const handleFile = async (e) => {
    context.current = new AudioContext();
    for (const file of e.target.files) {
      if (file.type === "audio/wav") {
        const buffer = await file.arrayBuffer();

        const { fmt_chunk, frames } = readWave(buffer);
        const { num_channels, rate, sample_width } = parseFMT(fmt_chunk);

        const data = framesToAudioBuffer(
          rate,
          num_channels,
          sample_width,
          frames,
          context.current
        );
        updateAudioLibrary(crypto.randomUUID(), file.name, data);
      }
    }
  };
  
  const handleSelectedAudio = (e) => {
    const selected = e.target.value;
    const selectedAudio = audioLibrary[selected];
    if (selectedAudio) {
      setLoadedAudioData(selectedAudio.audioData);
    } else {
      setLoadedAudioData(null);
    }
    setRange({ start: 0, end: 0 });
  };

  const handlePlayback = async () => {
    if (!playing) {
      context.current = new AudioContext({
        sampleRate: loadedAudioData.sampleRate,
      });
      gain.current = context.current.createGain();
      gain.current.gain.value = volume;
      gain.current.connect(context.current.destination);

      const source = context.current.createBufferSource();
      source.buffer = loadedAudioData;
      source.connect(gain.current);

      source.playbackRate.value = playbackRate;

      setPlaying(true);
      source.start();
      source.onended = () => {
        setPlaying(false);
        setPaused(false);
      };
    } else if (context.current.state === "running") {
      await context.current.suspend();
      setPaused(true);
    } else if (context.current.state === "suspended") {
      await context.current.resume();
      setPaused(false);
    }
  };

  const handleStop = () => {
    if (playing) {
      context.current.close();
      setPlaying(false);
      setPaused(false);
    }
  };

  const handleRecording = async () => {
    if (!recording) {
      const formatting = {
        audio: {
          channelCount: 1,
          sampleSize: 16,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(formatting);
      recorder.current = new MediaRecorder(stream);

      let chunks = {};

      recorder.current.ondataavailable = (e) => {
        chunks = e.data;
      };

      recorder.current.onstop = async () => {
        context.current = new AudioContext();
        chunks = await chunks.arrayBuffer();
        const audioBuffer = await context.current.decodeAudioData(chunks);

        const toSave = audioToArrayBuffer(audioBuffer);
        saveWave(toSave, audioBuffer.numberOfChannels, audioBuffer.sampleRate);
        updateAudioLibrary(
          crypto.randomUUID(),
          new Date().toLocaleString(),
          audioBuffer
        );
      };

      recorder.current.start();
      setRecording(true);
    } else {
      recorder.current.stop();
      setRecording(false);
    }
  };

  const handleTrim = () => {
    if (range.start >= range.end) {
      alert("Start > End");
    } else {
      const trimmedAudio = trimAudioBuffer(
        loadedAudioData,
        context.current,
        range.start,
        range.end
      );
      const trimmedAudioFrames = audioToArrayBuffer(trimmedAudio);
      saveWave(
        trimmedAudioFrames,
        trimmedAudio.numberOfChannels,
        trimmedAudio.sampleRate
      );
      updateAudioLibrary(
        crypto.randomUUID(),
        new Date().toLocaleString(),
        trimmedAudio
      );
    }
  };

  const handleOverwrite = async () => {
    if (range.start >= range.end) {
      alert("Start > End");
    }
    if (!overwriting) {
      const formatting = {
        audio: {
          channelCount: loadedAudioData.numberOfChannels,
          sampleSize: 16,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(formatting);
      recorder.current = new MediaRecorder(stream);

      let chunks = {};

      recorder.current.ondataavailable = (e) => {
        chunks = e.data;
      };

      recorder.current.onstop = async () => {
        context.current = new AudioContext({
          sampleRate: loadedAudioData.sampleRate,
        });
        chunks = await chunks.arrayBuffer();
        const audioBuffer = await context.current.decodeAudioData(chunks);

        const overwritten = await overwriteSection(
          loadedAudioData,
          audioBuffer,
          range.start,
          range.end
        );

        saveWave(
          overwritten,
          audioBuffer.numberOfChannels,
          audioBuffer.sampleRate
        );
        updateAudioLibrary(
          crypto.randomUUID(),
          new Date().toLocaleString(),
          framesToAudioBuffer(
            audioBuffer.sampleRate,
            audioBuffer.numberOfChannels,
            4,
            overwritten,
            context.current
          )
        );
      };

      recorder.current.start();
      setOverwriting(true);
    } else {
      recorder.current.stop();
      setOverwriting(false);
    }
  };

  const handleMicTest = async () => {
    if (!testing) {
      const formatting = {
        audio: {
          channelCount: 1,
          sampleSize: 16,
        },
      };
      testStream.current = await navigator.mediaDevices.getUserMedia(
        formatting
      );
      context.current = new AudioContext();
      gain.current = context.current.createGain();
      gain.current.gain.value = volume;
      gain.current.connect(context.current.destination);

      const source = context.current.createMediaStreamSource(
        testStream.current
      );

      source.connect(gain.current);

      setTesting(true);
    } else {
      const source = context.current.createMediaStreamSource(
        testStream.current
      );
      source.disconnect();
      for (const track of testStream.current.getTracks()) {
        track.stop();
      }
      setTesting(false);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    if (gain.current) {
      gain.current.gain.value = newVolume;
    }
    setVolume(newVolume);
  };

  const handlePlaybackRate = (e) => {
    setPlaybackRate(e.target.value);
  };

  const handleStart = (e) => {
    setRange({ ...range, start: e.target.value });
  };

  const handleEnd = (e) => {
    setRange({ ...range, end: e.target.value });
  };

  const handleTranscript = async () => {
    if (loadedAudioData && loadedAudioData.numberOfChannels === 1) {
      setTranscribing(true);
      const waveBlob = await createWaveBlob(
        audioToArrayBuffer(loadedAudioData),
        loadedAudioData.numberOfChannels,
        loadedAudioData.sampleRate
      );
      const transcribed = await speech2text(await waveBlob.arrayBuffer());
      setTranscript(transcribed);
      setTranscribing(false);
    }
  };

  const handleExport = () => {
    if (loadedAudioData) {
      saveWave(
        audioToArrayBuffer(loadedAudioData),
        loadedAudioData.numberOfChannels,
        loadedAudioData.sampleRate
      );
    }
  };

  const handleDelete = () => {
    if (loadedAudioData) {
      const toDelete = Object.keys(audioLibrary).find(
        (id) => audioLibrary[id].audioData === loadedAudioData
      );
      deleteFromAudioLibrary(toDelete);
      setLoadedAudioData(null);
      setTranscript("");
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="container mx-auto px-4 py-8">
          <a href={`/`} className="text-blue-400">
            Home
          </a>
          <div className="mt-8 flex flex-col space-y-8">
            <label className="text-gray-400">Select .wav file</label>
            <label htmlFor="fileInput" className="relative cursor-pointer">
              <input
                id="fileInput"
                type="file"
                accept=".wav"
                multiple
                onChange={handleFile}
                disabled={playing || recording || testing}
                className="hidden"
              />
              <span className="bg-gray-800 hover:bg-gray-700 px-8 py-4 rounded-lg border border-gray-700 cursor-pointer">
                Upload .wav file
              </span>
            </label>

            <select
              name="Library"
              size="10"
              onChange={handleSelectedAudio}
              className="p-4 bg-gray-800 border border-gray-700 rounded-lg"
            >
              {Object.entries(audioLibrary).map(([id, data]) => (
                <option key={id} value={id}>
                  {data.name}
                </option>
              ))}
            </select>
            <div className="flex flex-col items-center">
              <button
                onClick={handleExport}
                disabled={!loadedAudioData}
                className={`bg-gray-500 hover:bg-gray-600 text-white px-8 py-4 my-2 rounded-lg ${
                  !loadedAudioData ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Export file
              </button>
              <button
                onClick={handleDelete}
                disabled={playing || !loadedAudioData}
                className={`bg-red-500 hover:bg-red-600 text-white px-8 py-4 my-2 rounded-lg ${
                  playing || !loadedAudioData
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                Remove file
              </button>
              <button
                onClick={handleTranscript}
                disabled={!loadedAudioData || transcribing}
                className={`bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 my-2 rounded-lg ${
                  !loadedAudioData || transcribing
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                Transcribe (only mono, may take a while)
              </button>
              Transcript of selected file: {transcript}
            </div>

            <div className="flex flex-wrap items-center justify-center space-x-4">
              <button
                onClick={handlePlayback}
                disabled={recording || testing || !loadedAudioData}
                className={`bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-lg ${
                  recording || testing || !loadedAudioData
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {!playing ? "Play" : !paused ? "Pause" : "Resume"}
              </button>
              <button
                onClick={handleStop}
                disabled={!playing || recording || testing || !loadedAudioData}
                className={`bg-blue-700 hover:bg-blue-800 text-white px-8 py-4 rounded-lg ${
                  !playing || recording || testing || !loadedAudioData
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                Stop
              </button>
              <button
                onClick={handleRecording}
                disabled={playing || testing}
                className={`bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-lg ${
                  playing || testing ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {!recording ? "Record" : "Stop Recording"}
              </button>
              <button
                onClick={handleMicTest}
                disabled={playing || recording}
                className={`bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg ${
                  playing || recording ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {!testing ? "Test Mic" : "Stop Test"}
              </button>
              <button
                onClick={handleTrim}
                disabled={playing || recording || testing || !loadedAudioData}
                className={`bg-gray-500 hover:bg-gray-600 text-white px-8 py-4 rounded-lg ${
                  playing || recording || testing || !loadedAudioData
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                Trim
              </button>
              <button
                onClick={handleOverwrite}
                disabled={playing || recording || testing || !loadedAudioData}
                className={`bg-gray-500 hover:bg-gray-600 text-white px-8 py-4 rounded-lg ${
                  playing || recording || testing || !loadedAudioData
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {!overwriting ? "Start Overwrite" : "Finish Overwrite"}
              </button>
            </div>

            <div className="flex items-center justify-between space-x-8">
              <div className="flex flex-col w-1/2">
                <label className="text-gray-400">
                  Volume: {Math.floor(volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="h-4 bg-gray-800 rounded-lg"
                />
              </div>
              <div className="flex flex-col w-1/2">
                <label className="text-gray-400">
                  Playback Rate: {playbackRate}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={playbackRate}
                  onChange={handlePlaybackRate}
                  className="h-4 bg-gray-800 rounded-lg"
                  disabled={playing}
                />
              </div>
            </div>

            <div className="flex flex-col space-y-4">
              <label className="text-gray-400">Trim/Overwrite Range</label>
              <div className="flex flex-col">
                <label className="text-gray-400">Start: {range.start}</label>
                <input
                  type="range"
                  min="0"
                  max={loadedAudioData ? loadedAudioData.duration : 0}
                  step={loadedAudioData ? 1 / loadedAudioData.sampleRate : 0}
                  value={range.start}
                  onChange={handleStart}
                  disabled={overwriting}
                  className="w-full h-4 bg-gray-800 rounded-lg"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-gray-400">End: {range.end}</label>
                <input
                  type="range"
                  min="0"
                  max={loadedAudioData ? loadedAudioData.duration : 0}
                  step={loadedAudioData ? 1 / loadedAudioData.sampleRate : 0}
                  value={range.end}
                  onChange={handleEnd}
                  disabled={overwriting}
                  className="w-full h-4 bg-gray-800 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AudioEditor;
