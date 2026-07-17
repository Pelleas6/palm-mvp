import json
from datetime import datetime

# Read the original file
with open('/opt/data/profiles/btcdirecteur/cron/jobs.json', 'r') as f:
    data = json.load(f)

# Find and remove the old job
old_job_id = "72fe97d42dd1"
data['jobs'] = [job for job in data['jobs'] if job['id'] != old_job_id]

# Create the new job
new_job = {
    "id": "72fe97d42dd2",
    "name": "bitcoin-daily-briefing-v2",
    "prompt": "Analyse le marché BTC : prix, sentiment et risque. Fournir une synthèse stratégique en moins de 3 phrases.",
    "skills": [],
    "skill": None,
    "model": None,
    "provider": None,
    "provider_snapshot": "gemini",
    "model_snapshot": "gemini-3.1-flash-lite",
    "base_url": None,
    "script": None,
    "no_agent": False,
    "context_from": ["c25f3ca8ef06"],
    "schedule": {
        "kind": "cron",
        "expr": "0 10 * * *",
        "display": "0 10 * * *"
    },
    "schedule_display": "0 10 * * *",
    "repeat": {
        "times": None,
        "completed": 0
    },
    "enabled": True,
    "state": "scheduled",
    "paused_at": None,
    "paused_reason": None,
    "created_at": datetime.utcnow().isoformat() + "+00:00",
    "next_run_at": "2026-07-12T10:00:00+00:00",
    "last_run_at": None,
    "last_status": "pending",
    "last_error": None,
    "last_delivery_error": None,
    "deliver": "origin",
    "origin": {
        "platform": "telegram",
        "chat_id": "6883557160",
        "chat_name": "Pelleas D",
        "thread_id": None,
        "user_id": "6883557160"
    },
    "enabled_toolsets": None,
    "workdir": None,
    "fire_claim": None
}

data['jobs'].append(new_job)
data['updated_at'] = datetime.utcnow().isoformat() + "+00:00"

# Write back
with open('/opt/data/profiles/btcdirecteur/cron/jobs.json', 'w') as f:
    json.dump(data, f, indent=2)
