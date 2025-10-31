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

  // ✅ Always start FRONT camera ("user")
  async function startCamera() {
    if (streaming) return;
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "user" }, // 👈 changed from "environment" to "user"
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
    ctx.drawImage(video, sx, sy, size, size, 0, 0, outputSize, outputSize);

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

      <form onSubmit={handleSubmit} className="space-y-4 border rounded-2xl p-4">
        {/* ✅ Hidden input that defaults to FRONT camera */}
        <input
          type="file"
          accept="image/*"
          capture="user" // 👈 changed from "environment" to "user"
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
            <div className="w-72 h-72 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed text-sm text-gray-500">
              Camera inactive
            </div>
          )}

          <div className="">
            <video
              ref={videoRef}
              className={`w-72 h-72 rounded-full object-cover ${
                streaming ? "" : "hidden"
              }`}
              playsInline
              muted
              autoPlay
            />
            <div
              aria-hidden
              className="absolute inset-0 w-72 h-72 rounded-full pointer-events-none flex items-center justify-center"
            >
              <div className="w-full h-full rounded-full border-4 border-white shadow-lg"></div>
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
