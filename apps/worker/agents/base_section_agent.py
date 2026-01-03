"""
Base Section Agent - Abstract Base Class for Resume Section Extractors

Provides shared logic for:
- Parallel LLM calling (2-Way/3-Way Cross-Check)
- Response merging and conflict resolution
- Confidence calculation
"""

import asyncio
import logging
import traceback
from typing import Dict, Any, List, Optional, Tuple, Type
from datetime import datetime
from abc import ABC, abstractmethod

from config import get_settings, AnalysisMode
from services.llm_manager import (
    LLMManager,
    LLMProvider,
    LLMResponse,
    get_llm_manager
)
from schemas.resume_schema import RESUME_SCHEMA_PROMPT

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class SectionResult:
    """Section extraction result"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    confidence_score: float = 0.0
    warnings: List[str] = field(default_factory=list)
    processing_time_ms: int = 0
    error: Optional[str] = None


class BaseSectionAgent(ABC):
    """
    Abstract base class for section-specific agents.
    Implements the cross-check logic.
    """

    def __init__(self, llm_manager: Optional[LLMManager] = None):
        self.llm_manager = llm_manager or get_llm_manager()
        self.mode = settings.ANALYSIS_MODE
    
    @property
    @abstractmethod
    def agent_name(self) -> str:
        """Agent name for logging (e.g., 'ProfileAgent')"""
        pass

    @property
    @abstractmethod
    def schema(self) -> Dict[str, Any]:
        """JSON Schema for this section"""
        pass

    @abstractmethod
    def _validate(self, data: Dict[str, Any]) -> List[str]:
        """Custom validation logic for the section"""
        pass
    
    async def process(
        self,
        text: str,
        filename: Optional[str] = None,
        mode: Optional[AnalysisMode] = None
    ) -> SectionResult:
        """
        Process the section: Call LLMs -> Merge -> Validate
        """
        start_time = datetime.now()
        analysis_mode = mode or self.mode
        agent_name = self.agent_name
        
        logger.info(f"[{agent_name}] Processing started (Mode: {analysis_mode.value})")
        
        try:
            # 1. Prepare Messages
            messages = self._create_messages(text, filename)
            
            # 2. Select Providers
            providers = self._get_providers(analysis_mode)
            
            # 3. Parallel Call
            start_call = datetime.now()
            responses = await self._call_llms(providers, messages)
            call_time = (datetime.now() - start_call).total_seconds()
            logger.debug(f"[{agent_name}] LLM calls took {call_time:.2f}s")
            
            # 4. Merge Results
            merged_data, confidence, warnings = self._merge_responses(responses)
            
            # 5. Validation
            validation_warnings = self._validate(merged_data)
            warnings.extend(validation_warnings)
            
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Log result
            if merged_data:
                logger.info(f"[{agent_name}] Success: confidence={confidence:.2f}, warnings={len(warnings)}")
            else:
                logger.warning(f"[{agent_name}] Failed to extract valid data")
                
            return SectionResult(
                success=True,
                data=merged_data,
                confidence_score=confidence,
                warnings=warnings,
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.error(f"[{agent_name}] Error: {e}")
            logger.error(traceback.format_exc())
            return SectionResult(
                success=False,
                error=str(e),
                processing_time_ms=processing_time
            )

    def _create_messages(self, text: str, filename: Optional[str]) -> List[Dict[str, str]]:
        """Create prompt messages"""
        system_prompt = f"""You are a specialized Resume Assistant.
Target Section: {self.agent_name.replace('Agent', '')}
        
rules:
{RESUME_SCHEMA_PROMPT}
"""
        user_prompt = f"""Extract the following section from the resume text:

Filename: {filename or 'Unknown'}
---
{text}
---
"""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

    def _get_providers(self, mode: AnalysisMode) -> List[LLMProvider]:
        """Select LLM providers based on mode"""
        available = self.llm_manager.get_available_providers()
        
        required = []
        if mode == AnalysisMode.PHASE_1:
            required = [LLMProvider.OPENAI, LLMProvider.GEMINI]
        else:
            required = [LLMProvider.OPENAI, LLMProvider.GEMINI, LLMProvider.CLAUDE]
            
        # Filter available
        providers = [p for p in required if p in available]
        
        if not providers:
             # Fallback to any available
            if available:
                 return available[:1]
            raise ValueError("No available LLM providers")
            
        return providers

    async def _call_llms(
        self, 
        providers: List[LLMProvider], 
        messages: List[Dict[str, str]]
    ) -> Dict[LLMProvider, LLMResponse]:
        """Call LLMs in parallel"""
        
        async def call(provider: LLMProvider):
            try:
                if provider == LLMProvider.OPENAI:
                    return await self.llm_manager.call_with_structured_output(
                        provider, messages, self.schema, temperature=0.1
                    )
                else:
                    return await self.llm_manager.call_json(
                        provider, messages, self.schema, temperature=0.1
                    )
            except Exception as e:
                logger.error(f"[{self.agent_name}] {provider.value} failed: {e}")
                return LLMResponse(provider=provider, content=None, error=str(e), model="unknown", raw_response="")

        tasks = [call(p) for p in providers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        responses = {}
        for i, res in enumerate(results):
            if isinstance(res, LLMResponse):
                responses[providers[i]] = res
        
        return responses

    def _merge_responses(
        self, 
        responses: Dict[LLMProvider, LLMResponse]
    ) -> Tuple[Dict[str, Any], float, List[str]]:
        """
        Merge strategy:
        1. If strict match (all agree) -> High confidence
        2. If majority -> Medium confidence
        3. If mismatch -> Warning
        """
        # Filter successful responses
        valid = [r for r in responses.values() if r.success and r.content]
        
        if not valid:
            return {}, 0.0, ["All LLMs failed to extract data"]

        # Simple merging logic (improve for complex fields)
        # For now: Take the most common value for each field
        
        # 1. Flatten all data
        all_data = [r.content for r in valid]
        base_data = all_data[0].copy() # Start with first provider (usually OpenAI)
        
        warnings = []
        confidence_sum = 0
        total_fields = 0
        
        keys = base_data.keys()
        
        for key in keys:
            values = []
            for data in all_data:
                if key in data:
                    values.append(data[key])
            
            # Compare values
            unique_values = self._get_unique_values(values)
            
            if len(unique_values) == 1:
                confidence_sum += 1.0
            else:
                # Mismatch
                confidence_sum += 0.5
                warnings.append(f"Mismatch in field '{key}': {unique_values}")
                # Keep the value from the first provider (OpenAI) as default
            
            total_fields += 1
            
        avg_confidence = confidence_sum / max(1, total_fields)
        
        return base_data, avg_confidence, warnings

    def _get_unique_values(self, values: List[Any]) -> List[Any]:
        """Normalize and find unique values"""
        normalized = []
        for v in values:
            if isinstance(v, list):
                s = str(sorted([str(x).lower().strip() for x in v]))
                normalized.append(s)
            else:
                normalized.append(str(v).lower().strip())
        return list(set(normalized))


from dataclasses import dataclass, field
