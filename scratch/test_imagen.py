import os
from dotenv import load_dotenv
load_dotenv("AI/.env")

from google import genai

key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=key)

try:
    print("Testing imagen-4.0-generate-001...")
    result = client.models.generate_images(
        model='imagen-4.0-generate-001',
        prompt='A beautiful sunset over a calm ocean',
        config=dict(number_of_images=1, aspect_ratio="1:1")
    )
    print("Success! Number of generated images:", len(result.generated_images))
except Exception as e:
    print("Failed:", e)
