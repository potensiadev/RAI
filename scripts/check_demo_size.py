from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900})
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # Demo 섹션으로 스크롤
    page.evaluate("document.getElementById('demo-section')?.scrollIntoView()")
    page.wait_for_timeout(500)

    # 스크린샷
    page.screenshot(path='D:/RAI/public/landing-check.png', full_page=False)

    # Demo 섹션 크기 확인
    demo = page.query_selector('#demo-section')
    if demo:
        box = demo.bounding_box()
        print(f"Demo section: {box['width']}x{box['height']}")

    # GIF 이미지 크기 확인
    gif = page.query_selector('#demo-section img')
    if gif:
        box = gif.bounding_box()
        print(f"GIF display size: {box['width']}x{box['height']}")

    browser.close()
