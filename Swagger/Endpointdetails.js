
'use client';

import { useState, useEffect } from "react";

export default function EndpointDetails({ swagger, path, methods }) {
  const [selectedMethod, setSelectedMethod] = useState(Object.keys(methods)[0]);
  const details = methods[selectedMethod];
  const baseUrl = swagger.servers?.[0]?.url || "";
  const [query, setQuery] = useState(
    (details.parameters || [])
      .filter(p => p.in === "query")
      .map(p => ({ key: p.name, value: p.default || "" }))
  );
  const [headers, setHeaders] = useState([{ key: "", value: "" }]);
  const [body, setBody] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  // Build full URL with base, path, and query params
  const buildUrl = () => {
    const params = query.filter(q => q.key && q.value !== undefined && q.value !== "")
      .map(q => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
      .join("&");
    return params ? `${baseUrl}${path}?${params}` : `${baseUrl}${path}`;
  };

  // Send API request
  const sendRequest = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(buildUrl(), {
        method: selectedMethod.toUpperCase(),
        headers: headers.filter(h => h.key).reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}),
        body: ["post", "put", "patch"].includes(selectedMethod) && body ? body : undefined,
      });
      const text = await res.text();
      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        body: text,
      });
    } catch (e) {
      setResponse({ error: e.message });
    }
    setLoading(false);
  };

  // Helper to update key-value pairs
  const updatePair = (arr, setArr, idx, field, value) => {
    const copy = [...arr];
    copy[idx][field] = value;
    setArr(copy);
  };

  // Add new header/query row
  const addRow = (arr, setArr) => setArr([...arr, { key: "", value: "" }]);

  // Update query params if method changes
  useEffect(() => {
    setQuery(
      (methods[selectedMethod].parameters || [])
        .filter(p => p.in === "query")
        .map(p => ({ key: p.name, value: p.default || "" }))
    );
  }, [selectedMethod, methods]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <select value={selectedMethod} onChange={e => setSelectedMethod(e.target.value)}>
          {Object.keys(methods).map(m => (
            <option key={m} value={m}>{m.toUpperCase()}</option>
          ))}
        </select>
        <input
          style={{ width: "60%", marginLeft: 8 }}
          value={buildUrl()}
          readOnly
        />
        <button onClick={sendRequest} disabled={loading} style={{ marginLeft: 8 }}>
          {loading ? "Sending..." : "Send"}
        </button>
      </div>

      <div>
        <h4>Headers</h4>
        {headers.map((h, i) => (
          <div key={i}>
            <input
              placeholder="Key"
              value={h.key}
              onChange={e => updatePair(headers, setHeaders, i, "key", e.target.value)}
              style={{ width: 120, marginRight: 8 }}
            />
            <input
              placeholder="Value"
              value={h.value}
              onChange={e => updatePair(headers, setHeaders, i, "value", e.target.value)}
              style={{ width: 200 }}
            />
          </div>
        ))}
        <button onClick={() => addRow(headers, setHeaders)} style={{ marginTop: 4 }}>+ Add Header</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Query Parameters</h4>
        {query.map((q, i) => (
          <div key={i}>
            <input
              placeholder="Key"
              value={q.key}
              readOnly
              style={{ width: 120, marginRight: 8, background: "#f0f0f0" }}
            />
            <input
              placeholder="Value"
              value={q.value}
              onChange={e => updatePair(query, setQuery, i, "value", e.target.value)}
              style={{ width: 200 }}
            />
          </div>
        ))}
        <button onClick={() => addRow(query, setQuery)} style={{ marginTop: 4 }}>+ Add Query Param</button>
      </div>

      {["post", "put", "patch"].includes(selectedMethod) && (
        <div style={{ marginTop: 16 }}>
          <h4>Body</h4>
          <textarea
            rows={6}
            style={{ width: "100%" }}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder='{"key":"value"}'
          />
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h4>Response</h4>
        {response ? (
          response.error ? (
            <div style={{ color: "red" }}>{response.error}</div>
          ) : (
            <div>
              <div>Status: {response.status} {response.statusText}</div>
              <div>
                <strong>Headers:</strong>
                <pre>{JSON.stringify(response.headers, null, 2)}</pre>
              </div>
              <div>
                <strong>Body:</strong>
                <pre>{response.body}</pre>
              </div>
            </div>
          )
        ) : (
          <div>No response yet.</div>
        )}
      </div>
    </div>
  );
}
