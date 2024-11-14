
import React from 'react';

const NavigationPanel = ({ onAddReport }) => {
  return (
    <div className="w-64 bg-primary text-white p-4">
      <h2 className="text-lg font-semibold mb-4">Navigation</h2>
      <button 
        onClick={onAddReport} 
        className="bg-highlight text-black w-full p-2 rounded mb-4">
        Add Vulnerabilities Report
      </button>
      {/* Other navigation links will go here */}
    </div>
  );
};

export default NavigationPanel;
