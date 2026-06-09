import os
import json
import asyncio
import google.generativeai as genai
from backend.config import settings

_gemini_configured = False

def _configure_gemini():
    global _gemini_configured
    if not _gemini_configured:
        api_key = os.getenv("GEMINI_API_KEY") or settings.gemini_api_key
        genai.configure(api_key=api_key)
        _gemini_configured = True

async def parse_cv_to_json(cv_text: str) -> dict:
    """
    Asynchronously prompts Gemini to parse candidate CV text into structured JSON.
    """
    _configure_gemini()
    
    system_prompt = (
        "You are an AI assistant parsing candidate CVs.\n"
        "Given the CV text, extract the candidate's name and email, and evaluate their profile to provide initial score estimates (0.0 to 100.0) for:\n"
        "- technical_skills\n"
        "- experience\n"
        "- communication\n"
        "- cultural_fit\n\n"
        "You MUST return a valid JSON object matching exactly this schema, without markdown formatting or other explanation:\n"
        "{\n"
        "  \"full_name\": \"extracted full name\",\n"
        "  \"email\": \"extracted email address\",\n"
        "  \"scores\": {\n"
        "    \"technical_skills\": 80.0,\n"
        "    \"experience\": 75.0,\n"
        "    \"communication\": 85.0,\n"
        "    \"cultural_fit\": 70.0\n"
        "  }\n"
        "}"
    )

    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        system_instruction=system_prompt
    )
    
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: model.generate_content(
            f"Parse the following CV:\n\n---\n{cv_text}\n---",
            generation_config={"response_mime_type": "application/json"}
        )
    )
    
    text = response.text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
        
    return json.loads(text)
