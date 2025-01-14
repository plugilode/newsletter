import React from 'react';
import NewsletterSearchApp from './components/NewsletterSearchApp';
import logo from './logo_plugilo_black.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="Plugilo logo" />
      </header>
      <NewsletterSearchApp />
    </div>
  );
}

export default App; 