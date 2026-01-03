"""
Profile Agent - Extracts Profile Section
"""

from typing import Dict, Any, List
from .base_section_agent import BaseSectionAgent
from schemas.resume_schema import PROFILE_SCHEMA

class ProfileAgent(BaseSectionAgent):
    
    @property
    def agent_name(self) -> str:
        return "ProfileAgent"

    @property
    def schema(self) -> Dict[str, Any]:
        return PROFILE_SCHEMA

    def _validate(self, data: Dict[str, Any]) -> List[str]:
        warnings = []
        if not data.get("name"):
            warnings.append("Missing Name")
        if not data.get("phone") and not data.get("email"):
            warnings.append("Missing Contact Info (Phone/Email)")
        return warnings
