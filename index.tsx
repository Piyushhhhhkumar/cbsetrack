
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

console.log("CBSE Coach: Initializing application...");

const mountApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("CBSE Coach: Root element #root not found in the DOM.");
    return;
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("CBSE Coach: Render initiated successfully.");
  } catch (err) {
    console.error("CBSE Coach: Error during ReactDOM.render:", err);
  }
};

// Ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}
