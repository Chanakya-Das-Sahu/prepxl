import React, { useRef, useEffect, useState, useCallback } from "react";

const CircularAudioEqualizer = () => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationIdRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptEndRef = useRef(null);

  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState("");

  // Check speech recognition support
  useEffect(() => {
    const isSpeechSupported =
      "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    setSpeechSupported(isSpeechSupported);
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Initialize speech recognition with faster response
  const initSpeechRecognition = useCallback(() => {
    if (!speechSupported) return null;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true; // Enable interim results for faster feedback
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let final = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          final += text;
          setIsSpeaking(true);
          setTimeout(() => setIsSpeaking(false), 300);
        } else {
          interim += text;
          setIsSpeaking(true);
        }
      }

      if (final) {
        setTranscript((prev) => prev + " " + final);
        setInterimTranscript("");
      }

      if (interim) {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event) => {
      console.log("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      if (isListening && recognitionRef.current) {
        setTimeout(() => recognitionRef.current?.start(), 50);
      }
    };

    return recognition;
  }, [isListening, speechSupported]);

  // Start audio processing
  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 128; // Smaller for faster processing
      analyser.smoothingTimeConstant = 0.7; // Faster response
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      if (speechSupported) {
        const recognition = initSpeechRecognition();
        if (recognition) {
          recognitionRef.current = recognition;
          recognition.start();
        }
      }

      setIsListening(true);

      // Start fast visualization
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const draw = () => {
        if (!analyserRef.current || !canvasRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(average / 255);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.6;
        const bars = 48; // Reduced bars for faster rendering

        // Draw circular bars with optimized rendering
        ctx.lineWidth = 2;
        ctx.lineCap = "round";

        for (let i = 0; i < bars; i++) {
          const angle = (i * Math.PI * 2) / bars;
          const dataIndex = Math.floor((i / bars) * dataArray.length);
          const barValue = dataArray[dataIndex] / 255;

          // Dynamic bar height with speaking boost
          const baseHeight = barValue * (radius * 0.5);
          const speakingBoost = isSpeaking ? 1.5 : 1;
          const barHeight = baseHeight * speakingBoost;

          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          const x2 = centerX + Math.cos(angle) * (radius + barHeight);
          const y2 = centerY + Math.sin(angle) * (radius + barHeight);

          // Color based on frequency and activity
          const hue = (i / bars) * 360;
          const lightness = 40 + barValue * 30;

          ctx.beginPath();
          ctx.strokeStyle = `hsl(${hue}, 80%, ${lightness}%)`;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = isSpeaking
          ? "rgba(34, 197, 94, 0.4)"
          : `rgba(59, 130, 246, ${0.2 + volume * 0.3})`;
        ctx.fill();

        animationIdRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (error) {
      alert("Please allow microphone access to use this feature.");
    }
  }, [initSpeechRecognition, speechSupported, isSpeaking, volume]);

  // Stop audio processing
  const stopAudio = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
    setVolume(0);
    setIsSpeaking(false);
    setInterimTranscript("");
  }, []);

  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  // Clear transcript
  const clearTranscript = () => {
    setTranscript("");
    setInterimTranscript("");
  };

  // Update canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const updateSize = () => {
      const container = canvas.parentElement;
      const size = Math.min(container.clientWidth, container.clientHeight, 300);
      canvas.width = size;
      canvas.height = size;
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimTranscript]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-5xl mx-auto min-h-[90vh] flex flex-col">
        {/* Header - Compact */}
        <header className="text-center mb-6 pt-4">
          <a
            className="underline text-blue-600 hover:text-blue-800"
            href="https://chanakya-das-sahu.netlify.app"
            target="_blank"
          >
            ( Chanakya Das Sahu )
          </a>
          <p className="text-gray-600 text-md mt-1">
           Circular Audio Equalizer
          </p>
        </header>

        {/* Main Content - Side by side */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Visualizer */}
          <div className="bg-white rounded-2xl shadow-lg p-5 flex flex-col">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-800">
                Audio Visualizer
              </h2>
              <p className="text-gray-500 text-sm">Live frequency analysis</p>
            </div>

            {/* Canvas Container */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-64 h-64">
                <canvas ref={canvasRef} className="w-full h-full" />

                {/* Center Display */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  <div
                    className={`text-2xl font-bold ${
                      isSpeaking ? "text-green-600" : "text-blue-600"
                    }`}
                  >
                    {Math.round(volume * 100)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {isListening
                      ? isSpeaking
                        ? "SPEAKING"
                        : "LISTENING"
                      : "READY"}
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-5">
              <button
                onClick={toggleListening}
                className={`w-full py-3 rounded-xl font-medium transition-all duration-200 ${
                  isListening
                    ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
                    : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
                }`}
              >
                {isListening ? "STOP LISTENING" : "START LISTENING"}
              </button>

              <div className="mt-4 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${
                      isListening
                        ? isSpeaking
                          ? "bg-green-500"
                          : "bg-blue-500"
                        : "bg-gray-400"
                    }`}
                  ></div>
                  <span className="text-gray-600">
                    {isListening ? "Microphone Active" : "Click to Start"}
                  </span>
                </div>
                <span className="text-gray-700 font-medium">
                  Volume: {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Right: Speech to Text */}
          <div className="bg-white rounded-2xl shadow-lg p-5 flex flex-col">
            <div className="mb-5 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Live Transcription
                </h2>
                <p className="text-gray-500 text-sm">
                  Speech-to-text in real-time
                </p>
              </div>
              <button
                onClick={clearTranscript}
                disabled={!transcript && !interimTranscript}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>

            {/* Transcript Display */}
            <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto">
                {transcript || interimTranscript ? (
                  <div className="space-y-3">
                    {transcript && (
                      <div className="text-gray-800 leading-relaxed">
                        {transcript}
                      </div>
                    )}
                    {interimTranscript && (
                      <div className="text-gray-600 italic">
                        {interimTranscript}
                        <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse"></span>
                      </div>
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center p-4">
                    <div className="text-4xl mb-3">🎤</div>
                    <p className="text-gray-600 font-medium mb-2">
                      {isListening ? "Start speaking..." : "Ready to listen"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isListening
                        ? "Speak clearly into your microphone"
                        : 'Click "START LISTENING" to begin'}
                    </p>
                    {!speechSupported && isListening && (
                      <p className="text-sm text-amber-600 mt-3">
                        ⚠️ Speech recognition requires Chrome/Edge
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Status Bar */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isSpeaking ? "bg-green-500" : "bg-gray-300"
                        }`}
                      ></div>
                      <span className="text-gray-600">Voice Activity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isListening ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      ></div>
                      <span className="text-gray-600">Microphone</span>
                    </div>
                  </div>
                  <div className="text-gray-500">
                    {speechSupported
                      ? "Speech API: Ready"
                      : "Speech API: Unavailable"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Compact Footer */}
        <footer className="mt-6 pt-4 border-t border-gray-200">
          <div className="text-center text-gray-500 text-sm">
            <p>
              All processing happens locally • Works best in Chrome/Edge •
              Refresh page if issues occur
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default CircularAudioEqualizer;
