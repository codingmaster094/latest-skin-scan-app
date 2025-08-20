// app/components/SkinAnalyzer.js (or wherever your component lives)
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";


const API_BASE = "https://n1omiadwic.execute-api.us-east-1.amazonaws.com/prod";

const prettyName = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export default function SkinAnalyzer() {
  const [mode, setMode] = useState("upload"); // 'upload' | 'qr'
  const [imageFile, setImageFile] = useState(null);
  const [catalogFile, setCatalogFile] = useState(null);
  const [typedCondition, setTypedCondition] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // QR/session helpers
  const [sessionId] = useState(() => Math.random().toString(36).slice(2, 10));
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // Polling when in QR mode
  useEffect(() => {
    if (mode !== "qr" || imageFile) return;

    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/upload/${sessionId}`, { cache: "no-store" });
        if (res.ok) {
          const ct = res.headers.get("content-type") || "image/jpeg";
          const blob = await res.blob();
          const file = new File([blob], `mobile-upload.${ct.split("/")[1] || "jpg"}`, { type: ct });
          setImageFile(file);

          // optional: delete from server store after retrieving
          fetch(`/api/upload/${sessionId}`, { method: "DELETE" }).catch(() => {});
        }
      } catch {
        // ignore
      }
    };

    // initial poll + interval
    poll();
    const id = setInterval(() => !stop && poll(), 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [mode, sessionId, imageFile]);

  const imgPreviewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : ""),
    [imageFile]
  );
  const imgInputRef = useRef(null);
  const catInputRef = useRef(null);

  async function handleAnalyze() {
    if (!imageFile) {
      setError("Please choose or upload a face image.");
      return;
    }
    setBusy(true);
    setError(null);
    setData(null);

    try {
      const fd = new FormData();
      fd.append("file", imageFile);
      if (catalogFile) fd.append("products", catalogFile);
      if (typedCondition.trim()) fd.append("user_condition", typedCondition.trim());

      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt}`);
      }

      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    setImageFile(null);
    setCatalogFile(null);
    setTypedCondition("");
    setData(null);
    setError(null);
    if (imgInputRef.current) imgInputRef.current.value = "";
    if (catInputRef.current) catInputRef.current.value = "";
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Skin Analysis</h1>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("upload")}
          className={`px-4 py-2 rounded-lg border ${mode === "upload" ? "bg-black text-white" : ""}`}
        >
          Upload Photo
        </button>
        <button
          onClick={() => setMode("qr")}
          className={`px-4 py-2 rounded-lg border ${mode === "qr" ? "bg-black text-white" : ""}`}
        >
          Scan QR on Mobile
        </button>
      </div>

      {/* Inputs */}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Left: Image source (Upload or QR) */}
        <div className="border rounded-xl p-4">
          {mode === "upload" ? (
            <>
              <label className="block text-sm font-medium mb-2">Face image *</label>
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="block w-full"
              />
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-2">
                Scan this QR with your phone to open the camera/upload page.
              </p>
              <div className="inline-block p-3 border rounded-xl">
                {/* Guard origin for SSR */}
                {origin ? (
                  <QRCodeCanvas value={`${window.location.origin}/upload/${sessionId}`} />
                ) : (
                  <div className="text-sm text-gray-500">Preparing QR…</div>
                )}
              </div>

              <div className="mt-3 text-sm text-gray-600">
                Waiting for mobile upload… This page checks automatically every 2 seconds.
              </div>
              <div className="mt-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/upload/${sessionId}`, { cache: "no-store" });
                      if (res.ok) {
                        const ct = res.headers.get("content-type") || "image/jpeg";
                        const blob = await res.blob();
                        const file = new File(
                          [blob],
                          `mobile-upload.${ct.split("/")[1] || "jpg"}`,
                          { type: ct }
                        );
                        setImageFile(file);
                        fetch(`/api/upload/${sessionId}`, { method: "DELETE" }).catch(() => {});
                      }
                    } catch {}
                  }}
                  className="px-3 py-2 rounded-lg border"
                >
                  Check now
                </button>
              </div>
            </>
          )}

          {imgPreviewUrl && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgPreviewUrl}
                alt="preview"
                className="max-h-56 rounded-lg border"
              />
            </div>
          )}
        </div>

        {/* Right: Catalog + condition + actions */}
        <div className="border rounded-xl p-4">
          <label className="block text-sm font-medium mb-2">
            Products file (Excel/CSV, optional)
          </label>
          <input
            ref={catInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setCatalogFile(e.target.files?.[0] || null)}
            className="block w-full"
          />

          <label className="block text-sm font-medium mt-4">
            User-typed condition (optional)
          </label>
          <input
            value={typedCondition}
            onChange={(e) => setTypedCondition(e.target.value)}
            placeholder="e.g. acne, dark circles"
            className="mt-1 block w-full border rounded-md px-3 py-2"
          />

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAnalyze}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-60"
            >
              {busy ? "Analyzing..." : "Analyze"}
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-lg border"
              disabled={busy}
            >
              Reset
            </button>
          </div>

          {error && (
            <div className="text-red-600 mt-3 text-sm break-words">{error}</div>
          )}
        </div>
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-8">
          <div className="text-sm text-gray-600">
            <strong>Latency:</strong> {data.latency_ms} ms
            {data.user_condition_echo ? (
              <> · <strong>Condition:</strong> {data.user_condition_echo}</>
            ) : null}
          </div>

          {/* Concern cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(data.concerns || {}).map(([key, val]) => {
              const overlay = data.overlays_base64_png?.[key];
              const sev = (val && val.severity) || "";
              return (
                <div key={key} className="border rounded-2xl p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{prettyName(key)}</h3>
                    <span
                      className={
                        "text-xs px-2 py-1 rounded-full " +
                        (sev === "High"
                          ? "bg-red-100 text-red-700"
                          : sev === "Medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-700")
                      }
                    >
                      {sev}
                    </span>
                  </div>
                  <div className="text-sm mb-2">
                    <strong>Score:</strong> {val?.score}/10
                  </div>
                  {overlay ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${overlay}`}
                      alt={`${key} overlay`}
                      className="w-full rounded-md border"
                    />
                  ) : (
                    <div className="text-sm text-gray-500">No overlay returned.</div>
                  )}
                  <p className="text-sm mt-2">{val?.advice}</p>
                </div>
              );
            })}
          </div>

          {/* Recommended Products (using concerns as rows as you had) */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Recommended Products</h3>
            {data.concerns ? (
              <ProductsTable
                rows={Object.entries(data.concerns).map(([name, values]) => ({
                  Concern: name,
                  Score: values.score,
                  Severity: values.severity,
                  Advice: values.advice,
                }))}
              />
            ) : (
              <div className="text-sm text-gray-500">
                No products matched. Upload a catalog with a <code>Condition</code> column or refine inputs.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductsTable({ rows }) {
  const cols = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)));
    const common = ["ProductName", "Brand", "Condition", "Price", "SKU", "URL", "Notes"];
    const rest = Array.from(set).filter((c) => !common.includes(c));
    return [...common.filter((c) => set.has(c)), ...rest];
  }, [rows]);

  return (
    <div className="overflow-x-auto border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {cols.map((c) => {
                const v = r?.[c];
                if (String(c).toLowerCase() === "url" && v) {
                  return (
                    <td key={c} className="px-3 py-2">
                      <a
                        className="text-blue-600 underline"
                        href={String(v)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Link
                      </a>
                    </td>
                  );
                }
                return (
                  <td key={c} className="px-3 py-2">
                    {String(v ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
