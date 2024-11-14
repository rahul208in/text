
import React, { useState } from 'react';

const Modal = ({ onClose }) => {
  const [id, setId] = useState('');
  const [project, setProject] = useState('');
  const [component, setComponent] = useState('');
  const [branch, setBranch] = useState('');
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append('id', id);
    formData.append('project', project);
    formData.append('component', component);
    formData.append('branch', branch);
    formData.append('vulReport', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error("File upload failed");
      }

      const result = await response.json();
      console.log("Upload result:", result);
      alert("File uploaded successfully");
      onClose(); // Close the modal
    } catch (error) {
      console.error("Upload failed:", error);
      alert("File upload failed");
    }
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <label>
          ID:
          <input type="text" value={id} onChange={(e) => setId(e.target.value)} required />
        </label>
        <label>
          Project:
          <input type="text" value={project} onChange={(e) => setProject(e.target.value)} required />
        </label>
        <label>
          Component:
          <input type="text" value={component} onChange={(e) => setComponent(e.target.value)} required />
        </label>
        <label>
          Branch:
          <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} required />
        </label>
        <label>
          Vulnerability Report:
          <input type="file" onChange={handleFileChange} required />
        </label>
        <button type="submit">Submit</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
};

export default Modal;
