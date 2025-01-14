import React, { useState } from 'react';
import axios from 'axios';
import Papa from 'papaparse';
import './NewsletterSearchApp.css';

const NewsletterSearchApp = () => {
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [verificationResults, setVerificationResults] = useState([]);
  const [verifying, setVerifying] = useState(false);

  const searchStores = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('https://api.magistral.ai/search', {
        headers: {
          'Authorization': '4L6JFsR7sfIKr45I8UDF5ap8aOefgjjO',
          'Content-Type': 'application/json'
        },
        data: {
          query: `Find online shops in ${city}, ${country} that sell ${category} and have newsletter signup`,
          searchEngines: ['google', 'yahoo']
        }
      });

      const processedResults = response.data.results.map(result => ({
        url: result.url,
        logo: result.logo || 'logo_plugilo_black.svg',
        title: result.title,
        hasNewsletter: result.hasNewsletter ? 'Yes' : 'No'
      }));

      setResults(processedResults);
    } catch (err) {
      setError('Failed to fetch results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'newsletter_search_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        complete: (results) => {
          verifyWebsites(results.data);
        },
        header: true
      });
    }
  };

  const verifyWebsites = async (websites) => {
    setVerifying(true);
    setError(null);
    const verifiedResults = [];

    try {
      for (const site of websites) {
        const url = site.url || site.URL || site.Website || site.website;
        if (!url) continue;

        try {
          const response = await axios.post('https://api.magistral.ai/analyze', {
            headers: {
              'Authorization': '4L6JFsR7sfIKr45I8UDF5ap8aOefgjjO',
              'Content-Type': 'application/json'
            },
            data: {
              url: url,
              checkFeatures: ['newsletter', 'rss']
            }
          });

          verifiedResults.push({
            url: url,
            isActive: response.data.isActive || false,
            hasNewsletter: response.data.hasNewsletter || false,
            hasRSS: response.data.hasRSS || false,
            lastChecked: new Date().toISOString()
          });
        } catch (err) {
          verifiedResults.push({
            url: url,
            isActive: false,
            hasNewsletter: false,
            hasRSS: false,
            error: 'Failed to verify'
          });
        }
      }

      setVerificationResults(verifiedResults);
    } catch (err) {
      setError('Verification process failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const downloadVerificationResults = () => {
    const csv = Papa.unparse(verificationResults);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'website_verification_results.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="newsletter-search-container">
      <h1>Newsletter Search Tool</h1>
      
      <div className="search-form">
        <input
          type="text"
          placeholder="Enter country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
        <input
          type="text"
          placeholder="Enter city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <input
          type="text"
          placeholder="Enter category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <button 
          onClick={searchStores}
          disabled={loading || !country || !city || !category}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="verification-section">
        <h2>Verify Existing Websites</h2>
        <div className="file-upload">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={verifying}
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="file-upload-label">
            {verifying ? 'Verifying...' : 'Upload CSV File'}
          </label>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {results.length > 0 && (
        <div className="results-section">
          <button onClick={downloadCSV} className="download-btn">
            Download Results (CSV)
          </button>
          
          <div className="results-grid">
            {results.map((result, index) => (
              <div key={index} className="result-card">
                <img src={result.logo} alt={result.title} className="store-logo" />
                <h3>{result.title}</h3>
                <a href={result.url} target="_blank" rel="noopener noreferrer">
                  Visit Store
                </a>
                <p>Newsletter: {result.hasNewsletter}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {verificationResults.length > 0 && (
        <div className="verification-results">
          <h2>Verification Results</h2>
          <button onClick={downloadVerificationResults} className="download-btn">
            Download Verification Results
          </button>
          
          <div className="results-grid">
            {verificationResults.map((result, index) => (
              <div key={index} className="result-card verification-card">
                <h3>{result.url}</h3>
                <p>Status: {result.isActive ? 'Active' : 'Inactive'}</p>
                <p>Newsletter: {result.hasNewsletter ? 'Yes' : 'No'}</p>
                <p>RSS Feed: {result.hasRSS ? 'Yes' : 'No'}</p>
                {result.error && <p className="error">{result.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsletterSearchApp; 