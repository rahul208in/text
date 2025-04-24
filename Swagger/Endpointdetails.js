
'use client';

import { useState, useEffect } from "react";

export default function EndpointDetails({ swagger, path, methods }) {
  // Validation: check for required swagger fields
  if (!swagger) return <div>No Swagger file loaded.</div>;
  if (!swagger.servers || !swagger.servers[0]?.url) return <div>Swagger file missing 'servers' or 'servers[0].url'.</div>;
  if (!swagger.paths || !swagger.paths[path]) return <div>Swagger file missing 'paths' or selected path.</div>;
  if (!methods) return <div>No methods found for this endpoint.</div>;

  const [selectedMethod, setSelectedMethod] = useState(Object.keys(methods)[0]);
  const details = methods[selectedMethod] || {};
  const baseUrl = swagger.servers[0].url;

  // Extract query parameters and auto-fill with example/default
  const getInitialQuery = () => (
    (details.parameters || [])
      .filter(p => p.in === "query")
      .map(p => ({
        key: p.name,
        value: p.example !== undefined ? p.example : (p.default !== undefined ? p.default : ""),
        description: p.description || "",
        required: p.required || false
      }))
  );
  const [query, setQuery] = useState(getInitialQuery);

  // Update query params if method changes
  useEffect(() => {
    setQuery(getInitialQuery());
    // eslint-disable-next-line
  }, [selectedMethod]);

  // Build full URL with base, path, and query params
  const buildUrl = () => {
    const params = query
      .filter(q => q.key && q.value !== undefined && q.value !== "")
      .map(q => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
      .join("&");
    return params ? `${baseUrl}${path}?${params}` : `${baseUrl}${path}`;
  };

  // Send API request
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendRequest = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(buildUrl(), {
        method: selectedMethod.toUpperCase(),
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

  // Helper to update query value
  const updateQueryValue = (idx, value) => {
    setQuery(qs => {
      const copy = [...qs];
      copy[idx].value = value;
      return copy;
    });
  };

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

      <div style={{ marginTop: 16 }}>
        <h4>Query Parameters</h4>
        {query.length === 0 && <div>No query parameters.</div>}
        {query.map((q, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <label>
              <b>{q.key}</b>
              {q.required && <span style={{ color: "red" }}> *</span>}
              {q.description && <span style={{ color: "#888", marginLeft: 8 }}>{q.description}</span>}
            </label>
            <input
              style={{ width: 200, marginLeft: 8 }}
              value={q.value}
              onChange={e => updateQueryValue(i, e.target.value)}
            />
          </div>
        ))}
      </div>

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
