"use client";
import { useState, useRef, useEffect } from "react";

export default function MobileUploadPage({ params }) {
  const { sessionId } = params;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // camera state (unchanged)
  const [streaming, setStreaming] = useState(false);
  const frontCamera = true; // unchanged
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
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
      setMsg("Could not start camera — permission denied or no front camera available.");
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

    // circular mask
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    if (!blob) {
      setMsg("Failed to capture image.");
      return;
    }
    const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });

    setFile(capturedFile);
    // stopCamera(); // keep commented if you want camera to keep running after capture
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
      const res = await fetch(`/api/upload/${sessionId}`, { method: "POST", body: fd });
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
      <p className="text-sm text-gray-600 mb-4">Session: <span className="font-mono">{sessionId}</span></p>

      <form onSubmit={handleSubmit} className="space-y-6 border rounded-2xl p-6 bg-white shadow-sm">
        {/* Hidden file inputs unchanged */}
        <input type="file" accept="image/*" capture="user" ref={cameraInputRef} onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" />
        <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleGalleryFile} className="hidden" />

        {/* Camera card area */}
        <div className="flex flex-col items-center">
          {/* Circular preview wrapper */}
          <div className="relative w-72 h-72 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center">
            {/* Video fills circle */}
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover ${streaming ? "" : "hidden"}`}
              playsInline
              muted
              autoPlay
              style={frontCamera ? { transform: "scaleX(-1)" } : undefined}
            />

            {/* Inactive placeholder (dashed circle) */}
            {!streaming && (
              <div className="flex items-center justify-center w-full h-full">
                <div className="w-64 h-64 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-400 text-gray-500">
                  Camera inactive
                </div>
              </div>
            )}

            {/* Dashed inner ring (always visible on top to match your previous screenshot) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 rounded-full border-2 border-dashed border-gray-400 bg-transparent"></div>
            </div>
          </div>

          {/* Buttons row */}
          <div className="mt-5 flex gap-4">
            {!streaming ? (
              <button type="button" onClick={startCamera} className="px-4 py-2 rounded-md bg-blue-600 text-white shadow">
                Open Camera
              </button>
            ) : (
              <button type="button" onClick={capturePhoto} className="px-4 py-2 rounded-md bg-yellow-500 text-black shadow">
                Capture (inside circle)
              </button>
            )}

            <button type="button" onClick={() => galleryInputRef.current?.click()} className="px-4 py-2 rounded-md bg-green-600 text-white shadow">
              Upload from Gallery
            </button>
          </div>

          {/* Upload button below centered */}
          <div className="mt-4">
            <button disabled={busy || !file} className="px-4 py-2 rounded-md bg-gray-800 text-white disabled:opacity-50">
              {busy ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>

        {/* preview thumbnail */}
        {preview && (
          <div className="flex justify-center">
            <img src={preview} alt="preview" className="w-40 h-40 rounded-full object-cover border-4 border-gray-300" />
          </div>
        )}

        {msg && <div className="text-sm text-center text-gray-700">{msg}</div>}
      </form>

      <p className="text-xs text-gray-500 mt-4">Your photo is stored temporarily for this session only.</p>
    </main>
  );
}
