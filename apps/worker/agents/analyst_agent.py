"""
Analyst Agent - Orchestrator for Multi-Agent Resume Analysis

Coordinates:
- ProfileAgent
- CareerAgent
- SpecAgent
- SummaryAgent

Now includes:
- SectionSeparator preprocessing for semantic normalization
- Passes pre-separated sections to each agent
"""

import asyncio
import logging
import traceback
from typing import Dict, Any, List, Optional
from datetime import datetime
from dataclasses import dataclass, field

from config import get_settings, AnalysisMode
from schemas.canonical_labels import CanonicalLabel
from utils.section_separator import get_section_separator, SemanticIR
from .profile_agent import ProfileAgent
from .career_agent import CareerAgent
from .spec_agent import SpecAgent
from .summary_agent import SummaryAgent
from .base_section_agent import SectionResult

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class Warning:
    type: str
    field: str
    message: str
    severity: str = "medium"

    def to_dict(self) -> Dict[str, str]:
        return {
            "type": self.type,
            "field": self.field,
            "message": self.message,
            "severity": self.severity
        }


@dataclass
class AnalysisResult:
    """Aggregated Analysis Result"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    confidence_score: float = 0.0
    field_confidence: Dict[str, float] = field(default_factory=dict)
    warnings: List[Warning] = field(default_factory=list)
    processing_time_ms: int = 0
    mode: AnalysisMode = AnalysisMode.PHASE_1
    error: Optional[str] = None
    semantic_ir: Optional[Dict[str, Any]] = None  # For debugging

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "confidence_score": round(self.confidence_score, 2),
            "field_confidence": self.field_confidence,
            "warnings": [w.to_dict() for w in self.warnings],
            "processing_time_ms": self.processing_time_ms,
            "mode": self.mode.value,
            "error": self.error
        }


class AnalystAgent:
    """
    Orchestrator Agent with Semantic Normalization

    Pipeline:
    1. SectionSeparator → Semantic IR
    2. Route IR blocks to appropriate agents
    3. Aggregate results
    """

    # Mapping: CanonicalLabel → Agent
    LABEL_TO_AGENT = {
        CanonicalLabel.PROFILE: "profile",
        CanonicalLabel.CAREER: "career",
        CanonicalLabel.EDUCATION: "spec",
        CanonicalLabel.SKILLS: "spec",
        CanonicalLabel.PROJECTS: "spec",
        CanonicalLabel.SUMMARY: "summary",
        CanonicalLabel.STRENGTHS: "summary",
    }

    def __init__(self):
        self.section_separator = get_section_separator()
        self.profile_agent = ProfileAgent()
        self.career_agent = CareerAgent()
        self.spec_agent = SpecAgent()
        self.summary_agent = SummaryAgent()
        self.mode = settings.ANALYSIS_MODE

    async def analyze(
        self,
        resume_text: str,
        mode: Optional[AnalysisMode] = None,
        filename: Optional[str] = None
    ) -> AnalysisResult:
        """
        Run analysis with semantic preprocessing.
        """
        start_time = datetime.now()
        analysis_mode = mode or self.mode

        logger.info("=" * 70)
        logger.info(f"[Orchestrator] Starting Multi-Agent Analysis (Mode: {analysis_mode.value})")
        logger.info(f"[Orchestrator] Text Length: {len(resume_text)} chars")

        try:
            # ─────────────────────────────────────────────────────────────────
            # Step 1: Semantic IR Generation
            # ─────────────────────────────────────────────────────────────────
            ir = self.section_separator.separate(resume_text, filename)
            logger.info(f"[Orchestrator] IR Generated: {len(ir.blocks)} blocks")
            
            for block in ir.blocks:
                logger.debug(f"  → {block.normalized_label}: {block.raw_title[:30]}...")

            # ─────────────────────────────────────────────────────────────────
            # Step 2: Prepare section-specific text
            # ─────────────────────────────────────────────────────────────────
            profile_text = self._get_section_text(ir, [CanonicalLabel.PROFILE])
            career_text = self._get_section_text(ir, [CanonicalLabel.CAREER])
            spec_text = self._get_section_text(ir, [
                CanonicalLabel.EDUCATION, 
                CanonicalLabel.SKILLS, 
                CanonicalLabel.PROJECTS,
                CanonicalLabel.CERTIFICATIONS,
                CanonicalLabel.LANGUAGES,
            ])
            summary_text = self._get_section_text(ir, [
                CanonicalLabel.SUMMARY, 
                CanonicalLabel.STRENGTHS
            ])

            # If no sections detected, fall back to full text
            if not any([profile_text, career_text, spec_text]):
                logger.warning("[Orchestrator] No sections detected, using full text")
                profile_text = resume_text
                career_text = resume_text
                spec_text = resume_text
                summary_text = resume_text

            # ─────────────────────────────────────────────────────────────────
            # Step 3: Run agents in parallel with targeted text
            # ─────────────────────────────────────────────────────────────────
            results = await asyncio.gather(
                self.profile_agent.process(profile_text or resume_text, filename, analysis_mode),
                self.career_agent.process(career_text or resume_text, filename, analysis_mode),
                self.spec_agent.process(spec_text or resume_text, filename, analysis_mode),
                self.summary_agent.process(summary_text or resume_text, filename, analysis_mode),
                return_exceptions=True
            )

            profile_res, career_res, spec_res, summary_res = results

            # ─────────────────────────────────────────────────────────────────
            # Step 4: Aggregate results (same as before)
            # ─────────────────────────────────────────────────────────────────
            merged_data = {}
            warnings = []
            total_confidence = 0.0
            agent_count = 0

            # Profile (Critical)
            if isinstance(profile_res, SectionResult) and profile_res.success and profile_res.data:
                merged_data.update(profile_res.data)
                total_confidence += profile_res.confidence_score
                agent_count += 1
                for w in profile_res.warnings:
                    warnings.append(Warning("profile", "profile", w))
            else:
                logger.error("[Orchestrator] Profile extraction failed!")
                warnings.append(Warning("critical", "profile", "Failed to extract profile"))

            # Career
            if isinstance(career_res, SectionResult) and career_res.success and career_res.data:
                merged_data.update(career_res.data)
                total_confidence += career_res.confidence_score
                agent_count += 1
                for w in career_res.warnings:
                    warnings.append(Warning("career", "career", w))
            else:
                logger.warning("[Orchestrator] Career extraction failed (Non-critical)")
                warnings.append(Warning("partial_fail", "career", "Failed to extract career"))

            # Spec
            if isinstance(spec_res, SectionResult) and spec_res.success and spec_res.data:
                merged_data.update(spec_res.data)
                total_confidence += spec_res.confidence_score
                agent_count += 1
                for w in spec_res.warnings:
                    warnings.append(Warning("spec", "spec", w))
            else:
                logger.warning("[Orchestrator] Spec extraction failed (Non-critical)")
                warnings.append(Warning("partial_fail", "spec", "Failed to extract specs"))

            # Summary
            if isinstance(summary_res, SectionResult) and summary_res.success and summary_res.data:
                merged_data.update(summary_res.data)
                total_confidence += summary_res.confidence_score
                agent_count += 1
                for w in summary_res.warnings:
                    warnings.append(Warning("summary", "summary", w))
            else:
                logger.warning("[Orchestrator] Summary generation failed (Non-critical)")

            # Finalize
            overall_confidence = total_confidence / max(1, agent_count) if agent_count > 0 else 0.0
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            logger.info(f"[Orchestrator] Completed in {processing_time}ms. Success: {agent_count}/4")

            if not merged_data:
                raise Exception("All agents failed to extract data")

            return AnalysisResult(
                success=True,
                data=merged_data,
                confidence_score=overall_confidence,
                warnings=warnings,
                processing_time_ms=processing_time,
                mode=analysis_mode,
                semantic_ir=ir.to_dict()  # Include IR for debugging
            )

        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.error(f"[Orchestrator] Fatal Error: {e}")
            logger.error(traceback.format_exc())
            return AnalysisResult(
                success=False,
                error=str(e),
                processing_time_ms=processing_time,
                mode=analysis_mode
            )

    def _get_section_text(self, ir: SemanticIR, labels: List[str]) -> str:
        """Extract text for given canonical labels from IR"""
        texts = []
        for block in ir.blocks:
            if block.normalized_label in labels:
                # Include header for context
                texts.append(f"[{block.raw_title}]\n{block.text}")
        return "\n\n".join(texts)


# Singleton
_analyst_agent: Optional[AnalystAgent] = None


def get_analyst_agent() -> AnalystAgent:
    """Analyst Agent 싱글톤 인스턴스 반환"""
    global _analyst_agent
    if _analyst_agent is None:
        _analyst_agent = AnalystAgent()
    return _analyst_agent
