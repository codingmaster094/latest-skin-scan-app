// app/upload/[sessionId]/page.jsx
"use client";

import { useState } from "react";

export default function MobileUploadPage({ params }) {
  const { sessionId } = params;
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Upload your photo</h1>
      <p className="text-sm text-gray-600 mb-4">
        Session: <span className="font-mono">{sessionId}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 border rounded-2xl p-4">
        <input
          type="file"
          accept="image/*"
          capture="environment" // opens camera on many phones
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full"
        />

        <button
          disabled={busy || !file}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {busy ? "Uploading..." : "Upload"}
        </button>

        {msg && <div className="text-sm mt-1">{msg}</div>}
      </form>

      <p className="text-xs text-gray-500 mt-4">
        Your photo is stored temporarily for this session only.
      </p>
    </main>
  );
}
