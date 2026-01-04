"""
Spec Agent - Extracts Education, Skills, Projects
"""

from typing import Dict, Any, List
from .base_section_agent import BaseSectionAgent
from schemas.resume_schema import SPEC_SCHEMA

class SpecAgent(BaseSectionAgent):
    
    @property
    def agent_name(self) -> str:
        return "SpecAgent"

    @property
    def schema(self) -> Dict[str, Any]:
        return SPEC_SCHEMA

    def _validate(self, data: Dict[str, Any]) -> List[str]:
        warnings = []
        if not data.get("education_level"):
            warnings.append("Missing Education Level")
        return warnings
