import formidable from "formidable";
import SwaggerParser from "swagger-parser";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File upload error" });

    const file = files.swagger;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const data = fs.readFileSync(file.filepath, "utf8");
      const json = JSON.parse(data);
      await SwaggerParser.validate(json); // Throws if invalid
      res.status(200).json({ swagger: json });
    } catch (e) {
      res.status(400).json({ error: "Invalid Swagger file: " + e.message });
    }
  });
}
