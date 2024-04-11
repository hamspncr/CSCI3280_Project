// loadedAudioData in the AudioEditor page will always have a sample width of 4 bytes
//

// Splits the wave file bytes into their respective sections, each section is blank if not supported wave file
export const readWave = (bytes) => {
  const byteArray = new Uint8Array(bytes);

  let audioData = {
    riff_chunk: new ArrayBuffer(),
    fmt_chunk: new ArrayBuffer(),
    data_chunk: new ArrayBuffer(),
    frames: new ArrayBuffer(),
  };

  const riffString = String.fromCharCode(...byteArray.slice(0, 4));
  const fmtString = String.fromCharCode(...byteArray.slice(12, 16));
  const dataString = String.fromCharCode(...byteArray.slice(36, 40));

  if (riffString !== "RIFF" && fmtString !== "fmt " && dataString !== "data") {
    console.log("invalid wave file");
  } else {
    audioData.riff_chunk = byteArray.slice(0, 12).buffer;
    audioData.fmt_chunk = byteArray.slice(12, 36).buffer;
    audioData.data_chunk = byteArray.slice(36, 44).buffer;
    audioData.frames = byteArray.slice(44).buffer;
  }
  return audioData;
};

export const saveWave = (framedata, channels, rate, name, intPCM = false) => {
  const filename = name === undefined ? new Date().toLocaleString() : name;

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
  const url = URL.createObjectURL(blob);

  // Create an anchor tag and simulate clicking on it to download the file
  const link = document.createElement("a");
  link.href = url;
  link.download = filename + ".wav";
  link.click();
};

// Does close to what save wave does, but does not automatically save to computer
export const createWaveBlob = async (framedata, channels, rate, intPCM = false) => {
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

  return blob;
};

// Cannot return from inside callback, so returns a promise and resolves from within onload instead. Used in voice-chat-room for audio recording
export const readFileAsDataURL = (blob) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      resolve(url);
    };
    reader.readAsDataURL(blob);
  });
};

// Interprets the fmt_chunk, returns object for each logical section
export const parseFMT = (fmt_chunk) => {
  const view = new DataView(fmt_chunk);

  let format = {
    fmt_chunk_size: 0,
    audio_format: 0,
    num_channels: 0,
    rate: 0,
    byterate: 0,
    block_align: 0,
    sample_width: 0,
  };

  format.fmt_chunk_size = view.getInt32(4, true);
  format.audio_format = view.getInt16(8, true);
  format.num_channels = view.getInt16(10, true);
  format.rate = view.getInt32(12, true);
  format.byterate = view.getInt32(16, true);
  format.block_align = view.getInt16(20, true);
  format.sample_width = view.getInt16(22, true) / 8;

  return format;
};

// Creates an ArrayBuffer of frames in the format of an uncompressed PCM wave file
export const interleaveChannels = (channels) => {
  const len = channels[0].byteLength * channels.length;
  const final = new Float32Array(new ArrayBuffer(len));
  for (let i = 0; i < final.length; i++) {
    final[i] = channels[i % channels.length][Math.floor(i / channels.length)];
  }
  return final.buffer;
};

// Returns an array, each element a Float32Array containing sample data for each channel
export const splitIntoChannels = (audioBuffer) => {
  const channels = [];
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    let temp = new Float32Array(audioBuffer.length);
    audioBuffer.copyFromChannel(temp, channel);
    channels.push(temp);
  }
  return channels;
};

export const audioToArrayBuffer = (audioBuffer) =>
  interleaveChannels(splitIntoChannels(audioBuffer));

// Convert frames of an uncompressed PCM wave file to AudioBuffer object for playback
export const framesToAudioBuffer = (
  rate,
  channels,
  sample_width,
  frames,
  context
) => {
  const block_align = sample_width * channels;
  const num_of_frames = frames.byteLength / block_align;

  const audioBuffer = context.createBuffer(channels, num_of_frames, rate);

  // Audio playback with the Web Audio API only supports float32 uncompressed PCM format
  let frameData;
  let normalize = 1;
  if (sample_width === 2) {
    frameData = new Int16Array(frames);
    normalize = 32768;
  } else if (sample_width === 4) {
    frameData = new Float32Array(frames);
  } else if (sample_width === 8) {
    frameData = new Float64Array(frames);
  }

  for (let channel = 0; channel < channels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let frame = 0; frame < num_of_frames; frame++) {
      // channel here acts as an offset into the sample corresponding to said channel
      const sample = frameData[frame * channels + channel];
      channelData[frame] = sample / normalize;
    }
  }
  return audioBuffer;
};

export const trimAudioBuffer = (audioBuffer, context, start, end) => {
  const channels = splitIntoChannels(audioBuffer);

  const startIndex = Math.floor(start * audioBuffer.sampleRate);
  const endIndex = Math.floor(end * audioBuffer.sampleRate);

  for (let channel = 0; channel < channels.length; channel++) {
    channels[channel] = channels[channel].slice(startIndex, endIndex);
  }
  return framesToAudioBuffer(
    audioBuffer.sampleRate,
    audioBuffer.numberOfChannels,
    4,
    interleaveChannels(channels),
    context
  );
};

export const overwriteSection = async (original, replacement, start, end) => {
  const originalChannels = splitIntoChannels(original);
  const startIndex = Math.floor(start * original.sampleRate);
  const endIndex = Math.floor(end * original.sampleRate);

  const firstSection = [];
  const secondSection = [];
  for (let channel = 0; channel < originalChannels.length; channel++) {
    firstSection.push(originalChannels[channel].slice(0, startIndex));
    secondSection.push(originalChannels[channel].slice(endIndex));
  }

  const blob = new Blob([
    interleaveChannels(firstSection),
    audioToArrayBuffer(replacement),
    interleaveChannels(secondSection),
  ]);

  const final = await blob.arrayBuffer();
  return final;
};

// Restrictions:
// - Only 20 seconds of audio
// - Only mono
export const speech2text = async (file) => {
  const key = import.meta.env.VITE_WIT_API;
  if (!key) {
    return "No API key found, please add as environment variable";
  } else {
    const options = {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "audio/wav",
      },
      body: file,
    };
    const res = await fetch("https://api.wit.ai/speech", options);
    const textform = await res.text();
    console.log(textform)
    // Chunked response, delimited with \r
    const chunks = textform.split("\r");
    return JSON.parse(chunks[chunks.length - 1]).text;
  }
};
