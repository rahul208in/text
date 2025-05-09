
'use client';

import { useState } from "react";
import Sidebar from "./components/Sidebar";
import EndpointDetails from "./components/EndpointDetails";

export default function Home() {
  const [swagger, setSwagger] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [error, setError] = useState("");

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("swagger", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    else {
      setSwagger(data.swagger);
      setError("");
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: 250, borderRight: "1px solid #eee" }}>
        <input type="file" accept=".json" onChange={handleFileUpload} />
        {error && <div style={{ color: "red" }}>{error}</div>}
        {swagger && (
          <Sidebar
            swagger={swagger}
            onSelectPath={setSelectedPath}
            selectedPath={selectedPath}
          />
        )}
      </div>
      <div style={{ flex: 1, padding: 24 }}>
        {swagger && selectedPath && (
          <EndpointDetails
            path={selectedPath}
            methods={swagger.paths[selectedPath]}
          />
        )}
        {!swagger && <div>Upload a Swagger JSON file to get started.</div>}
      </div>
    </div>
  );
}
