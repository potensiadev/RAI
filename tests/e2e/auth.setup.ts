import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

/**
 * E2E 테스트용 인증 설정
 *
 * Google OAuth를 사용하므로 실제 브라우저 로그인 대신
 * Supabase 서비스 역할 키를 사용하여 테스트 세션을 생성합니다.
 *
 * 사용 방법:
 * 1. .env.test에 SUPABASE_SERVICE_ROLE_KEY 설정
 * 2. 테스트 실행 전 이 setup이 먼저 실행됨
 * 3. 생성된 세션이 storageState로 저장됨
 */

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testEmail = process.env.TEST_USER_EMAIL;

  // 환경 변수 확인
  if (!supabaseUrl || !serviceRoleKey || !testEmail) {
    console.warn('⚠️  E2E 테스트 환경 변수가 설정되지 않았습니다.');
    console.warn('   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_EMAIL이 필요합니다.');
    console.warn('   테스트를 건너뜁니다.');

    // 빈 스토리지 상태 저장 (테스트는 로그인 없이 진행)
    await page.context().storageState({ path: authFile });
    return;
  }

  // Supabase Admin 클라이언트 생성
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 테스트 사용자 조회 또는 생성
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    let testUser = existingUsers?.users?.find(u => u.email === testEmail);

    if (!testUser) {
      // 테스트 사용자가 없으면 생성
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: testEmail,
        email_confirm: true,
        user_metadata: { full_name: 'Test User' },
      });

      if (createError) {
        console.error('테스트 사용자 생성 실패:', createError.message);
        await page.context().storageState({ path: authFile });
        return;
      }

      testUser = newUser.user;
      console.log('✅ 테스트 사용자 생성됨:', testEmail);
    }

    // 세션 생성 (매직 링크 방식)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: testEmail,
    });

    if (linkError || !linkData) {
      console.error('매직 링크 생성 실패:', linkError?.message);
      await page.context().storageState({ path: authFile });
      return;
    }

    // 매직 링크로 로그인
    const actionLink = linkData.properties?.action_link;
    if (actionLink) {
      await page.goto(actionLink);

      // 로그인 완료 대기
      await page.waitForURL('**/candidates', { timeout: 15000 }).catch(async () => {
        // consent 페이지로 리다이렉트된 경우
        if (page.url().includes('/consent')) {
          console.log('📋 동의 페이지 감지, 자동 동의 처리 중...');
          // 모든 체크박스 체크
          const checkboxes = page.locator('input[type="checkbox"]');
          const count = await checkboxes.count();
          for (let i = 0; i < count; i++) {
            await checkboxes.nth(i).check();
          }
          // 동의 버튼 클릭
          await page.click('button:has-text("동의하고 시작하기")').catch(() => {});
          await page.waitForURL('**/candidates', { timeout: 10000 }).catch(() => {});
        }
      });

      console.log('✅ E2E 테스트 인증 완료');
    }
  } catch (error) {
    console.error('E2E 인증 설정 오류:', error);
  }

  // 인증 상태 저장
  await page.context().storageState({ path: authFile });
});
