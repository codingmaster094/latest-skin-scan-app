// app/api/upload/[sessionId]/route.js
// Simple in-memory storage (OK for dev/local). For production, use S3 or a DB.
// app/api/upload/[sessionId]/route.js
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; 

const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes TTL
const STORE = (globalThis.__qrUploadStore ||= new Map());

function pruneOld() {
  const now = Date.now();
  for (const [key, val] of STORE.entries()) {
    if (!val?.updatedAt || now - val.updatedAt > MAX_AGE_MS) {
      STORE.delete(key);
    }
  }
}

export async function POST(req, { params }) {
  try {
    pruneOld();

    const { sessionId } = params;
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return new Response(
        JSON.stringify({ error: "No image file provided in 'file' field." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ---- IMAGE COMPRESSION (resize + format) ----
    let compressedBuffer;
    let mime;

    if (file.type.includes("jpeg") || file.type.includes("jpg")) {
      compressedBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true }) // resize if larger
        .jpeg({ quality: 80 }) // compress JPEG
        .toBuffer();
      mime = "image/jpeg";
    } else if (file.type.includes("png")) {
      compressedBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .png({ compressionLevel: 8 }) // compress PNG
        .toBuffer();
      mime = "image/png";
    } else if (file.type.includes("webp")) {
      compressedBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      mime = "image/webp";
    } else {
      // default passthrough (e.g., GIF)
      compressedBuffer = buffer;
      mime = file.type || "application/octet-stream";
    }

    STORE.set(sessionId, {
      buffer: compressedBuffer,
      mime,
      updatedAt: Date.now(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Upload failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


export async function GET(req, { params }) {
  try {
    pruneOld();

    const { sessionId } = params;
    const item = STORE.get(sessionId);

    if (!item) {
      // Not ready yet
      return new Response(JSON.stringify({ ready: false }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // Return the image as binary
    return new Response(item.buffer, {
      status: 200,
      headers: {
        "Content-Type": item.mime || "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Read failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { sessionId } = params;
    STORE.delete(sessionId);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
