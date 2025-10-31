"use client";
import { useState, useRef, useEffect } from "react";

export default function MobileUploadPage({ params }) {
  const { sessionId } = params;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // camera state
  const [streaming, setStreaming] = useState(false);
  const frontCamera = true;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function startCamera() {
    if (streaming) return;
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
      setMsg("");
    } catch (err) {
      console.error("Camera start error", err);
      setMsg(
        "Could not start camera — permission denied or no front camera available."
      );
    }
  }

  function stopCamera() {
    if (!cameraStreamRef.current) return;
    cameraStreamRef.current.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setStreaming(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setMsg("Camera not ready.");
      return;
    }
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    const canvas = canvasRef.current;
    const outputSize = 800;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, outputSize, outputSize);

    if (frontCamera) {
      ctx.save();
      ctx.translate(outputSize, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, size, size, 0, 0, outputSize, outputSize);
      ctx.restore();
    } else {
      ctx.drawImage(video, sx, sy, size, size, 0, 0, outputSize, outputSize);
    }

    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    const blob = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", 0.92)
    );
    if (!blob) {
      setMsg("Failed to capture image.");
      return;
    }
    const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    setFile(capturedFile);
    stopCamera();
    setMsg("Photo captured — ready to upload.");
  }

  function handleGalleryFile(e) {
    const selected = e.target.files?.[0] || null;
    if (selected) setFile(selected);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setMsg("Please choose a photo first.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/upload/${sessionId}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Upload failed (${res.status})`);
      }
      setMsg("Uploaded! You can go back to your desktop now.");
    } catch (err) {
      setMsg(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => stopCamera(), []);

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload your photo</h1>
      <p className="text-sm text-gray-600 mb-4">
        Session: <span className="font-mono">{sessionId}</span>
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 border rounded-2xl p-4"
      >
        <input
          type="file"
          accept="image/*"
          capture="user"
          ref={cameraInputRef}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          ref={galleryInputRef}
          onChange={handleGalleryFile}
          className="hidden"
        />

        <div className="relative w-full flex justify-center">
          {!streaming && (
            <div className="relative w-72 h-72 rounded-full overflow-hidden bg-black">
              {/* video fills circle */}
              <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover ${
                  streaming ? "" : "hidden"
                }`}
                playsInline
                muted
                autoPlay
                style={frontCamera ? { transform: "scaleX(-1)" } : undefined}
              />

              {/* overlay: corner brackets + mesh + dotted inner ring + pulsing points */}
              <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
                <svg
                  viewBox="0 0 100 100"
                  width="100%"
                  height="100%"
                  style={{ position: "absolute", inset: 0 }}
                  className="w-full h-full"
                >
                  <defs>
                    <mask id="overlayMask">
                      <rect width="100" height="100" fill="white" />
                      <circle cx="50" cy="50" r="48" fill="black" />
                    </mask>
                    <filter
                      id="glow"
                      x="-50%"
                      y="-50%"
                      width="200%"
                      height="200%"
                    >
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {/* Dim background with circular cutout */}
                  <rect
                    width="100"
                    height="100"
                    fill="rgba(0,0,0,0.65)"
                    mask="url(#overlayMask)"
                    className="transition-all"
                  />
                  {/* Glowing border */}
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    fill="none"
                    filter="url(#glow)"
                  />
                  {/* Guide mesh (optional) */}
                  <g stroke="#fff" strokeWidth="0.5" opacity="0.35">
                    <line x1="50" y1="12" x2="50" y2="88" />
                    <line x1="12" y1="50" x2="88" y2="50" />
                    <ellipse cx="50" cy="50" rx="36" ry="44" fill="none" />
                  </g>
                  {/* Corner marks */}
                  <g stroke="#fff" strokeWidth="2">
                    <polyline points="19,40 19,19 40,19" />
                    <polyline points="81,40 81,19 60,19" />
                    <polyline points="19,60 19,81 40,81" />
                    <polyline points="81,60 81,81 60,81" />
                  </g>
                  {/* Pulsing dots */}
                  {[...Array(6)].map((_, i) => {
                    const angle = (Math.PI * 2 * i) / 6;
                    const x = 50 + 42 * Math.cos(angle);
                    const y = 50 + 42 * Math.sin(angle);
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="2"
                        fill="#22d3ee"
                        className="pulse"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    );
                  })}
                </svg>
                <style>
                  {`
      .pulse {
        transform-origin: center;
        animation: pulseDot 1.6s infinite;
      }
      @keyframes pulseDot {
        0% { r: 2; opacity: 1; }
        50% { r: 3.5; opacity: 0.65; }
        100% { r: 2; opacity: 1; }
      }
    `}
                </style>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-3 justify-center">
          {!streaming ? (
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white"
            >
              Open Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={capturePhoto}
              className="px-4 py-2 rounded-lg bg-yellow-500 text-black"
            >
              Capture (inside circle)
            </button>
          )}

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-green-600 text-white"
          >
            Upload from Gallery
          </button>

          {streaming && (
            <button
              type="button"
              onClick={stopCamera}
              className="px-4 py-2 rounded-lg bg-red-600 text-white"
            >
              Close Camera
            </button>
          )}
        </div>

        {preview && (
          <div className="flex justify-center mb-2 mt-3">
            <img
              src={preview}
              alt="preview"
              className="w-40 h-40 rounded-full object-cover border-4 border-gray-300"
            />
          </div>
        )}

        <div className="flex justify-center">
          <button
            disabled={busy || !file}
            className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
          >
            {busy ? "Uploading..." : "Upload"}
          </button>
        </div>

        {msg && <div className="text-sm mt-1 text-center">{msg}</div>}
      </form>

      <p className="text-xs text-gray-500 mt-4">
        Your photo is stored temporarily for this session only.
      </p>
    </main>
  );
}
