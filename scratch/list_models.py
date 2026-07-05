import os
from dotenv import load_dotenv
load_dotenv("AI/.env")

from google import genai

key = os.getenv("GEMINI_API_KEY")
print("Key exists:", bool(key))

client = genai.Client(api_key=key)
try:
    for model in client.models.list():
        print(model.name, model.supported_actions)
except Exception as e:
    print("Error:", e)
