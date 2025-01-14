async function searchStores() {
    const country = document.getElementById('country').value;
    const city = document.getElementById('city').value;
    const category = document.getElementById('category').value;
    const errorDiv = document.getElementById('error');
    const resultsDiv = document.getElementById('results');
    const statusDiv = document.getElementById('status');
    
    // Reset for new searches
    window.currentPage = 1;
    window.allResults = [];
    window.searchId = Date.now().toString();
    window.isSearching = true;

    if (!country || !city || !category) {
        errorDiv.textContent = 'Please fill in all fields';
        return;
    }

    while (window.isSearching) {
        await fetchResults(country, city, category);
    }
}

async function fetchResults(country, city, category) {
    const errorDiv = document.getElementById('error');
    const statusDiv = document.getElementById('status');

    try {
        updateSearchStatus(window.currentPage);

        const response = await fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                country, 
                city, 
                category, 
                page: window.currentPage,
                search_id: window.searchId
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            // Add new results to existing results
            window.allResults = [...new Set([...window.allResults, ...data.results])];
            
            // Display all results
            displayResults(window.allResults);
            updateStatus(data);

            // Continue searching if there are more results
            if (data.has_more) {
                window.currentPage += 1;
            } else {
                window.isSearching = false;
                showSearchComplete(data.total_results);
            }
        } else {
            console.error('Search failed:', data);
            errorDiv.textContent = data.error || 'Search failed. Please try again.';
            window.isSearching = false;
        }
    } catch (error) {
        console.error('Search error:', error);
        errorDiv.textContent = 'An error occurred during search. Please try again.';
        window.isSearching = false;
    }
}

function updateSearchStatus(page) {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = `
        <div class="progress-container">
            <div class="progress-bar searching"></div>
            <div class="progress-text">
                Searching page ${page}...
                <button onclick="stopSearch()" class="stop-search-btn">Stop Search</button>
            </div>
        </div>
    `;
}

function stopSearch() {
    window.isSearching = false;
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML += '<p>Search stopped by user</p>';
}

function showSearchComplete(totalResults) {
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML += `
        <div class="search-complete">
            <p>Search complete! Found ${totalResults} results.</p>
        </div>
    `;
}

function showLargeResultsNotification(totalResults) {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'notification';
    notificationDiv.innerHTML = `
        <div class="notification-content">
            <h3>Large Result Set Found</h3>
            <p>We found ${totalResults} results. Currently showing the first 100.</p>
            <p>Use the "Load More" button below to see additional results.</p>
            <button onclick="this.parentElement.remove()">Got it</button>
        </div>
    `;
    document.body.appendChild(notificationDiv);
}

async function loadMoreResults() {
    const country = document.getElementById('country').value;
    const city = document.getElementById('city').value;
    const category = document.getElementById('category').value;
    
    window.currentPage += 1;
    await fetchResults(country, city, category);
}

function updateStatus(data) {
    const statusDiv = document.getElementById('status');
    const totalShown = window.allResults.length;
    const percentComplete = (totalShown / data.total_results) * 100;
    
    statusDiv.innerHTML = `
        <div class="progress-container">
            <div class="progress-bar" style="width: ${percentComplete}%"></div>
            <div class="progress-text">
                Showing ${totalShown} of ${data.total_results} results
                ${data.has_more ? '(More available)' : '(All results shown)'}
            </div>
        </div>
    `;
}

function showLoadMoreButton(totalResults) {
    const resultsDiv = document.getElementById('results');
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.className = 'load-more-btn';
    loadMoreBtn.textContent = `Load More (${resultsDiv.children.length} of ${totalResults})`;
    loadMoreBtn.onclick = loadMoreResults;
    resultsDiv.appendChild(loadMoreBtn);
}

function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    if (results.length === 0) {
        resultsDiv.innerHTML = '<p>No results found</p>';
        return;
    }

    results.forEach(result => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>${result.title}</h3>
            <a href="${result.url}" target="_blank">Visit Store</a>
            <p>Newsletter: ${result.hasNewsletter}</p>
        `;
        resultsDiv.appendChild(card);
    });

    // Add download button
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download Results (CSV)';
    downloadBtn.onclick = () => downloadResults(results);
    resultsDiv.insertBefore(downloadBtn, resultsDiv.firstChild);
}

async function downloadResults(results) {
    try {
        const response = await fetch('/download-results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(results)
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'newsletter_search_results.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        document.getElementById('error').textContent = 'Failed to download results';
    }
}

// Set up file upload handler
document.getElementById('csvFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/verify', {
            method: 'POST',
            body: formData
        });

        const results = await response.json();
        
        if (response.ok) {
            displayVerificationResults(results);
        } else {
            document.getElementById('error').textContent = results.error || 'Verification failed';
        }
    } catch (error) {
        document.getElementById('error').textContent = 'An error occurred during verification';
    }
});

function displayVerificationResults(results) {
    const resultsDiv = document.getElementById('verificationResults');
    resultsDiv.innerHTML = '<h2>Verification Results</h2>';

    const grid = document.createElement('div');
    grid.className = 'results-grid';

    results.forEach(result => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>${result.url}</h3>
            <p>Status: ${result.isActive ? 'Active' : 'Inactive'}</p>
            <p>Newsletter: ${result.hasNewsletter ? 'Yes' : 'No'}</p>
            <p>RSS Feed: ${result.hasRSS ? 'Yes' : 'No'}</p>
            ${result.error ? `<p class="error">${result.error}</p>` : ''}
        `;
        grid.appendChild(card);
    });

    resultsDiv.appendChild(grid);
} 