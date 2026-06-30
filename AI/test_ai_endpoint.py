import requests

# Test local FastAPI server on port 8000
url = "http://127.0.0.1:8000/api/recommendations"
data = {
    "user_id": "test_user",
    "prompt": "happy summer",
    "raw_history": [
        {"title": "Calvin Harris", "artist": "Summer"},
        {"title": "Coldplay", "artist": "Paradise"}
    ]
}

print("Sending request to Hugging Face...")
res = requests.post(url, json=data)
print("Status Code:", res.status_code)
print("Response JSON:", res.text)
