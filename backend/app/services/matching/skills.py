"""
Skill vocabulary + normalisation shared by the heuristic extractor and the rule scorer.
Owner: Person C

`normalize_skill("ReactJS") == normalize_skill("react.js") == "react"` so that
JD skills and CV skills written differently still match.
"""

import re
import unicodedata

# canonical display name -> aliases (lower-case, compared after _key())
SKILL_ALIASES: dict[str, list[str]] = {
    # Languages
    "Python": ["python3", "py"],
    "Java": [],
    "JavaScript": ["js", "ecmascript", "es6"],
    "TypeScript": ["ts"],
    "C": [],
    "C++": ["cpp", "c plus plus"],
    "C#": ["csharp", "c sharp"],
    "Go": ["golang"],
    "Rust": [],
    "PHP": [],
    "Ruby": [],
    "Kotlin": [],
    "Swift": [],
    "Dart": [],
    "Scala": [],
    "R": [],
    "SQL": [],
    "Bash": ["shell", "shell scripting"],
    "HTML": ["html5"],
    "CSS": ["css3"],
    # Frontend
    "React": ["reactjs", "react.js"],
    "Next.js": ["nextjs", "next"],
    "Vue.js": ["vue", "vuejs"],
    "Angular": ["angularjs"],
    "Svelte": [],
    "Redux": [],
    "Tailwind CSS": ["tailwind", "tailwindcss"],
    "Bootstrap": [],
    "jQuery": [],
    "React Native": [],
    "Flutter": [],
    # Backend
    "Node.js": ["nodejs", "node"],
    "Express": ["expressjs", "express.js"],
    "NestJS": ["nest.js", "nest"],
    "Django": [],
    "Flask": [],
    "FastAPI": [],
    "Spring Boot": ["springboot", "spring"],
    "ASP.NET": ["asp.net core", ".net", "dotnet", ".net core"],
    "Laravel": [],
    "Ruby on Rails": ["rails"],
    "GraphQL": [],
    "REST API": ["rest", "restful", "restful api", "rest apis"],
    "gRPC": [],
    "Microservices": ["microservice"],
    "Celery": [],
    # Data
    "PostgreSQL": ["postgres", "postgre", "psql"],
    "MySQL": [],
    "SQL Server": ["mssql", "microsoft sql server"],
    "Oracle": [],
    "SQLite": [],
    "MongoDB": ["mongo"],
    "Redis": [],
    "Elasticsearch": ["elastic search", "elk"],
    "Kafka": ["apache kafka"],
    "RabbitMQ": [],
    "Spark": ["apache spark", "pyspark"],
    "Hadoop": [],
    "Airflow": ["apache airflow"],
    "dbt": [],
    "Pandas": [],
    "NumPy": ["numpy"],
    "Power BI": ["powerbi"],
    "Tableau": [],
    "Excel": ["microsoft excel", "ms excel"],
    "ETL": [],
    "Data Analysis": ["data analytics"],
    # AI / ML
    "Machine Learning": ["ml"],
    "Deep Learning": ["dl"],
    "TensorFlow": [],
    "PyTorch": ["torch"],
    "scikit-learn": ["sklearn", "scikit learn"],
    "NLP": ["natural language processing"],
    "Computer Vision": ["cv", "opencv"],
    "LLM": ["large language models", "llms", "generative ai", "genai"],
    "LangChain": [],
    # Cloud / DevOps
    "AWS": ["amazon web services"],
    "Azure": ["microsoft azure"],
    "GCP": ["google cloud", "google cloud platform"],
    "Docker": [],
    "Kubernetes": ["k8s"],
    "Terraform": [],
    "Ansible": [],
    "Jenkins": [],
    "GitHub Actions": [],
    "GitLab CI": ["gitlab ci/cd"],
    "CI/CD": ["ci cd", "cicd"],
    "Linux": ["ubuntu", "centos"],
    "Nginx": [],
    "Git": ["github", "gitlab"],
    # Testing / practices
    "Unit Testing": ["unit test", "unit tests"],
    "Pytest": [],
    "Jest": [],
    "Selenium": [],
    "Cypress": [],
    "Agile": ["agile methodology"],
    "Scrum": [],
    "OOP": ["object oriented programming", "object-oriented programming"],
    "System Design": [],
    # Design / product / business
    "Figma": [],
    "UI/UX": ["ui ux", "ux", "ui design", "ux design"],
    "Photoshop": ["adobe photoshop"],
    "Project Management": [],
    "Jira": [],
    "SEO": [],
    "Digital Marketing": [],
    "Communication": ["communication skills"],
    "Teamwork": ["team work"],
    "Leadership": [],
    "Problem Solving": ["problem-solving"],
}


