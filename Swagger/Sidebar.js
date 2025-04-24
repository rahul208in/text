export default function Sidebar({ swagger, onSelectPath, selectedPath }) {
  const paths = Object.keys(swagger.paths);

  return (
    <div>
      <h3>{swagger.info?.title || "API Collection"}</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {paths.map((path) => (
          <li
            key={path}
            style={{
              padding: "8px 0",
              cursor: "pointer",
              background: selectedPath === path ? "#f0f0f0" : "transparent",
            }}
            onClick={() => onSelectPath(path)}
          >
            {path}
          </li>
        ))}
      </ul>
    </div>
  );
}
