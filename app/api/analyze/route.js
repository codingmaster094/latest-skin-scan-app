import { NextResponse } from "next/server";

const API_BASE = "https://n1omiadwic.execute-api.us-east-1.amazonaws.com/prod";

export async function POST(req) {
  try {
    // get form-data from client
    const formData = await req.formData();

    // forward to AWS API
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `API error ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
