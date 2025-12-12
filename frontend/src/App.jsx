import React, { useRef, useEffect, useState, useCallback } from "react";

export default function VoiceToTextCircularUI() {
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptEndRef = useRef(null);

  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  // Detect support
  useEffect(() => {
    const supported =
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    setSpeechSupported(supported);
  }, []);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    if (!speechSupported) return null;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let final = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0].transcript;
        if (res.isFinal) final += text;
        else interim += text;
      }

      if (final) {
        setTranscript((prev) => prev + " " + final);
        setInterimTranscript("");
        setIsSpeaking(true);
        setTimeout(() => setIsSpeaking(false), 300);
      }

      if (interim) {
        setInterimTranscript(interim);
        setIsSpeaking(true);
      }
    };

    recognition.onend = () => {
      if (isListening) recognition.start();
    };

    recognition.onerror = () => {};

    return recognition;
  }, [isListening, speechSupported]);

  // Start voice + visualizer
  const startListening = async () => {
    if (!speechSupported) {
      alert("Speech Recognition is not supported in this browser.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    // Start speech recognition
    const recognition = initSpeechRecognition();
    recognitionRef.current = recognition;
    recognition.start();

    setIsListening(true);

    // Visualizer logic
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setVolume(avg / 255);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = canvas.width * 0.23;

      const bars = 52;

      for (let i = 0; i < bars; i++) {
        const angle = (i * Math.PI * 2) / bars;
        const index = Math.floor((i / bars) * dataArray.length);
        const val = dataArray[index] / 255;

        const barHeight = val * 45 * (isSpeaking ? 1.4 : 1);

        const x1 = cx + Math.cos(angle) * radius;
        const y1 = cy + Math.sin(angle) * radius;
        const x2 = cx + Math.cos(angle) * (radius + barHeight);
        const y2 = cy + Math.sin(angle) * (radius + barHeight);

        ctx.strokeStyle = `hsl(${(i / bars) * 360}, 80%, ${40 + val * 35}%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      requestAnimationFrame(draw);
    };

    draw();
  };

  // Stop everything
  const stopListening = () => {
    setIsListening(false);
    setIsSpeaking(false);
    setInterimTranscript("");

    if (recognitionRef.current) recognitionRef.current.stop();
  };

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimTranscript]);

  // Responsive canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const setSize = () => {
      const size = Math.min(window.innerWidth * 0.6, 320);
      canvas.width = size;
      canvas.height = size;
    };
    setSize();
    window.addEventListener("resize", setSize);
    return () => window.removeEventListener("resize", setSize);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-6">
        {/* LEFT PANEL */}
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center">
          <h2 className="font-semibold text-lg mb-1">Audio Visualizer</h2>
          <p className="text-gray-500 text-sm mb-4">Live mic input</p>

          <canvas ref={canvasRef} className="rounded-full" />

          <button
            onClick={isListening ? stopListening : startListening}
            className={`mt-6 w-full py-3 text-white rounded-xl font-medium ${
              isListening
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {isListening ? "Stop Listening" : "Start Listening"}
          </button>

          <div className="mt-3 text-gray-600 text-sm flex gap-2 items-center">
            <div
              className={`w-3 h-3 rounded-full ${
                isListening ? (isSpeaking ? "bg-green-500" : "bg-blue-500") : "bg-gray-400"
              }`}
            ></div>
            {isListening ? (isSpeaking ? "Speaking detected" : "Listening…") : "Ready"}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col">
          <h2 className="font-semibold text-lg mb-2">Live Transcription</h2>

          <div className="flex-1 bg-gray-50 border rounded-xl p-4 overflow-y-auto">
            {transcript || interimTranscript ? (
              <>
                <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                  {transcript}
                </p>
                {interimTranscript && (
                  <p className="text-gray-500 italic">{interimTranscript} ▌</p>
                )}
                <div ref={transcriptEndRef} />
              </>
            ) : (
              <div className="text-center text-gray-400 mt-10">No text yet…</div>
            )}
          </div>

          <button
            className="mt-4 bg-gray-100 hover:bg-gray-200 py-2 rounded-md text-gray-700"
            onClick={() => {
              setTranscript("");
              setInterimTranscript("");
            }}
            disabled={!transcript && !interimTranscript}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
