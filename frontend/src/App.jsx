import React, { useRef, useEffect, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

export default function VoiceToTextCircularUI() {
  const canvasRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const animationRef = useRef(null);
  const lastFinalRef = useRef("");

  const {
    transcript,
    interimTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const [finalText, setFinalText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ✅ FINALIZED TEXT ONLY
  useEffect(() => {
    if (!transcript || transcript === lastFinalRef.current) return;

    if (transcript.startsWith(lastFinalRef.current)) {
      const delta = transcript.slice(lastFinalRef.current.length).trim();
      if (delta) {
        setFinalText((prev) => (prev + " " + delta).trim());
      }
    } else {
      setFinalText(transcript);
    }

    lastFinalRef.current = transcript;
  }, [transcript]);

  // 🎧 ALWAYS-ON EQUALIZER (IDLE + SPEAKING)
  useEffect(() => {
    let audioContext;
    let analyser;
    let dataArray;
    let source;
    let stream;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const initAudio = async () => {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      dataArray = new Uint8Array(analyser.frequencyBinCount);

      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      draw();
    };

    const draw = () => {
      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }

      const volume = Math.sqrt(sum / dataArray.length);
      setIsSpeaking(volume > 0.05);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseRadius = canvas.width * 0.23;
      const bars = 60;

      for (let i = 0; i < bars; i++) {
        const angle = (i * Math.PI * 2) / bars;

        // idle pulse when silent
        const idlePulse = Math.sin(Date.now() / 300 + i) * 4;
        const barHeight = volume > 0.02 ? volume * 180 : 12 + idlePulse;

        const x1 = cx + Math.cos(angle) * baseRadius;
        const y1 = cy + Math.sin(angle) * baseRadius;
        const x2 = cx + Math.cos(angle) * (baseRadius + barHeight);
        const y2 = cy + Math.sin(angle) * (baseRadius + barHeight);

        ctx.strokeStyle = `hsl(${i * 6}, 85%, 55%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    initAudio();

    return () => {
      cancelAnimationFrame(animationRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      audioContext?.close();
    };
  }, []);

  // START LISTENING
  const startListening = () => {
    if (!browserSupportsSpeechRecognition) {
      alert("Speech Recognition is not supported.");
      return;
    }

    lastFinalRef.current = "";
    setFinalText("");

    SpeechRecognition.startListening({
      continuous: true,
      interimResults: true,
      language: "en-US",
    });
  };

  // STOP LISTENING
  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  // AUTO SCROLL FINAL TEXT
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalText]);

  // RESPONSIVE CANVAS
  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const size = Math.min(window.innerWidth * 0.6, 320);
      canvas.width = size;
      canvas.height = size;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-6">
        {/* LEFT */}
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
          <h2 className="font-semibold text-lg mb-1">Audio Visualizer</h2>
          <p className="text-gray-500 text-sm mb-4">Live mic input</p>

          <canvas ref={canvasRef} className="rounded-full" />

          {/* 👀 PREVIEW TEXT */}
          {interimTranscript && listening && (
            <p className="mt-4 text-sm text-gray-500 italic text-center">
              {interimTranscript} ▌
            </p>
          )}

          <button
            onClick={listening ? stopListening : startListening}
            className={`mt-6 w-full py-3 text-white rounded-xl font-medium ${
              listening
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {listening ? "Stop Listening" : "Start Listening"}
          </button>

          <div className="mt-3 text-gray-600 text-sm flex gap-2 items-center">
            <div
              className={`w-3 h-3 rounded-full ${
                listening
                  ? isSpeaking
                    ? "bg-green-500"
                    : "bg-blue-500"
                  : "bg-gray-400"
              }`}
            />
            {listening
              ? isSpeaking
                ? "Speaking detected"
                : "Listening…"
              : "Ready"}
          </div>
        </div>

        {/* RIGHT */}
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col">
          <h2 className="font-semibold text-lg mb-2">Live Transcription</h2>

          <div className="flex-1 bg-gray-50 border rounded-xl p-4 overflow-y-auto">
            {finalText ? (
              <>
                <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                  {finalText}
                </p>
                <div ref={transcriptEndRef} />
              </>
            ) : (
              <div className="text-center text-gray-400 mt-10">
                No text yet…
              </div>
            )}
          </div>

          <button
            className="mt-4 bg-gray-100 hover:bg-gray-200 py-2 rounded-md text-gray-700"
            onClick={() => {
              resetTranscript();
              setFinalText("");
              lastFinalRef.current = "";
            }}
            disabled={!finalText}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
