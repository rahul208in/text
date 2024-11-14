
import React, { useState } from 'react';
import NavigationPanel from '../components/NavigationPanel';
import Modal from '../components/Modal';
import SummaryPage from '../components/SummaryPage';

const Home = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddReport = (data) => {
    console.log('Report data:', data);
    // Process file upload here
  };

  return (
    <div className="flex h-screen">
      <NavigationPanel onAddReport={() => setIsModalOpen(true)} />
      <main className="flex-1 p-6 bg-secondary text-white">
        <SummaryPage />
      </main>
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleAddReport} 
      />
    </div>
  );
};

export default Home;
