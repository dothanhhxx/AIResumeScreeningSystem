"""
Structured CV data produced by the extractor — stored as JSON in `CV.structured_data`.
Owner: Person C  (Person D reads this for the CV detail UI)
"""

from pydantic import BaseModel, Field


class WorkExperience(BaseModel):
    title: str = Field(description="Job title, e.g. 'Backend Developer'")
    company: str | None = Field(default=None, description="Company name")
    start_date: str | None = Field(default=None, description="Start date as written, normalised to YYYY-MM or YYYY")
    end_date: str | None = Field(default=None, description="End date as YYYY-MM / YYYY, or 'present'")
    description: str | None = Field(default=None, description="Short summary of responsibilities and achievements")


class Education(BaseModel):
    institution: str | None = Field(default=None, description="School or university name")
    degree: str | None = Field(default=None, description="e.g. 'Bachelor', 'Master', 'College'")
    field_of_study: str | None = Field(default=None, description="Major, e.g. 'Computer Science'")
    graduation_year: int | None = Field(default=None, description="Year of graduation (expected year if still studying)")
    gpa: str | None = Field(default=None, description="GPA as written, e.g. '3.4/4'")


# TODO(Person C + D): confirm these fields with Person D's CV detail / ranking UI before day 3.
class CVExtraction(BaseModel):
    """Everything the matching engine needs from a CV — no contact details."""

    summary: str | None = Field(default=None, description="1-2 sentence professional summary")
    skills: list[str] = Field(default_factory=list, description="Technical and professional skills, deduplicated")
    years_of_experience: float | None = Field(
        default=None, description="Total years of professional experience, computed from work history"
    )
    experiences: list[WorkExperience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list, description="Spoken languages, e.g. 'English (IELTS 7.0)'")
