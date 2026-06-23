import json
import logging
import requests
from backend.config import settings

logger = logging.getLogger(__name__)

def call_gemini_rest(prompt: str, system_instruction: str = None, response_json: bool = False) -> str:
    """
    Call Google Gemini API directly using HTTP REST request.
    Bypasses legacy SDK discovery endpoint issues with new AQ. keys.
    """
    api_key = settings.gemini_api_key
    model = settings.gemini_model or "gemini-2.5-flash"
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }
    
    generation_config = {}
    if response_json:
        generation_config["responseMimeType"] = "application/json"
    if generation_config:
        payload["generationConfig"] = generation_config
        
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [
                {"text": system_instruction}
            ]
        }
        
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        if response.status_code == 200:
            res_data = response.json()
            candidates = res_data.get("candidates", [])
            if candidates:
                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                return text.strip()
            raise ValueError(f"No candidates returned in Gemini response: {res_data}")
        else:
            raise ValueError(f"Gemini API returned status {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Error calling Gemini REST API: {e}")
        raise