def _key(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .,;:-")


_LOOKUP: dict[str, str] = {}
for _canonical, _aliases in SKILL_ALIASES.items():
    _LOOKUP[_key(_canonical)] = _canonical
    for _alias in _aliases:
        _LOOKUP[_key(_alias)] = _canonical

# Short / ambiguous tokens are only accepted when listed explicitly as a skill,
# never when scanning free text (e.g. "C", "R", "Go", "ml", "cv", "next", "node").
_AMBIGUOUS = {"c", "r", "go", "ml", "dl", "cv", "next", "node", "nest", "spring", "rest", "ts", "js", "py",
              "git", "ux", "elk", "torch", "mongo", "express", "oracle", "excel", "github", "gitlab"}


def normalize_skill(skill: str) -> str:
    """Return the canonical skill name, or the cleaned input when unknown."""
    cleaned = _key(skill)
    return _LOOKUP.get(cleaned, skill.strip())


def skill_key(skill: str) -> str:
    """Comparison key: canonical name lower-cased."""
    return _key(normalize_skill(skill))


def dedupe_skills(skills: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for skill in skills:
        if not skill or not skill.strip():
            continue
        canonical = normalize_skill(skill)
        key = _key(canonical)
        if key not in seen:
            seen.add(key)
            result.append(canonical)
    return result


def _alias_pattern(alias: str) -> re.Pattern[str]:
    escaped = re.escape(alias)
    # word boundaries that also work for names like "C++", "C#", ".NET", "Node.js"
    return re.compile(rf"(?<![\w+#.]){escaped}(?![\w+#])", re.IGNORECASE)


_SCAN_PATTERNS: list[tuple[re.Pattern[str], str]] = sorted(
    (
        (_alias_pattern(alias), canonical)
        for alias, canonical in _LOOKUP.items()
        if alias not in _AMBIGUOUS and len(alias) > 1
    ),
    key=lambda item: -len(item[0].pattern),
)

# Case-sensitive patterns for ambiguous short names written in their usual casing
_CASED_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(?<![\w+#])C\+\+(?![\w+#])"), "C++"),
    (re.compile(r"(?<![\w+#])C#(?![\w+#])"), "C#"),
    (re.compile(r"(?<![\w+#.])Golang|(?<![\w+#.])Go(?=\s*(?:lang|,|/|\)|$))"), "Go"),
    (re.compile(r"(?<![\w+#.])Node(?:\.js|JS)?(?![\w])"), "Node.js"),
    (re.compile(r"(?<![\w+#.])Git(?![\w])"), "Git"),
    (re.compile(r"(?<![\w+#.])Express(?:\.js|JS)?(?![\w])"), "Express"),
    (re.compile(r"(?<![\w+#.])Next\.js|NextJS"), "Next.js"),
    (re.compile(r"(?<![\w+#.])Spring(?: Boot)?(?![\w])"), "Spring Boot"),
    (re.compile(r"(?<![\w+#.])MongoDB|(?<![\w+#.])Mongo(?![\w])"), "MongoDB"),
    (re.compile(r"(?<![\w+#.])Excel(?![\w])"), "Excel"),
    (re.compile(r"(?<![\w+#.])Oracle(?![\w])"), "Oracle"),
    (re.compile(r"(?<![\w+#.])GitHub(?![\w])"), "Git"),
    (re.compile(r"(?<![\w+#.])GitLab(?![\w])"), "Git"),
]


def find_skills_in_text(text: str) -> list[str]:
    """Scan free text for known skills (used by the offline heuristic extractor)."""
    if not text:
        return []
    found: list[tuple[int, str]] = []
    for pattern, canonical in _SCAN_PATTERNS + _CASED_PATTERNS:
        match = pattern.search(text)
        if match:
            found.append((match.start(), canonical))
    found.sort()
    return dedupe_skills([name for _, name in found])
