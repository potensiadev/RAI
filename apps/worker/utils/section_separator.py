"""
Section Separator - Header-based Document Sectioning

Detects section headers in resume text and groups content into Semantic IR.
This is the preprocessing step before LLM analysis.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

from schemas.canonical_labels import (
    normalize_section_title,
    CanonicalLabel,
    CANONICAL_LABEL_MAP,
)

logger = logging.getLogger(__name__)


@dataclass
class SemanticBlock:
    """A semantic block in the document"""
    block_id: str
    raw_title: str  # Original title from document
    normalized_label: str  # Canonical label
    text: str  # Content of the section
    confidence: float = 1.0  # How confident we are in the label
    start_pos: int = 0  # Position in original text
    end_pos: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "block_id": self.block_id,
            "raw_title": self.raw_title,
            "normalized_label": self.normalized_label,
            "text": self.text,
            "confidence": self.confidence,
        }


@dataclass
class SemanticIR:
    """Intermediate Representation of a resume"""
    blocks: List[SemanticBlock] = field(default_factory=list)
    raw_text: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_section(self, label: str) -> Optional[SemanticBlock]:
        """Get first block matching the label"""
        for block in self.blocks:
            if block.normalized_label == label:
                return block
        return None

    def get_all_sections(self, label: str) -> List[SemanticBlock]:
        """Get all blocks matching the label"""
        return [b for b in self.blocks if b.normalized_label == label]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "blocks": [b.to_dict() for b in self.blocks],
            "metadata": self.metadata,
        }


class SectionSeparator:
    """
    Separates resume text into semantic sections.
    
    Strategy:
    1. Detect header lines using keyword matching
    2. Group content between headers
    3. Map headers to canonical labels
    """

    # Header detection patterns
    HEADER_PATTERNS = [
        # Korean patterns with markers
        r'^[■●◆▶★☆○◇▷►•※]\s*(.+)$',
        # Numbered headers
        r'^[0-9]+[\.)\]]\s*(.+)$',
        # ALL CAPS (English)
        r'^([A-Z][A-Z\s]{3,})$',
        # Korean standalone headers (2-6 chars ending with 사항/경력 etc)
        r'^([가-힣]{2,6}(?:사항|경력|정보|학력|기술|역량|소개))\s*$',
        # Bracketed headers
        r'^\[(.+)\]$',
        r'^【(.+)】$',
        r'^〔(.+)〕$',
        # Colon headers
        r'^(.+)\s*[:：]\s*$',
    ]

    def __init__(self):
        # Compile patterns
        self.header_patterns = [re.compile(p, re.MULTILINE) for p in self.HEADER_PATTERNS]
        
        # Build keyword set for quick lookup
        self.header_keywords = set()
        for titles in CANONICAL_LABEL_MAP.values():
            self.header_keywords.update([t.lower() for t in titles])

    def separate(self, text: str, filename: Optional[str] = None) -> SemanticIR:
        """
        Separate text into semantic blocks.
        
        Args:
            text: Raw resume text
            filename: Optional filename for hints
            
        Returns:
            SemanticIR with detected sections
        """
        if not text:
            return SemanticIR(raw_text=text)

        logger.debug(f"[SectionSeparator] Processing text of {len(text)} chars")

        # Step 1: Detect all potential header positions
        headers = self._detect_headers(text)
        logger.debug(f"[SectionSeparator] Detected {len(headers)} headers")

        # Step 2: Create blocks between headers
        blocks = self._create_blocks(text, headers)
        
        # Step 3: Handle content before first header (likely profile/name)
        if headers and headers[0][1] > 0:
            preamble = text[:headers[0][1]].strip()
            if preamble and len(preamble) > 10:
                blocks.insert(0, SemanticBlock(
                    block_id="b0",
                    raw_title="(Preamble)",
                    normalized_label=CanonicalLabel.PROFILE,
                    text=preamble,
                    confidence=0.7,
                    start_pos=0,
                    end_pos=headers[0][1]
                ))

        # Build metadata
        metadata = {
            "total_blocks": len(blocks),
            "detected_labels": list(set(b.normalized_label for b in blocks)),
        }
        if filename:
            metadata["filename"] = filename

        ir = SemanticIR(
            blocks=blocks,
            raw_text=text,
            metadata=metadata
        )

        logger.info(f"[SectionSeparator] Created IR with {len(blocks)} blocks: {metadata['detected_labels']}")
        return ir

    def _detect_headers(self, text: str) -> List[Tuple[str, int, int]]:
        """
        Detect header lines and their positions.
        
        Returns:
            List of (header_text, start_pos, end_pos)
        """
        headers = []
        lines = text.split('\n')
        current_pos = 0

        for line in lines:
            line_stripped = line.strip()
            line_len = len(line) + 1  # +1 for newline

            if not line_stripped:
                current_pos += line_len
                continue

            # Check if line matches header patterns
            header_text = self._match_header(line_stripped)
            if header_text:
                # Verify it's a known section keyword
                label = normalize_section_title(header_text)
                if label != CanonicalLabel.UNKNOWN:
                    headers.append((header_text, current_pos, current_pos + len(line_stripped)))

            current_pos += line_len

        return headers

    def _match_header(self, line: str) -> Optional[str]:
        """Try to extract header text from a line"""
        # Skip if too long (headers are usually short)
        if len(line) > 50:
            return None

        # Try regex patterns
        for pattern in self.header_patterns:
            match = pattern.match(line)
            if match:
                return match.group(1).strip()

        # Direct keyword match
        line_lower = line.lower().strip()
        if line_lower in self.header_keywords:
            return line

        return None

    def _create_blocks(self, text: str, headers: List[Tuple[str, int, int]]) -> List[SemanticBlock]:
        """Create semantic blocks from headers"""
        blocks = []

        for i, (header_text, start, end) in enumerate(headers):
            # Determine content end (start of next header or end of text)
            if i + 1 < len(headers):
                content_end = headers[i + 1][1]
            else:
                content_end = len(text)

            # Extract content (text after header until next header)
            content = text[end:content_end].strip()

            label = normalize_section_title(header_text)

            blocks.append(SemanticBlock(
                block_id=f"b{i+1}",
                raw_title=header_text,
                normalized_label=label,
                text=content,
                confidence=0.9 if label != CanonicalLabel.UNKNOWN else 0.5,
                start_pos=start,
                end_pos=content_end
            ))

        return blocks


# Singleton
_separator: Optional[SectionSeparator] = None


def get_section_separator() -> SectionSeparator:
    global _separator
    if _separator is None:
        _separator = SectionSeparator()
    return _separator
