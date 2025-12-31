# DETAILED UI/UX & IA SPECIFICATION: HR Screener
> [cite_start]**Project Phase:** Phase 1 (Core MVP) [cite: 4]
> **Design Theme:** Weightless Precision (무중력 정밀함)
> **Framework:** Next.js 14 (App Router) + Framer Motion

---

## 1. Global Navigation & Layout (The Frame)
> [cite_start]**PRD Ref:** Credit System [cite: 21][cite_start], Premium Strategy [cite: 15]

### 1.1. Structure (`layout.tsx`)
* **Type:** Server Component (Shell)
* **Z-Index Strategy:**
    * Background: Deep Space Animation (Fixed, z-0)
    * Main Content: Scrollable Area (z-10)
    * Sidebar/Header: Glassmorphism Overlay (Sticky, z-50)
    * Modal/Toast: Global Overlay (z-100)

### 1.2. Glass Sidebar (Left)
* **Visual:** `width: 280px`, `backdrop-blur-xl`, `border-r-white/5`.
* **Interactive Components:**
    1.  **Brand Logo:** 호버 시 네온 빛이 감도는 효과 (Glow).
    2.  **Credit Counter:**
        * **UI:** 슬롯머신처럼 숫자가 굴러가는 Rolling Number.
        * **Logic:** API 응답(Credit 차감) 시 `spring` 애니메이션으로 감소. [cite_start]잔액 부족 시 붉은색 펄스(Pulse) 경고 후 Auto-Reload 모달 유도[cite: 26].
    3.  **Nav Items:**
        * Dashboard, Ingestion, Talent DB, Settings.
        * **Active State:** 배경에 은은한 Spotlight가 따라다님 (`framer-motion` layoutId).

---

## 2. Dashboard: The Command Center (`/dashboard`)
> [cite_start]**PRD Ref:** Natural Language Search [cite: 47][cite_start], Filtering [cite: 44]

### 2.1. Page Structure
* **Header:** "Search & Command" (Sticky).
* **Body:** "Levitating Asset Grid" (Scrollable).

### 2.2. Hero Search Bar (Spotlight Input)
* **Visual:** 화면 중앙 상단 배치. 평소엔 투명하다가 포커스 시 확장됨.
* **Interaction (Focus):**
    * 배경이 어두워짐(Dimming).
    * Input 창이 `scale: 1.05`로 커지며 주변에 "Search Spotlight" 조명 효과 생성.
* **Functionality:**
    * [cite_start]**Keyword Mode:** "Javascript, 5년차" 입력 시 RDB 필터 태그 생성[cite: 43].
    * [cite_start]**Context Mode:** "주도적인 성향의 PM 찾아줘" 입력 시 Vector Search 모드 전환 아이콘(Sparkles) 활성화[cite: 47].

### 2.3. Levitating Asset Grid (Result View)
* **Component:** `<GravityGrid />` (Client Component)
* **Item Card (Talent Card):**
    * **Default:** `y`축으로 불규칙하게 둥둥 떠다님 (Floating Animation).
    * [cite_start]**Content:** 증명사진(OpenCV 추출 [cite: 36]), 요약 스킬, 경력 연차.
    * [cite_start]**Risk Indicator:** 직거래/Skipping 위험 감지된 후보자는 테두리에 붉은색 미세 진동 효과[cite: 55].
    * **Hover:** 마우스 접근 시 카드가 마우스 방향으로 3D 기울기(Tilt) 적용 + 자력(Magnetic)으로 살짝 끌려옴.

---

## 3. Ingestion: The Gravity Well (`/ingestion`)
> [cite_start]**PRD Ref:** Multi-Agent System [cite: 28][cite_start], 50 Page Limit [cite: 24]

### 3.1. Main Visual: "The Black Hole"
단순한 파일 업로더가 아닌, 데이터를 빨아들이는 시각적 은유.

* **Component:** `<GravityDropZone />`
* **Idle State:** 중앙에 느리게 회전하는 링(Ring) 형태의 입자들.
* **Drag State:**
    * 파일을 드래그해서 화면에 진입하면 링이 빠르게 회전하며 중앙으로 수축.
    * 마우스 커서(파일)가 중앙 중력장에 이끌려 빨려 들어가는 물리 저항감(Resistance) 구현.

### 3.2. Processing Visualization (Agent Steps)
[cite_start]파일 업로드 직후, 보이지 않는 백엔드 로직을 시각화하여 "AI가 일하고 있음"을 증명[cite: 16].

