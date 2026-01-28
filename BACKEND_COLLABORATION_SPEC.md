# RAI Backend Collaboration Specification (v1.1)

This document outlines the required backend changes to support the RAI High-Level Implementation Strategy.

## 1. Data Integrity & Content Awareness (DONE)

### 1.1 Skills Truncation Transparency
- **Requirement**: When skills are truncated (currently capped at 100), the UI must know the total count.
- **Implementation**: `toSearchResult` helper now includes `totalSkillsCount`.

### 1.2 Query Intent Feedback
- **Requirement**: Inform user how the search query was parsed.
- **Implementation**: Front-end now displays `parsedKeywords` from API response.

## 2. "Aha Moment": Matching Reasoning (IN PROGRESS)

### 2.1 Worker-side Reasoning Generation
- **Requirement**: The Worker (AnalystAgent) now generates a `match_reason` field during ingestion.
- **Schema**: Updated `SUMMARY_SCHEMA` and `RESUME_JSON_SCHEMA` to include `match_reason`.
- **API Task**: Ensure `match_reason` from DB is mapped to `matchReason` in `CandidateSearchResult`.

## 3. Review Queue (CORE FEATURE - POC CONFIGURED)

### 3.1 Review Filter API
- **Implementation**: `GET /api/candidates/review` is live.
- **Frontend**: Full review queue page implemented at `/review`.

### 3.2 Feedback Loop (NEW)
- **Requirement**: When a user fixes a field in the Review Queue, call a feedback endpoint.
- **Endpoint**: `POST /api/candidates/[id]/feedback`
- **Body**: `{ field: string, value: any, confidenceBefore: number, status: 'fixed' | 'accepted' }`

## 4. Mobile Resilience (DONE)

### 4.1 Mobile Swipe View
- **Implementation**: `MobileCandidateSwipe` component added to Dashboard.
- **UX**: Toss-style swipe (Left: Pass, Right: Like).

## 5. Metrics & Observability (NEW)

### 5.1 Review Fix Tracking
- **Service**: Added `recordReviewMetric` in `lib/observability/metrics.ts`.
- **Goal**: Track how often users correct AI-extracted data to quantify model drift and improvement.

---

## Technical Action Items for Backend Team

### [ ] DB Migration
- Add `match_reason` column to `candidates` table.
- Add `total_skills_count` column (optional, or calculate from array length).

### [ ] Update Feedback API
- Implement `POST /api/candidates/[id]/feedback` to log human corrections.
- Store corrections in a separate `audit_logs` table for future model retraining.

### [ ] Worker Deployment
- Deploy updated `analyst_agent.py` and `resume_schema.py` to production worker instances.
- Re-process candidates with low confidence to generate `match_reason`.
