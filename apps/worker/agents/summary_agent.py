"""
Summary Agent - Generates Summary & Strengths
"""

from typing import Dict, Any, List
from .base_section_agent import BaseSectionAgent
from schemas.resume_schema import SUMMARY_SCHEMA

class SummaryAgent(BaseSectionAgent):
    
    @property
    def agent_name(self) -> str:
        return "SummaryAgent"

    @property
    def schema(self) -> Dict[str, Any]:
        return SUMMARY_SCHEMA

    def _validate(self, data: Dict[str, Any]) -> List[str]:
        warnings = []
        if not data.get("summary"):
            warnings.append("Missing Summary")
        return warnings
