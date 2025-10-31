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
  // we keep a simple string to decide mirror behavior; your startCamera uses "user"
  const frontCamera = true; // change to false if you decide to use back camera
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

  // Always start FRONT camera ("user")
  async function startCamera() {
    if (streaming) return;
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "user" }, // front camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // apply mirror to preview via CSS (see video element style below)
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

    // If front camera (mirrored preview), flip canvas horizontally so captured image matches preview
    if (frontCamera) {
      ctx.save();
      // flip horizontally around vertical center of canvas
      ctx.translate(outputSize, 0);
      ctx.scale(-1, 1);
      // drawImage parameters: source sx, sy, sw, sh, dx, dy, dw, dh
      ctx.drawImage(video, sx, sy, size, size, 0, 0, outputSize, outputSize);
      ctx.restore();
    } else {
      // back camera: draw normally
      ctx.drawImage(video, sx, sy, size, size, 0, 0, outputSize, outputSize);
    }

    // circular mask (applies equally either way)
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
        {/* Hidden input that defaults to FRONT camera */}
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
            <div className="w-72 h-72 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed text-sm z-10 text-gray-500 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              Camera inactive
            </div>
          )}

          {/* --- Improved wrapper: video fills circle and overlay scales responsively --- */}
          <div className="relative w-72 h-72 rounded-full overflow-hidden bg-black">
            {/* fill the circle fully: absolute and cover ensures no misalignment on mobile */}
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover ${
                streaming ? "" : "hidden"
              }`}
              playsInline
              muted
              autoPlay
              // mirror preview when front camera so it feels like a mirror
              style={frontCamera ? { transform: "scaleX(-1)" } : undefined}
            />

            {/* Parabolic / oval overlay (SVG). preserveAspectRatio="xMidYMid slice" makes sure the ellipse remains centered and fills properly */}
            <div className="absolute inset-0 pointer-events-none z-20">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid slice"
                className="w-full h-full"
                aria-hidden="true"
              >
                <defs>
                  <mask id="ovalMask">
                    <rect x="0" y="0" width="100" height="100" fill="black" />
                    {/* ellipse centered slightly higher for face fit */}
                    <ellipse cx="50" cy="40" rx="38" ry="34" fill="white" />
                  </mask>

                  <filter
                    id="softGlow"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feGaussianBlur stdDeviation="2.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* darken outside using the mask */}
                <rect
                  width="100"
                  height="100"
                  fill="rgba(0,0,0,0.62)"
                  mask="url(#ovalMask)"
                />

                {/* dashed oval border */}
                <ellipse
                  cx="50"
                  cy="40"
                  rx="38"
                  ry="34"
                  fill="none"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: "url(#softGlow)" }}
                />

                {/* subtle horizontal guide */}
                <line
                  x1="22"
                  x2="78"
                  y1="40"
                  y2="40"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="0.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
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
