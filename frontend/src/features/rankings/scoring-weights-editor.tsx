"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { DEFAULT_SCORING_WEIGHTS, type ScoringWeights } from "@/lib/jobs-api";
import type { TranslationKey } from "@/i18n/messages";

const PRESETS: readonly {
  label: TranslationKey;
  skill: number;
  experience: number;
  education: number;
}[] = [
  { label: "Balanced (60/25/15)", skill: 60, experience: 25, education: 15 },
  {
    label: "Skills first (75/15/10)",
    skill: 75,
    experience: 15,
    education: 10,
  },
  {
    label: "Senior / Lead (50/40/10)",
    skill: 50,
    experience: 40,
    education: 10,
  },
  {
    label: "Fresher / Intern (50/10/40)",
    skill: 50,
    experience: 10,
    education: 40,
  },
];

export function normalizeScoringWeights(w: ScoringWeights): ScoringWeights {
  const catSum = w.skill + w.experience + w.education;
  let skill = w.skill;
  let experience = w.experience;
  let education = w.education;
  if (catSum <= 0) {
    skill = DEFAULT_SCORING_WEIGHTS.skill;
    experience = DEFAULT_SCORING_WEIGHTS.experience;
    education = DEFAULT_SCORING_WEIGHTS.education;
  } else if (Math.abs(catSum - 100) > 0.1) {
    skill = Math.round((w.skill / catSum) * 100);
    experience = Math.round((w.experience / catSum) * 100);
    education = Math.max(0, 100 - skill - experience);
  }

  const engSum = w.rule + w.semantic + w.llm;
  let rule = w.rule;
  let semantic = w.semantic;
  let llm = w.llm;
  if (engSum <= 0) {
    rule = DEFAULT_SCORING_WEIGHTS.rule;
    semantic = DEFAULT_SCORING_WEIGHTS.semantic;
    llm = DEFAULT_SCORING_WEIGHTS.llm;
  } else if (Math.abs(engSum - 100) > 0.1) {
    rule = Math.round((w.rule / engSum) * 100);
    semantic = Math.round((w.semantic / engSum) * 100);
    llm = Math.max(0, 100 - rule - semantic);
  }

  return { skill, experience, education, rule, semantic, llm };
}

export function previewWeightedScore(
  scores: {
    skill_score: number | null;
    experience_score: number | null;
    education_score: number | null;
    semantic_score: number | null;
    llm_score: number | null;
  },
  weights: ScoringWeights,
): { ruleScore: number; overallScore: number } {
  const norm = normalizeScoringWeights(weights);
  const catParts: [number | null, number][] = [
    [scores.skill_score, norm.skill / 100],
    [scores.experience_score, norm.experience / 100],
    [scores.education_score, norm.education / 100],
  ];
  const activeCat = catParts.filter(
    (entry): entry is [number, number] => entry[0] !== null && entry[1] > 0,
  );
  let ruleScore = 50;
  if (activeCat.length > 0) {
    const totalW = activeCat.reduce((acc, [, w]) => acc + w, 0);
    ruleScore =
      Math.round(
        (activeCat.reduce((acc, [s, w]) => acc + s * w, 0) / totalW) * 10,
      ) / 10;
  }

  const hasSem = scores.semantic_score !== null;
  const hasLlm = scores.llm_score !== null;
  const rW = norm.rule / 100;
  const sW = hasSem ? norm.semantic / 100 : 0;
  const lW = hasLlm ? norm.llm / 100 : 0;
  const engTotal = rW + sW + lW || 1;

  const isCustomCat =
    Math.abs(norm.skill - 60) > 0.1 ||
    Math.abs(norm.experience - 25) > 0.1 ||
    Math.abs(norm.education - 15) > 0.1;

  let overall = (rW / engTotal) * ruleScore;
  if (hasSem && scores.semantic_score !== null) {
    overall += (sW / engTotal) * scores.semantic_score;
  }
  if (hasLlm && scores.llm_score !== null) {
    const effectiveLlm = isCustomCat
      ? 0.5 * scores.llm_score + 0.5 * ruleScore
      : scores.llm_score;
    overall += (lW / engTotal) * effectiveLlm;
  }

  return {
    ruleScore: Math.round(ruleScore * 10) / 10,
    overallScore: Math.round(overall * 10) / 10,
  };
}

