export default function EndpointDetails({ path, methods }) {
  const method = Object.keys(methods)[0]; // Just show the first method for demo
  const details = methods[method];

  return (
    <div>
      <h2>
        <span style={{ textTransform: "uppercase" }}>{method}</span> {path}
      </h2>
      <div>
        <strong>Summary:</strong> {details.summary || "-"}
      </div>
      <div>
        <strong>Description:</strong> {details.description || "-"}
      </div>
      <div>
        <strong>Parameters:</strong>
        <ul>
          {(details.parameters || []).map((param) => (
            <li key={param.name}>
              <b>{param.name}</b> ({param.in}) - {param.description}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
