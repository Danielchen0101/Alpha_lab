import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

// Collection is disabled unless REACT_APP_ENABLE_ANALYTICS=true. When enabled,
// sanitized metrics are emitted as `alphalab:web-vital` browser events so a
// deployment can attach its own first-party reporter without collecting URLs,
// account identifiers, symbols, or any other workspace data.
reportWebVitals();