function rebalanceTriplet(
  current: [number, number, number],
  changedIndex: 0 | 1 | 2,
  newValue: number,
): [number, number, number] {
  const clamped = Math.max(0, Math.min(100, Math.round(newValue)));
  const remainder = 100 - clamped;
  const otherIndices = ([0, 1, 2] as const).filter((i) => i !== changedIndex);
  const [i1, i2] = otherIndices;
  const otherSum = current[i1] + current[i2];

  const next: [number, number, number] = [...current] as [
    number,
    number,
    number,
  ];
  next[changedIndex] = clamped;
  if (otherSum <= 0) {
    next[i1] = Math.round(remainder / 2);
    next[i2] = remainder - next[i1];
  } else {
    next[i1] = Math.round((current[i1] / otherSum) * remainder);
    next[i2] = Math.max(0, remainder - next[i1]);
  }
  return next;
}

export function ScoringWeightsEditor({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: ScoringWeights;
  onChange: (next: ScoringWeights) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [showEngines, setShowEngines] = useState(false);

  const catTotal = Math.round(value.skill + value.experience + value.education);

  function handleCategorySlider(
    field: "skill" | "experience" | "education",
    raw: number,
  ) {
    const idx = field === "skill" ? 0 : field === "experience" ? 1 : 2;
    const [skill, experience, education] = rebalanceTriplet(
      [value.skill, value.experience, value.education],
      idx,
      raw,
    );
    onChange({ ...value, skill, experience, education });
  }

  function handleCategoryNumber(
    field: "skill" | "experience" | "education",
    raw: string,
  ) {
    const num = Math.max(0, Math.min(100, Number(raw) || 0));
    onChange({ ...value, [field]: num });
  }

  function handleEngineSlider(field: "rule" | "semantic" | "llm", raw: number) {
    const idx = field === "rule" ? 0 : field === "semantic" ? 1 : 2;
    const [rule, semantic, llm] = rebalanceTriplet(
      [value.rule, value.semantic, value.llm],
      idx,
      raw,
    );
    onChange({ ...value, rule, semantic, llm });
  }

  return (
    <div
      className={`weights-editor${compact ? " weights-editor-compact" : ""}`}
      role="group"
      aria-label={t("Scoring weights (%)")}
    >
      <div className="weights-editor-header">
        <div>
          <strong>{t("Scoring weights (%)")}</strong>
          {!compact && (
            <p>
              {t(
                "Customize how skills, experience, and education contribute to the match score.",
              )}
            </p>
          )}
        </div>
        <div className="weights-total-row">
          <span
            className={`weights-total-pill${catTotal === 100 ? " weights-total-ok" : " weights-total-warn"}`}
          >
            {t("Total: {{total}}%", { total: catTotal })}
          </span>
          {catTotal !== 100 && (
            <button
              type="button"
              className="button button-secondary weights-balance-btn"
              disabled={disabled}
              onClick={() => onChange(normalizeScoringWeights(value))}
            >
              {t("Auto-balance 100%")}
            </button>
          )}
        </div>
      </div>

      <div
        className="weights-presets"
        role="group"
        aria-label={t("Weightpresets")}
      >
        {PRESETS.map((preset) => {
          const active =
            Math.round(value.skill) === preset.skill &&
            Math.round(value.experience) === preset.experience &&
            Math.round(value.education) === preset.education;
          return (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              className={`weights-preset-chip${active ? " weights-preset-chip-active" : ""}`}
              onClick={() =>
                onChange({
                  ...value,
                  skill: preset.skill,
                  experience: preset.experience,
                  education: preset.education,
                })
              }
            >
              {t(preset.label)}
            </button>
          );
        })}
      </div>

      <div className="weights-stacked-bar" aria-hidden="true">
        <span
          className="weights-seg weights-seg-skill"
          style={{ width: `${Math.max(0, Math.min(100, value.skill))}%` }}
        />
        <span
          className="weights-seg weights-seg-exp"
          style={{ width: `${Math.max(0, Math.min(100, value.experience))}%` }}
        />
        <span
          className="weights-seg weights-seg-edu"
          style={{ width: `${Math.max(0, Math.min(100, value.education))}%` }}
        />
      </div>

      <div className="weights-sliders-grid">
        <div className="weights-slider-row">
          <label className="weights-slider-label" htmlFor="weight-skill-number">
            <span
              className="weights-dot weights-dot-skill"
              aria-hidden="true"
            />
            <span>{t("Skills")}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            aria-label={`${t("Skills")} %`}
            value={Math.round(value.skill)}
            onChange={(event) =>
              handleCategorySlider("skill", Number(event.target.value))
            }
          />
          <div className="weights-number-wrap">
            <input
              id="weight-skill-number"
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              value={Math.round(value.skill)}
              onChange={(event) =>
                handleCategoryNumber("skill", event.target.value)
              }
            />
            <span>%</span>
          </div>
        </div>

        <div className="weights-slider-row">
          <label className="weights-slider-label" htmlFor="weight-exp-number">
            <span className="weights-dot weights-dot-exp" aria-hidden="true" />
            <span>{t("Experience")}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            aria-label={`${t("Experience")} %`}
            value={Math.round(value.experience)}
            onChange={(event) =>
              handleCategorySlider("experience", Number(event.target.value))
            }
          />
          <div className="weights-number-wrap">
            <input
              id="weight-exp-number"
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              value={Math.round(value.experience)}
              onChange={(event) =>
                handleCategoryNumber("experience", event.target.value)
              }
            />
            <span>%</span>
          </div>
        </div>

        <div className="weights-slider-row">
          <label className="weights-slider-label" htmlFor="weight-edu-number">
            <span className="weights-dot weights-dot-edu" aria-hidden="true" />
            <span>{t("Education")}</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            aria-label={`${t("Education")} %`}
            value={Math.round(value.education)}
            onChange={(event) =>
              handleCategorySlider("education", Number(event.target.value))
            }
          />
          <div className="weights-number-wrap">
            <input
              id="weight-edu-number"
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              value={Math.round(value.education)}
              onChange={(event) =>
                handleCategoryNumber("education", event.target.value)
              }
            />
            <span>%</span>
          </div>
        </div>
      </div>

      <div className="weights-engine-toggle-wrap">
        <button
          type="button"
          className="weights-engine-toggle"
          onClick={() => setShowEngines((prev) => !prev)}
          aria-expanded={showEngines}
        >
          <span>{t("Engine weights (Rule / Semantic / AI)")}</span>
          <strong>
            {Math.round(value.rule)}% / {Math.round(value.semantic)}% /{" "}
            {Math.round(value.llm)}% {showEngines ? "▴" : "▾"}
          </strong>
        </button>

        {showEngines && (
          <div className="weights-sliders-grid weights-engine-grid">
            <div className="weights-slider-row">
              <span className="weights-slider-label">{t("Rules")}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={disabled}
                aria-label={`${t("Rules")} %`}
                value={Math.round(value.rule)}
                onChange={(event) =>
                  handleEngineSlider("rule", Number(event.target.value))
                }
              />
              <div className="weights-number-wrap">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  disabled={disabled}
                  aria-label={`${t("Rules")} number`}
                  value={Math.round(value.rule)}
                  onChange={(event) =>
                    handleEngineSlider("rule", Number(event.target.value))
                  }
                />
                <span>%</span>
              </div>
            </div>

            <div className="weights-slider-row">
              <span className="weights-slider-label">{t("Semantic")}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={disabled}
                aria-label={`${t("Semantic")} %`}
                value={Math.round(value.semantic)}
                onChange={(event) =>
                  handleEngineSlider("semantic", Number(event.target.value))
                }
              />
              <div className="weights-number-wrap">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  disabled={disabled}
                  aria-label={`${t("Semantic")} number`}
                  value={Math.round(value.semantic)}
                  onChange={(event) =>
                    handleEngineSlider("semantic", Number(event.target.value))
                  }
                />
                <span>%</span>
              </div>
            </div>

            <div className="weights-slider-row">
              <span className="weights-slider-label">{t("LLM")}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                disabled={disabled}
                aria-label={`${t("LLM")} %`}
                value={Math.round(value.llm)}
                onChange={(event) =>
                  handleEngineSlider("llm", Number(event.target.value))
                }
              />
              <div className="weights-number-wrap">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  disabled={disabled}
                  aria-label={`${t("LLM")} number`}
                  value={Math.round(value.llm)}
                  onChange={(event) =>
                    handleEngineSlider("llm", Number(event.target.value))
                  }
                />
                <span>%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
