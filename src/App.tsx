import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { DocumentEditor } from './components/DocumentEditor';

export const App: React.FC = () => {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  if (activeDocId) {
    return (
      <DocumentEditor
        documentId={activeDocId}
        onBack={() => setActiveDocId(null)}
      />
    );
  }

  return <Dashboard onOpenDocument={(id) => setActiveDocId(id)} />;
};

export default App;
