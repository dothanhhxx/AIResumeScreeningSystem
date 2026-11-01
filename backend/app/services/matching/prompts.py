"""
Prompt template for LLM scoring of one CV against one JD.
Owner: Person C

The output format is enforced with `LLMScoreOutput` as response schema.
Only PII-free data is sent: the structured extraction and the PII-stripped CV text.
"""

SCORING_PROMPT = """You are a fair, evidence-driven technical recruiter assistant.
Score how well the candidate fits the job. Your output supports a human recruiter; it never makes the decision.

Rules:
- Judge only job-relevant evidence present in the CV. Never infer gender, age, ethnicity, religion,
  marital status, nationality or any protected attribute, and never let them affect scores.
- Personal data has been replaced with tokens such as [NAME], [EMAIL], [PHONE] — ignore them.
- Missing evidence is not proof the candidate lacks a skill: mark it "unclear" or "not_found", do not invent it.
- skill_score / experience_score / education_score / overall_score are 0-100.
- evidence: one entry per important JD requirement, with a short verbatim quote from the CV when found.
- strengths / gaps: 2-4 short bullet phrases each. interview_questions: 3 questions that verify the gaps.
- explanation: 2-4 sentences in English citing concrete CV evidence.

Job description:
\"\"\"
{job_text}
\"\"\"

Candidate profile (structured, extracted from the CV):
{cv_json}

Candidate CV text (PII removed, may be truncated):
\"\"\"
{cv_text}
\"\"\"
"""

MAX_PROMPT_CV_CHARS = 8_000


def build_scoring_prompt(job_text: str, cv_json: str, cv_text: str) -> str:
    return SCORING_PROMPT.format(
        job_text=job_text.strip(),
        cv_json=cv_json,
        cv_text=(cv_text or "").strip()[:MAX_PROMPT_CV_CHARS],
    )
