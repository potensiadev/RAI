"""
Career Agent - Extracts Career/Work Experience
"""

from typing import Dict, Any, List
from .base_section_agent import BaseSectionAgent
from schemas.resume_schema import CAREER_SCHEMA

class CareerAgent(BaseSectionAgent):
    
    @property
    def agent_name(self) -> str:
        return "CareerAgent"

    @property
    def schema(self) -> Dict[str, Any]:
        return CAREER_SCHEMA

    def _validate(self, data: Dict[str, Any]) -> List[str]:
        warnings = []
        careers = data.get("careers", [])
        exp_years = data.get("exp_years", 0)
        
        if exp_years > 0 and not careers:
            warnings.append(f"Exp years is {exp_years} but careers list is empty")
            
        return warnings
