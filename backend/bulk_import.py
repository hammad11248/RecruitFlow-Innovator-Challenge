import os
import random
import requests
import pandas as pd

# CSV Path handling: Navigate from backend/ folder up to root, then into resumes/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "resumes", "candidate_job_role_dataset.csv"))
API_URL = "http://127.0.0.1:8001/api/candidates/bulk-import"

def map_job_role_to_id(job_role: str) -> str:
    """Map the CSV job role to existing database job IDs."""
    role = str(job_role).lower()
    # If role mentions front, react, ui/ux, design, web, etc. map to frontend
    if any(kw in role for kw in ["frontend", "react", "ui", "ux", "design", "web", "html", "css", "vue", "angular"]):
        return "job-frontend"
    # Default to backend
    return "job-backend"

def generate_scores(experience_level: str) -> dict:
    """Generate synthetic scores with random jitter based on experience level."""
    exp = str(experience_level).lower()
    if "senior" in exp:
        return {
            "technical_skills": float(random.randint(85, 98)),
            "experience": float(random.randint(85, 98)),
            "communication": float(random.randint(80, 95)),
            "cultural_fit": float(random.randint(80, 95))
        }
    elif "mid" in exp:
        return {
            "technical_skills": float(random.randint(70, 85)),
            "experience": float(random.randint(70, 85)),
            "communication": float(random.randint(70, 90)),
            "cultural_fit": float(random.randint(75, 90))
        }
    else: # "entry" / default
        return {
            "technical_skills": float(random.randint(55, 70)),
            "experience": float(random.randint(50, 70)),
            "communication": float(random.randint(65, 80)),
            "cultural_fit": float(random.randint(65, 85))
        }

def bulk_import():
    print(f"Reading dataset from: {CSV_PATH}...")
    if not os.path.exists(CSV_PATH):
        print(f"Error: Dataset CSV file not found at {CSV_PATH}")
        return

    try:
        df = pd.read_csv(CSV_PATH)
    except Exception as e:
        print(f"Failed to read CSV with pandas: {e}")
        return

    print(f"Successfully loaded CSV. Found {len(df)} candidate records.")
    
    candidates = []
    for index, row in df.iterrows():
        cand_id = f"cand-{row['candidate_id']}"
        job_role = row['job_role']
        job_id = map_job_role_to_id(job_role)
        email = f"candidate_{row['candidate_id']}@example.com"
        full_name = f"Candidate {row['candidate_id']}"
        
        # Build a synthesized CV text
        cv_text = (
            f"Full Name: {full_name}\n"
            f"Email: {email}\n"
            f"Target Position: {job_role}\n"
            f"Experience Level: {row['experience_level']}\n"
            f"Qualification: {row['qualification']}\n"
            f"Skills: {row['skills']}\n"
        )
        
        # Generate synthetic scores with jitter
        scores = generate_scores(row['experience_level'])
        
        candidate_payload = {
            "id": cand_id,
            "job_id": job_id,
            "email": email,
            "full_name": full_name,
            "cv_text": cv_text,
            "scores": scores,
            "funnel_status": "SCREENING_PENDING"
        }
        candidates.append(candidate_payload)

    print(f"Sending {len(candidates)} candidates to API bulk-import endpoint: {API_URL}...")
    try:
        response = requests.post(API_URL, json=candidates, headers={"Content-Type": "application/json"})
        if response.status_code in [200, 201]:
            print(f"Bulk import successful! Server response: {response.json()}")
        else:
            print(f"Failed to bulk import. HTTP Status {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Error connecting to server: {e}")

if __name__ == "__main__":
    bulk_import()