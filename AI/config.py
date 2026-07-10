import os
from upstash_redis import Redis
from google import genai
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("UPSTASH_REDIS_REST_URL")
REDIS_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")

redis_client = Redis(url=REDIS_URL, token=REDIS_TOKEN)

# Main model (gemini-3.5-flash)
primary_llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    max_retries=1
)

# Fallback models (avoiding "pro" models since the free tier API key has a quota limit of 0 for them)
fallbacks = [
    ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=os.getenv("GEMINI_API_KEY"), max_retries=1),
    ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", google_api_key=os.getenv("GEMINI_API_KEY"), max_retries=1),
    ChatGoogleGenerativeAI(model="gemma-4-26b-a4b-it", google_api_key=os.getenv("GEMINI_API_KEY"), max_retries=1),
]

# Combined unstructured model with fallback chain
llm = primary_llm.with_fallbacks(fallbacks)

# Helper function to get structured LLM with fallbacks
def get_structured_llm(schema):
    primary_structured = primary_llm.with_structured_output(schema)
    fallbacks_structured = [fb.with_structured_output(schema) for fb in fallbacks]
    return primary_structured.with_fallbacks(fallbacks_structured)

imagen_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))