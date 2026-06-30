import os
from dotenv import load_dotenv
load_dotenv("AI/.env")

import services

print("Calling generate_cover_image directly...")
try:
    result = services.generate_cover_image("test prompt", "lofi")
    print("Result:", result)
except Exception as e:
    print("Caught error at top level:", type(e), e)
