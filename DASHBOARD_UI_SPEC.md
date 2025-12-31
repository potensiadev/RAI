# UI SPECIFICATION: Intelligent Dashboard & Levitating Grid
> **Target Page:** `/dashboard` (Main Workspace)
> **Core Feature:** Hybrid Search & Asset Visualization
> **Design Theme:** "Data floating in Zero Gravity"

---

## 1. Page Architecture (Server vs Client)
Next.js 14의 장점을 극대화하기 위해 데이터 영역과 인터랙션 영역을 엄격히 분리합니다.

* **`page.tsx` (Server Component):**
    * Role: URL 쿼리 파라미터(`?q=`, `?filter=`)를 기반으로 Supabase(RDB/Vector) 데이터 페칭.
    * Output: `initialData`를 Client Component에 전달.
* **`DashboardClient.tsx` (Client Component):**
    * Role: 상태 관리(Search Input, Filter) 및 레이아웃 애니메이션 조정.
    * Children: `<SpotlightSearch />`, `<GravityGrid />`.

---

## 2. Component: Spotlight Search Bar
> [cite_start]**PRD Ref:** Natural Language Search (Vector) vs Exact Match (RDB) [cite: 40, 41, 42, 45]

화면 최상단 중앙에 위치하며, 단순한 입력창이 아니라 'AI와의 대화 채널' 느낌을 줍니다.

### 2.1. Visual & Interaction
* **Idle State:**
    * Glassmorphism 패널 (`bg-white/5 backdrop-blur-md`).
    * Placeholder: "조건(SQL)이나 문맥(Vector)으로 인재를 찾아보세요."
* **Focus State (The Spotlight):**
    * **Dimming:** 화면 전체 배경이 60% 어두워짐 (`bg-black/60`).
    * **Expansion:** 검색바 width가 600px -> 800px로 늘어나며 (`type: spring`), 주변에 보라색(Violet) Glow 효과 발생.
    * **Quick Filters:** 검색바 하단에 '최근 검색', '즐겨찾는 필터' 칩(Chip)들이 `stagger` 애니메이션으로 떠오름.

### 2.2. Mode Switching UI
사용자의 입력 패턴을 감지하여 검색 모드 아이콘을 실시간으로 변경.
* **Keyword Mode (RDB):** "Java, 5년, 서울" 입력 시 → 🧩 (퍼즐 아이콘/정확도 강조).
* **Semantic Mode (Vector):** "이커머스 경험 풍부한 PM" 입력 시 → ✨ (스파클 아이콘/AI 문맥 강조).

---

## 3. Component: Levitating Asset Grid
> [cite_start]**PRD Ref:** Assetization (Thumbnail/Snapshot) [cite: 11][cite_start], Risk Management 

정적인 테이블 대신, 후보자 정보가 무중력 공간에 떠 있는 카드 그리드 시스템입니다.

### 3.1. Grid Layout (`<GravityGrid />`)
* **Structure:** Masonry Layout (벽돌 쌓기) 혹은 Responsive Grid.
* **Entry Animation:**
    * 페이지 로드 시 카드가 아래에서 위로 떠오르며 등장.
    * `staggerChildren: 0.05`를 적용하여 물결치듯 순차적으로 등장.

### 3.2. The Card (`<LevitatingCard />`)
각 이력서는 하나의 물리적 객체(Object)입니다.

* **Floating Effect (Physics):**
    * 마우스와 상호작용이 없을 때도 `y: [-4, 4]` 사이를 3초 주기로 천천히 오르내림 (`repeat: Infinity`, `ease: "easeInOut"`).
    * 각 카드마다 애니메이션 시작 시간을 랜덤하게 지연(Random Delay)시켜 기계적인 느낌 배제.

* **Card Anatomy (Content):**
    1.  **Header:**
        * [cite_start]**Thumbnail:** OpenCV로 크롭된 얼굴 사진 [cite: 36] 또는 포트폴리오 썸네일. (없을 경우 이니셜 아바타)
        * [cite_start]**Badge:** `Cross-Check Verified` (초록색 쉴드) - AI 검증 완료 표시[cite: 19].
    2.  **Body:**
        * **Name/Title:** "김** (Frontend Dev)" - 이름 마스킹 처리.
        * **Key Specs:** 경력(N년), 최근 직장, 핵심 스킬 태그.
        * **Summary:** LLM이 추출한 1줄 요약 ("대규모 트래픽 처리 경험 보유").
    3.  [cite_start]**Risk Indicator (Critical):**
        * 만약 `risk_level: high` (직거래/개인정보 노출 시도) 데이터인 경우.
        * **Visual:** 카드 테두리에 붉은색 `box-shadow`가 희미하게 맥박(Pulse)침.
        * **Tooltip:** "개인정보 노출 패턴 감지됨 (Skipping Risk)."

### 3.3. Mouse Interaction (Hover)
마우스를 올렸을 때의 "손맛"을 구현합니다.

* **Tilt Effect:** 마우스 위치에 따라 카드가 3D로 기울어짐 (`rotateX`, `rotateY`).
* **Lift:** `z-index`가 높아지며 `scale: 1.02`로 살짝 확대.
* **Action Reveal:**
    * 숨겨져 있던 액션 버튼들(상세보기, PDF 다운로드, 채팅)이 아래에서 슬라이드 업.
    * 버튼 위로 마우스를 가져가면 버튼이 자석처럼 커서에 달라붙음 (`MagneticButton`).

---

## 4. Implementation Snippets (For AI)

### A. Framer Motion Config (Floating)
```javascript
// 카드의 둥둥 떠다니는 움직임 (Randomness 필수)
const floatingVariant = (delay) => ({
  animate: {
    y: [5, -5],
    transition: {
      duration: 3 + Math.random(), // 3~4초 사이 랜덤
      repeat: Infinity,
      repeatType: "reverse",
      ease: "easeInOut",
      delay: delay // 개별 지연 시간
    }
  }
});
B. Risk Border Pulse (Tailwind + Motion)

// 위험 요소가 있는 카드의 경고 효과
<motion.div
  className="border border-rose-500/30 bg-rose-500/5"
  animate={{ boxShadow: ["0 0 0px #f43f5e", "0 0 15px #f43f5e", "0 0 0px #f43f5e"] }}
  transition={{ duration: 2, repeat: Infinity }}
>
  {/* Card Content */}
</motion.div>