1.  [cite_start]**Phase 1: Router (Classification)** [cite: 33]
    * 파일 아이콘이 0.1초 만에 쪼개지며 포맷(PDF/HWP) 아이콘으로 변환.
2.  [cite_start]**Phase 2: Cross-Check (The Dual Beam)** [cite: 35]
    * **Visual:** 화면 좌우에서 Blue Beam(GPT-4o)과 Orange Beam(Claude 3.5)이 동시에 문서를 스캔.
    * **Logic:** 두 빛이 합쳐지는 지점에서 초록색 체크마크(JSON Match) 생성. 불일치 시 보라색(Gemini) 심판관 등장 효과.
3.  [cite_start]**Phase 3: Visual Extraction** [cite: 36]
    * 문서 내 사진 영역이 Crop되어 날아와 DB 슬롯에 꽂히는 애니메이션.

### 3.3. Reject & Error Handling
* [cite_start]**Case:** 암호화 문서 or 50페이지 초과[cite: 24, 55].
* **Interaction:** 블랙홀이 붉게 변하며 파일을 화면 밖으로 뱉어냄(Repulsion Force). "Reject" 텍스트가 깨진 유리 효과와 함께 등장.

---

## 4. Asset Detail: Deep Analysis (`/assets/[id]`)
> [cite_start]**PRD Ref:** Risk Management [cite: 55][cite_start], Deduplication [cite: 48]

### 4.1. Layout: The Split Viewer
* **Left Pane (Original):** PDF 원본 뷰어.
* **Right Pane (Intelligence):** AI 분석 리포트.

### 4.2. Feature: The "Privacy Shield" (Risk Defense)
[cite_start]PRD의 '직거래 방어' 및 '개인정보 마스킹' [cite: 13, 55]을 시각화.

* **Component:** `<BlurShield />`
* **State:**
    * **Default:** 연락처, 이메일 영역이 흐릿한 블러(Blur)와 함께 "Protected" 자물쇠 아이콘으로 가려짐.
    * **Hover:** 마우스를 올리면 블러가 액체처럼 걷히며(Liquid Reveal) 원본 데이터 노출.
    * **Copy Action:** 복사 시도 시 "로그가 기록됩니다"라는 툴팁이 떴다가 사라짐 (심리적 방어).

### 4.3. Feature: History & Deduplication
* **UI:** 타임라인(Timeline) 형태.
* [cite_start]**Interaction:** 과거 중복 이력(Phone Hash 매칭 [cite: 50])이 있을 경우, 과거 버전 카드가 현재 카드 뒤에 겹쳐 있는 "Stacking" UI 제공. 클릭하면 카드가 펼쳐짐.

---

## 5. Pricing & Admin (`/settings`)
> [cite_start]**PRD Ref:** Pricing Plans [cite: 21][cite_start], 1 File = 1 Credit [cite: 22]

### 5.1. Usage Graph
* **Component:** `<InteractiveLineChart />`
* **Physics:**
    * 그래프 선은 고무줄처럼 탄성(Elasticity)을 가짐.
    * 마우스가 지나가면 데이터 포인트들이 자석처럼 커서에 달라붙음 (Magnetic Points).

### 5.2. Plan Upgrade Switch
* **Visual:** Starter / Pro / Enterprise 카드 3장.
* **Interaction:**
    * 플랜 선택 시 선택된 카드가 `z-index` 최상단으로 떠오르며 빛남 (Glow).
    * 나머지 카드는 뒤로 물러나며 어두워짐.
    * 결제 버튼("Subscribe")은 마우스가 다가가면 도망가지 않고 강하게 달라붙음 (High Magnetic Attraction - 구매 유도).

---

## 6. Motion Specification (Dev Guidelines)

### 6.1. Transition Presets
개발 시 아래 상수를 그대로 사용할 것.

```typescript
// 부유하는 느낌 (기본)
export const FLOATING_PHYSICS = {
  y: {
    duration: 2,
    repeat: Infinity,
    repeatType: "reverse",
    ease: "easeInOut"
  }
};

// 쫀득한 반응 (버튼/인풋)
export const SNAP_PHYSICS = {
  type: "spring",
  stiffness: 300,
  damping: 20
};

// 무거운 등장 (모달/페이지 로드)
export const HEAVY_APPEAR = {
  initial: { opacity: 0, y: 40, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring", mass: 1, stiffness: 80, damping: 15 }
};
6.2. Loading States
절대 기본 스피너를 사용하지 않음.

Concept: "Computing..."

Visual: 육각형 그리드(Hexagon Grid)가 순차적으로 점멸하거나, 텍스트(바이너리 코드)가 빠르게 흐르는 "Matrix" 효과 사용.