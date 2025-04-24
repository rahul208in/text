
import { NextResponse } from "next/server";
import SwaggerParser from "swagger-parser";

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("swagger");
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    await SwaggerParser.validate(json); // Throws if invalid
    return NextResponse.json({ swagger: json });
  } catch (e) {
    return NextResponse.json({ error: "Invalid Swagger file: " + e.message }, { status: 400 });
  }
}
