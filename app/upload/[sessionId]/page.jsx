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
          {/* {!streaming && (
            <div className="w-72 h-72 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed text-sm z-10 text-gray-500 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              Camera inactive
            </div>
          )} */}

          {!streaming && (
            <div className="relative w-72 h-72 rounded-full overflow-hidden bg-black">
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
              <div className="absolute inset-0 pointer-events-none z-20">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="xMidYMid slice"
                  className="w-full h-full"
                >
                  <defs>
                    <mask id="hole">
                      <rect width="100" height="100" fill="black" />
                      <circle cx="50" cy="50" r="46" fill="white" />
                    </mask>

                    <filter
                      id="glow"
                      x="-50%"
                      y="-50%"
                      width="200%"
                      height="200%"
                    >
                      <feGaussianBlur stdDeviation="1.6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <rect
                    width="100"
                    height="100"
                    fill="rgba(0,0,0,0.62)"
                    mask="url(#hole)"
                  />
                  <circle
                    cx="50"
                    cy="46"
                    r="30"
                    fill="none"
                    stroke="rgba(255,255,255,0.85)"
                    strokeDasharray="1.5 2.5"
                    strokeWidth="0.8"
                    transform=""
                  />
                  <g
                    stroke="rgba(0,200,255,0.95)"
                    strokeWidth="1.6"
                    fill="none"
                  >
                    <path d="M12 20 L12 10 L22 10" strokeLinecap="round" />
                    <path d="M88 20 L88 10 L78 10" strokeLinecap="round" />
                    <path d="M12 80 L12 90 L22 90" strokeLinecap="round" />
                    <path d="M88 80 L88 90 L78 90" strokeLinecap="round" />
                  </g>
                  <g
                    stroke="rgba(0,200,255,0.85)"
                    strokeWidth="0.7"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.95"
                  >
                    <polyline points="38,58 42,66 50,70 58,66 62,58" />
                    <polyline points="34,46 36,52 38,58" />
                    <polyline points="66,46 64,52 62,58" />
                    <polyline points="50,46 50,54" />
                    <polyline points="46,54 50,56 54,54" />
                    <polyline points="40,46 46,44 50,44 54,44 60,46" />
                    <polyline points="44,38 50,34 56,38" />
                    <polyline
                      points="44,38 46,44 50,44 54,44 56,38"
                      strokeDasharray="1.2 1.2"
                      opacity="0.8"
                    />
                  </g>
                  <g
                    id="keypoints"
                    fill="rgba(0,200,255,0.95)"
                    stroke="white"
                    strokeWidth="0.2"
                  >
                    <circle className="kp" cx="44" cy="38" r="0.9" />
                    <circle className="kp" cx="50" cy="34" r="0.9" />
                    <circle className="kp" cx="56" cy="38" r="0.9" />
                    <circle className="kp" cx="46" cy="44" r="0.9" />
                    <circle className="kp" cx="54" cy="44" r="0.9" />
                    <circle className="kp" cx="50" cy="46" r="0.95" />
                    <circle className="kp" cx="50" cy="56" r="1.0" />
                    <circle className="kp" cx="42" cy="66" r="0.9" />
                    <circle className="kp" cx="58" cy="66" r="0.9" />
                  </g>
                  <g stroke="rgba(255,255,255,0.06)" strokeWidth="0.6">
                    <line x1="40" y1="50" x2="60" y2="50" />
                  </g>
                </svg>
                <style>{`
                .kp {
                  transform-origin: center;
                  animation: kpPulse 1.6s infinite ease-in-out;
                }
                .kp:nth-child(2) { animation-delay: 0.05s; }
                .kp:nth-child(3) { animation-delay: 0.1s; }
                .kp:nth-child(4) { animation-delay: 0.15s; }
                .kp:nth-child(5) { animation-delay: 0.2s; }
                .kp:nth-child(6) { animation-delay: 0.25s; }
                @keyframes kpPulse {
                  0% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.6); opacity: 0.6; }
                  100% { transform: scale(1); opacity: 1; }
                }
              `}</style>
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
