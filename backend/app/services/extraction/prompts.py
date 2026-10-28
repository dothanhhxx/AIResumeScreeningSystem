"""
Prompt templates for CV information extraction.
Owner: Person C

The output format is enforced by passing `CVExtraction` as the response schema,
so the prompt only needs to explain how to fill each field.
"""

EXTRACTION_PROMPT = """You are an HR assistant that extracts structured information from resumes.

The resume below may be written in Vietnamese, English or a mix of both.
Personal data has been replaced with tokens such as [NAME], [EMAIL], [PHONE], [URL], [DOB] — ignore them.

Rules:
- Only use information that is explicitly present in the resume. Never invent or guess.
- If a field is not mentioned, leave it null (or an empty list).
- Write all extracted values in English, except proper nouns (company and school names).
- skills: list each skill once, using its common name (e.g. "ReactJS" -> "React", "Postgres" -> "PostgreSQL").
- years_of_experience: sum the duration of work experiences (not education or projects); overlapping periods count once.
  Use "present" end dates as {today}.
- Dates: normalise to YYYY-MM when the month is known, otherwise YYYY.

Resume:
\"\"\"
{cv_text}
\"\"\"
"""


# TODO(Person B + C): agree on the raw_text format from the parser (page breaks, tables, OCR noise)
#                     and adjust the prompt if parsed text needs extra explanation.
def build_extraction_prompt(cv_text: str, today: str) -> str:
    """`cv_text` must already be passed through `strip_pii`. `today` is YYYY-MM."""
    return EXTRACTION_PROMPT.format(cv_text=cv_text.strip(), today=today)
