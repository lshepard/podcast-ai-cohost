import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// For older React versions: ReactDOM.render(<App />, document.getElementById('root'));

// For React 18+
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 