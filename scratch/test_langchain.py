import os
from dotenv import load_dotenv
load_dotenv("AI/.env")

from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

class TestSchema(BaseModel):
    name: str = Field(description="A test name")

def test_model(model_name):
    print(f"Testing model: {model_name}")
    try:
        llm = ChatGoogleGenerativeAI(model=model_name, google_api_key=os.getenv("GEMINI_API_KEY"))
        structured_llm = llm.with_structured_output(TestSchema)
        res = structured_llm.invoke("Generate a test name.")
        print(f"Success: {res}")
    except Exception as e:
        print(f"Failed for {model_name}: {e}")

test_model("gemini-3.5-flash")
test_model("gemini-3.1-pro-preview")
test_model("gemini-3.1-flash-lite")
test_model("gemini-2.5-pro")
test_model("gemini-2.5-flash")
test_model("gemma-4-31b-it")
