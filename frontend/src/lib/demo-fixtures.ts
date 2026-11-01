/**
 * Static, invented content for the public demo workspace.
 * Keep this file independent from API clients and persistence layers.
 */
export const demoJobs = [
  {
    title: "Product Analyst",
    team: "Product & Data",
    candidates: 18,
    status: "Active",
    updated: "Today",
  },
  {
    title: "Frontend Engineer",
    team: "Engineering",
    candidates: 12,
    status: "Reviewing",
    updated: "Yesterday",
  },
  {
    title: "People Operations Intern",
    team: "People",
    candidates: 9,
    status: "Active",
    updated: "2 days ago",
  },
] as const;

export const demoCandidates = [
  {
    id: "candidate-01",
    label: "Candidate 01",
    role: "Product Analyst",
    match: 92,
    stage: "Needs review",
    evidence: [
      {
        requirement: "SQL",
        status: "Evidence found",
        excerpt:
          "Built SQL reports to monitor weekly activation and retention trends.",
        source: "Sample CV · Project experience",
      },
      {
        requirement: "Python",
        status: "Evidence found",
        excerpt:
          "Used Python to clean event data and automate recurring analysis.",
        source: "Sample CV · Technical skills",
      },
      {
        requirement: "Experiment design",
        status: "Needs human review",
        excerpt:
          "Supported an onboarding experiment; ownership of the test design is unclear.",
        source: "Sample CV · Work history",
      },
    ],
  },
  {
    id: "candidate-02",
    label: "Candidate 02",
    role: "Product Analyst",
    match: 84,
    stage: "Shortlisted",
    evidence: [
      {
        requirement: "SQL",
        status: "Evidence found",
        excerpt:
          "Maintained warehouse queries used in monthly product reviews.",
        source: "Sample CV · Work history",
      },
      {
        requirement: "Python",
        status: "Not found in sample",
        excerpt:
          "No Python experience is stated in the provided sample resume.",
        source: "Sample CV · Full text reviewed",
      },
      {
        requirement: "Experiment design",
        status: "Evidence found",
        excerpt:
          "Partnered with product managers to interpret A/B test outcomes.",
        source: "Sample CV · Project experience",
      },
    ],
  },
  {
    id: "candidate-03",
    label: "Candidate 03",
    role: "Product Analyst",
    match: 76,
    stage: "Needs review",
    evidence: [
      {
        requirement: "SQL",
        status: "Needs human review",
        excerpt:
          "References relational data work without naming the query language.",
        source: "Sample CV · Project experience",
      },
      {
        requirement: "Python",
        status: "Evidence found",
        excerpt:
          "Prepared research datasets and reproducible analysis in Python.",
        source: "Sample CV · Education project",
      },
      {
        requirement: "Experiment design",
        status: "Not found in sample",
        excerpt: "No experiment design experience is stated in this sample.",
        source: "Sample CV · Full text reviewed",
      },
    ],
  },
] as const;

export const demoCvLibrary = [
  {
    id: "cv-01",
    candidate: "Candidate 01",
    role: "Product Analyst",
    skills: ["SQL", "Python", "Product analytics"],
    state: "Ready for review",
  },
  {
    id: "cv-02",
    candidate: "Candidate 02",
    role: "Product Analyst",
    skills: ["SQL", "Tableau", "A/B testing"],
    state: "Reviewed",
  },
  {
    id: "cv-03",
    candidate: "Candidate 03",
    role: "Product Analyst",
    skills: ["Python", "Research", "Dashboards"],
    state: "Ready for review",
  },
  {
    id: "cv-04",
    candidate: "Candidate 04",
    role: "Frontend Engineer",
    skills: ["TypeScript", "React", "Accessibility"],
    state: "Processing complete",
  },
] as const;
