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
              
            </div>
          )} */}
          <div className="relative w-72 h-72 rounded-full overflow-hidden bg-black">
    {/* Video Element */}
    <video
      ref={videoRef} // Assuming videoRef is defined elsewhere
      className={`absolute inset-0 w-full h-full object-cover ${
        streaming ? "" : "hidden"
      }`} // Assuming streaming is defined elsewhere
      playsInline
      muted
      autoPlay
      style={frontCamera ? { transform: "scaleX(-1)" } : undefined} // Assuming frontCamera is defined elsewhere
    />

    {/* Overlay Container with SVG and CSS */}
    <div className="absolute inset-0 pointer-events-none z-20">
      <svg
        viewBox="0 0 100 100"
        // FIX: The key change is here. 'none' will force the content to stretch and fill, 
        // which can lead to an oval shape if the container is not perfectly square in the browser.
        // We will change it to 'xMidYMid meet' to ensure the aspect ratio is maintained,
        // which helps keep the circles perfectly round, even if the aspect ratio was broken before.
        preserveAspectRatio="xMidYMid meet" 
        className="w-full h-full"
      >
        <defs>
          {/* Mask to create the 'hole' effect */}
          <mask id="hole-mask">
            <rect width="100" height="100" fill="black" />
            <circle cx="50" cy="50" r="40" fill="white" />
          </mask>

          {/* Filter for the glow effect on the inner dashed circle */}
          <filter
            id="glow-filter"
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

        {/* 1. The dark background with the hole */}
        <rect
          width="100"
          height="100"
          fill="rgba(0,0,0,0.9)"
          mask="url(#hole-mask)"
        />

        {/* 2. Three faint, solid, pulsating circles (The 'kp' elements) */}
        {/* These create the soft, radiating rings around the main dashed circle */}
        <circle
          className="kp"
          cx="50"
          cy="50" // Changed back to 50 for perfect center alignment
          r="38" // Slightly larger than the dashed circle (r=35)
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="0.8"
        />
        <circle
          className="kp"
          cx="50"
          cy="50" // Changed back to 50 for perfect center alignment
          r="42" // Second pulsating ring
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.8"
        />
        <circle
          className="kp"
          cx="50"
          cy="50" // Changed back to 50 for perfect center alignment
          r="46" // Third pulsating ring
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="0.8"
        />

        {/* 3. The main glowing, dashed circle */}
        <circle
          cx="50"
          cy="50" // Changed back to 50 for perfect center alignment
          r="35"
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          stroke-dasharray="2 3"
          stroke-width="1"
          filter="url(#glow-filter)"
        />
      </svg>

      {/* CSS Styles */}
      <style>{`
        .kp {
          transform-origin: center;
          animation: kpPulse 1.6s infinite ease-in-out;
        }
        /* Stagger the animation start time for a ripple effect */
        /* Note: The nth-child selector works based on the order of elements in the SVG */
        .kp:nth-child(2) { animation-delay: 0.05s; }
        .kp:nth-child(3) { animation-delay: 0.1s; }

        @keyframes kpPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; } /* Adjusted scale for a subtle pulse */
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
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
