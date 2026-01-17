# RAI 환경 설정 가이드

이 문서는 개발/프로덕션 환경을 분리하여 안전하게 RAI 프로젝트를 운영하기 위한 가이드입니다.

## 환경 분리 개요

| 환경 | Supabase 프로젝트 | 용도 |
|------|------------------|------|
| **Development** | `rai-dev` | 로컬 개발, Preview 배포 |
| **Production** | `rai-prod` | 실제 서비스 운영 |

> ⚠️ **주의**: 개발 환경에서 프로덕션 Supabase 키를 사용하면 테스트 데이터가 실제 DB에 저장됩니다!

---

## 1. Supabase 프로젝트 생성

### Step 1: 개발용 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. **New Project** 클릭
3. 프로젝트 정보 입력:
   - **Name**: `rai-dev` (또는 원하는 이름)
   - **Database Password**: 안전한 비밀번호 설정
   - **Region**: `Northeast Asia (Seoul)` 권장
4. **Create new project** 클릭

### Step 2: API 키 확인

1. 프로젝트 생성 후 **Settings** → **API** 이동
2. 다음 정보 복사:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public**: 클라이언트용 공개 키
   - **service_role**: 서버 전용 비밀 키 (⚠️ 절대 노출 금지!)

### Step 3: 스키마 마이그레이션 적용

```bash
# Supabase CLI 설치 (최초 1회)
npm install -g supabase

# 개발 프로젝트에 마이그레이션 적용
supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

또는 Supabase Dashboard의 **SQL Editor**에서 `supabase/migrations/` 폴더의 SQL 파일을 순서대로 실행합니다.

---

## 2. 로컬 개발 환경 설정

### Step 1: 환경 변수 파일 생성

```bash
# 템플릿 복사
cp .env.development.example .env.local
```

### Step 2: 개발용 Supabase 키 입력

`.env.local` 파일을 열고 개발용 Supabase 프로젝트의 키를 입력합니다:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_DEV_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-role-key
```

### Step 3: 개발 서버 실행

```bash
npm run dev
```

---

## 3. Vercel 프로덕션 배포 설정

Vercel에서 환경별로 다른 Supabase 프로젝트를 연결합니다.

### Step 1: Vercel Dashboard 접속

1. [Vercel Dashboard](https://vercel.com/dashboard) → 프로젝트 선택
2. **Settings** → **Environment Variables** 이동

### Step 2: 환경별 변수 설정

| 변수명 | Production | Preview | Development |
|--------|-----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rai-prod.supabase.co` | `https://rai-dev.supabase.co` | `https://rai-dev.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod-anon-key | dev-anon-key | dev-anon-key |
| `SUPABASE_SERVICE_ROLE_KEY` | prod-service-key | dev-service-key | dev-service-key |

> 💡 **팁**: 변수 추가 시 **Environment** 체크박스로 적용 환경을 선택할 수 있습니다.

### Step 3: 재배포

환경 변수 변경 후 기존 배포에는 자동 적용되지 않습니다. 새로운 배포를 트리거하세요:

```bash
git commit --allow-empty -m "chore: trigger redeploy for env vars"
git push origin main
```

---

## 4. 마이그레이션 동기화 워크플로우

개발 환경에서 스키마를 변경하고 프로덕션에 적용하는 절차입니다.

### 개발 환경에서 마이그레이션 생성

```bash
# 새 마이그레이션 파일 생성
# supabase/migrations/YYYYMMDD_description.sql 형식으로 생성
```

### 프로덕션 적용 전 검증

1. PR을 생성하여 Preview 배포 확인
2. Preview 환경에서 기능 테스트
3. 문제 없으면 main 브랜치에 머지

### 프로덕션 마이그레이션 적용

```bash
# PowerShell 스크립트 사용
.\scripts\sync-migrations.ps1 -Target production
```

또는 Supabase Dashboard에서 직접 SQL 실행

---

## 5. 트러블슈팅

### "Invalid API key" 오류

- `.env.local` 파일의 키가 올바른지 확인
- 개발 서버를 재시작해야 환경 변수가 적용됨

### "Row Level Security" 오류

- 마이그레이션이 제대로 적용되었는지 확인
- Service Role Key가 올바른지 확인

### Preview 배포에서 프로덕션 데이터 접근

- Vercel의 Preview 환경 변수가 개발용으로 설정되어 있는지 확인

---

## 환경 변수 체크리스트

로컬 개발을 시작하기 전 확인:

- [ ] `.env.local` 파일 생성됨
- [ ] 개발용 Supabase URL 설정됨
- [ ] 개발용 anon key 설정됨
- [ ] 개발용 service role key 설정됨
- [ ] 개발 DB에 마이그레이션 적용됨

프로덕션 배포 전 확인:

- [ ] Vercel의 Production 환경 변수 설정됨
- [ ] Vercel의 Preview 환경 변수가 개발용으로 설정됨
- [ ] 프로덕션 DB에 마이그레이션 적용됨
