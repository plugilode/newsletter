from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
import requests
import csv
import json
import io
from datetime import datetime
import pandas as pd
from urllib.parse import urlparse
import os

app = Flask(__name__)

MISTRAL_API_KEY = "4L6JFsR7sfIKr45I8UDF5ap8aOefgjjO"
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"

# Add favicon route
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    try:
        data = request.json
        if not data:
            print("No JSON data received")
            return jsonify({'error': 'No data provided'}), 400

        country = data.get('country')
        city = data.get('city')
        category = data.get('category')
        page = data.get('page', 1)
        search_id = data.get('search_id') or datetime.now().strftime('%Y%m%d%H%M%S')

        if not all([country, city, category]):
            print(f"Missing required fields: country={country}, city={city}, category={category}")
            return jsonify({'error': 'Missing required fields'}), 400

        headers = {
            'Authorization': f'Bearer {MISTRAL_API_KEY}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        payload = {
            "model": "mistral-large-latest",
            "messages": [
                {
                    "role": "user",
                    "content": f"""Find as many online shops as possible in {city}, {country} that sell {category} and have newsletter signup. 
                    Search progress: Page {page}
                    Return only the data in this exact JSON format without any additional text:
                    {{
                        "total_found": <estimated_total>,
                        "current_page": {page},
                        "search_complete": <true/false>,
                        "search_progress": <0-100>,
                        "results": [
                            {{"url": "<shop_url>", "title": "<shop_name>", "hasNewsletter": true}},
                            ...
                        ]
                    }}
                    Continue searching and return unique results. Estimate total available results."""
                }
            ]
        }

        try:
            response = requests.post(
                MISTRAL_API_URL,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            print(f"API Response Status: {response.status_code}")
            response.raise_for_status()
            
            api_response = response.json()
            content = api_response.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            # Extract JSON from the content
            content = content.strip()
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0].strip()
            elif '```' in content:
                content = content.split('```')[1].split('```')[0].strip()
            
            try:
                parsed_content = json.loads(content)
                total_results = parsed_content.get('total_found', 0)
                current_page = parsed_content.get('current_page', page)
                search_complete = parsed_content.get('search_complete', False)
                search_progress = parsed_content.get('search_progress', 0)
                results = parsed_content.get('results', [])
                
                processed_results = []
                for result in results:
                    processed_results.append({
                        'url': result.get('url', ''),
                        'title': result.get('title', 'Shop name not available'),
                        'hasNewsletter': 'Yes' if result.get('hasNewsletter', True) else 'No'
                    })

                return jsonify({
                    'results': processed_results,
                    'total_results': total_results,
                    'current_page': current_page,
                    'has_more': not search_complete,
                    'progress': search_progress,
                    'search_id': search_id
                })

            except json.JSONDecodeError as e:
                print(f"JSON Parsing Error: {str(e)}\nContent: {content}")
                return jsonify({'error': 'Invalid JSON in API response'}), 500

        except requests.exceptions.RequestException as e:
            print(f"API Request Error: {str(e)}")
            return jsonify({'error': f'API request failed: {str(e)}'}), 500

    except Exception as e:
        print(f"General Error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/verify', methods=['POST'])
def verify_websites():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Read CSV file
        df = pd.read_csv(file)
        url_column = next((col for col in df.columns if col.lower() in ['url', 'website']), None)
        
        if not url_column:
            return jsonify({'error': 'No URL column found in CSV'}), 400

        verified_results = []
        
        for url in df[url_column]:
            try:
                # Call Mistral AI to analyze website
                headers = {
                    'Authorization': f'Bearer {MISTRAL_API_KEY}',
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
                
                payload = {
                    "model": "mistral-large-latest",
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Check if the website {url} is active and has a newsletter signup or RSS feed. Return result in JSON format with fields: isActive (true/false), hasNewsletter (true/false), hasRSS (true/false)"
                        }
                    ]
                }

                response = requests.post(
                    MISTRAL_API_URL,
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                
                response.raise_for_status()
                api_response = response.json()
                content = api_response.get('choices', [{}])[0].get('message', {}).get('content', '')
                
                try:
                    result = json.loads(content)
                except json.JSONDecodeError:
                    result = {
                        'isActive': 'active' in content.lower(),
                        'hasNewsletter': 'newsletter' in content.lower(),
                        'hasRSS': 'rss' in content.lower()
                    }

                verified_results.append({
                    'url': url,
                    'isActive': result.get('isActive', False),
                    'hasNewsletter': result.get('hasNewsletter', False),
                    'hasRSS': result.get('hasRSS', False),
                    'lastChecked': datetime.now().isoformat()
                })
            except Exception as e:
                verified_results.append({
                    'url': url,
                    'isActive': False,
                    'hasNewsletter': False,
                    'hasRSS': False,
                    'error': str(e)
                })

        return jsonify(verified_results)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download-results', methods=['POST'])
def download_results():
    try:
        data = request.json
        
        # Create CSV in memory
        si = io.StringIO()
        writer = csv.DictWriter(si, fieldnames=['url', 'logo', 'title', 'hasNewsletter'])
        writer.writeheader()
        writer.writerows(data)
        
        output = io.BytesIO()
        output.write(si.getvalue().encode('utf-8'))
        output.seek(0)
        
        return send_file(
            output,
            mimetype='text/csv',
            as_attachment=True,
            download_name='newsletter_search_results.csv'
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 