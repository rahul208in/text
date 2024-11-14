
import React, { useState } from 'react';

const Modal = ({ isOpen, onClose, onSubmit }) => {
  const [id, setId] = useState('');
  const [project, setProject] = useState('');
  const [component, setComponent] = useState('');
  const [branch, setBranch] = useState('');
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

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

      const result = await response.json();
      if (response.ok) {
        alert('File uploaded successfully');
        onSubmit(result);
        onClose();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert('File upload failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-4 rounded w-96">
        <h2 className="text-xl mb-4">Add Vulnerabilities Report</h2>
        <input 
          type="text" 
          placeholder="ID" 
          value={id} 
          onChange={(e) => setId(e.target.value)} 
          className="w-full mb-2 p-2 border"
        />
        <input 
          type="text" 
          placeholder="Project" 
          value={project} 
          onChange={(e) => setProject(e.target.value)} 
          className="w-full mb-2 p-2 border"
        />
        <input 
          type="text" 
          placeholder="Component" 
          value={component} 
          onChange={(e) => setComponent(e.target.value)} 
          className="w-full mb-2 p-2 border"
        />
        <input 
          type="text" 
          placeholder="Branch" 
          value={branch} 
          onChange={(e) => setBranch(e.target.value)} 
          className="w-full mb-2 p-2 border"
        />
        <input 
          type="file" 
          onChange={handleFileChange} 
          className="w-full mb-4"
        />
        <button onClick={handleSubmit} className="bg-highlight w-full p-2 mb-2">Submit</button>
        <button onClick={onClose} className="bg-error w-full p-2">Cancel</button>
      </div>
    </div>
  );
};

export default Modal;
