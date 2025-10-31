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
  const [facingMode, setFacingMode] = useState("user"); // front camera by default
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Create preview URL when file changes
  useEffect(() => {
    if (!file) return setPreview(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Start camera with proper facing mode
  async function startCamera() {
    try {
      stopCamera(); // clear any existing
      const constraints = {
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: facingMode === "user" ? "user" : { exact: "environment" },
        },
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
      console.error("Camera start error:", err);
      setMsg(
        "⚠️ Could not start camera. Make sure you’ve granted permission and are using HTTPS or localhost."
      );
    }
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setStreaming(false);
  }

  async function flipCamera() {
    stopCamera();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }

  useEffect(() => {
    if (streaming) startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setMsg("Camera not ready yet.");
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

    ctx.drawImage(video, sx, sy, size, size, 0, 0, outputSize, outputSize);

    // Circular mask
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    const blob = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", 0.9)
    );

    if (!blob) return setMsg("Capture failed.");

    const capturedFile = new File([blob], `photo-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    setFile(capturedFile);
    stopCamera();
    setMsg("✅ Photo captured!");
  }

  function handleGalleryFile(e) {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setMsg("Please choose or capture a photo first.");
    setBusy(true);
    setMsg("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`/api/upload/${sessionId}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");

      setMsg("✅ Uploaded successfully!");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => stopCamera(), []);

  return (
    <main className="p-6 max-w-lg mx-auto text-center">
      <h1 className="text-2xl font-semibold mb-4">Upload Your Photo</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 border rounded-2xl p-4 shadow"
      >
        {/* Hidden input */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleGalleryFile}
          className="hidden"
        />

        {/* Camera preview */}
        <div className="relative flex justify-center">
          {!streaming && !preview && (
            <div className="w-72 h-72 bg-gray-200 rounded-full flex items-center justify-center border-2 border-dashed text-gray-500">
              Camera not active
            </div>
          )}

          {streaming && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-72 h-72 rounded-full object-cover"
              />
              <div className="absolute inset-0 w-72 h-72 rounded-full border-4 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] pointer-events-none"></div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        <div className="flex flex-wrap gap-3 justify-center">
          {!streaming && (
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white"
            >
              Open Camera
            </button>
          )}

          {streaming && (
            <>
              <button
                type="button"
                onClick={capturePhoto}
                className="px-4 py-2 rounded-lg bg-yellow-500 text-black"
              >
                Capture
              </button>
              <button
                type="button"
                onClick={flipCamera}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white"
              >
                Flip
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 rounded-lg bg-red-600 text-white"
              >
                Close
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-green-600 text-white"
          >
            Gallery
          </button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="flex justify-center mt-3">
            <img
              src={preview}
              alt="preview"
              className="w-40 h-40 rounded-full object-cover border-4 border-gray-300"
            />
          </div>
        )}

        <button
          disabled={busy || !file}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {busy ? "Uploading..." : "Upload"}
        </button>

        {msg && <div className="text-sm mt-1 text-center">{msg}</div>}
      </form>

      <p className="text-xs text-gray-500 mt-4">
        Works best on HTTPS or localhost. Default camera: Front
      </p>
    </main>
  );
}
