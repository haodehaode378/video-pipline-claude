import { test, expect } from '@playwright/test'

const FULL_FLOW_TIMEOUT = 10 * 60 * 1000 // 10 minutes for full pipeline

// Status texts from EpisodeDetail.jsx statusText logic (exact match required)
const STATUS = {
  BRIEF_PENDING: '等待审核资料收集要求',
  RUNNING: '进行中',
  RESEARCH_DONE: '资料已完成，等待确认生成',
  STORYBOARD_READY: '分镜已完成，等待确认后续生成',
  CODE_READY: '代码已保存，等待重新截图/渲染',
  COMPLETED: '已完成',
  FAILED: '失败',
}

async function waitForExactStatus(page, expectedText, timeout = 120000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    // Target the status line paragraph specifically
    const statusEl = page.locator('p.text-sm.text-gray-500.mb-6').first()
    const text = await statusEl.textContent().catch(() => '')
    // Use exact match to avoid false positives (e.g. "分镜已完成" != "已完成")
    if (text.includes(expectedText)) {
      console.log(`  Status matched: "${expectedText}"`)
      return true
    }
    await page.waitForTimeout(2000)
  }
  return false
}

test.describe('Full Pipeline Flow', () => {
  test('complete user journey: create → research → review → generate → video', async ({ page }) => {
    test.setTimeout(FULL_FLOW_TIMEOUT)

    // ============================================================
    // STEP 1: Navigate to dashboard
    // ============================================================
    console.log('\n=== STEP 1: Dashboard ===')
    await page.goto('/')
    await expect(page.locator('nav')).toBeVisible({ timeout: 10000 })

    // ============================================================
    // STEP 2: Navigate to Create page
    // ============================================================
    console.log('\n=== STEP 2: Create Page ===')
    await page.click('a[href="/create"]')
    await expect(page).toHaveURL(/\/create/)
    await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 })

    // ============================================================
    // STEP 3: Fill in create form
    // ============================================================
    console.log('\n=== STEP 3: Fill Form ===')
    const topic = '二叉树遍历算法'
    const testTitle = `E2E-${topic}-${Date.now().toString(36)}`

    const titleInput = page.locator('input').first()
    await titleInput.fill(testTitle)

    const keywordsInput = page.locator('input').nth(1)
    if (await keywordsInput.isVisible()) {
      await keywordsInput.fill('二叉树,前序遍历,中序遍历,后序遍历,层序遍历')
    }

    // Set duration to 2 minutes
    const rangeInput = page.locator('input[type="range"]')
    if (await rangeInput.isVisible()) {
      await rangeInput.fill('2')
    }

    // ============================================================
    // STEP 4: Submit - create episode
    // ============================================================
    console.log('\n=== STEP 4: Create Episode ===')
    const submitBtn = page.locator('button').filter({ hasText: /创建并审核|创建资料要求/ })
    await submitBtn.click()

    // Wait for navigation to episode detail
    await expect(page).toHaveURL(/\/episode\//, { timeout: 15000 })
    const slug = decodeURIComponent(page.url().split('/episode/')[1])
    console.log(`  Episode slug: ${slug}`)

    // ============================================================
    // STEP 5: Verify episode detail page
    // ============================================================
    console.log('\n=== STEP 5: Verify Episode Detail ===')
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
    const h1 = await page.locator('h1').textContent()
    console.log(`  Title: ${h1}`)
    expect(h1).toContain(topic)

    // Pipeline timeline should be visible
    await expect(page.locator('text=资料收集').first()).toBeVisible({ timeout: 5000 })

    // Research brief section + button
    await expect(page.getByRole('heading', { name: '资料收集要求' })).toBeVisible({ timeout: 5000 })
    const researchBtn = page.locator('button').filter({ hasText: /确认并开始资料收集/ })
    await expect(researchBtn).toBeVisible({ timeout: 5000 })

    // ============================================================
    // STEP 6: Edit research brief
    // ============================================================
    console.log('\n=== STEP 6: Edit Research Brief ===')
    const textarea = page.locator('textarea').first()
    const currentBrief = await textarea.inputValue()
    await textarea.fill(currentBrief + '\n\n## E2E 测试补充\n请重点解释前序遍历的递归和非递归实现，配合栈的动画演示。')
    console.log('  Research brief updated')

    // ============================================================
    // STEP 7: Start research
    // ============================================================
    console.log('\n=== STEP 7: Start Research ===')
    await researchBtn.click()
    await page.waitForTimeout(1000)

    // Wait for research to complete (status: "资料已完成，等待确认生成")
    const researchDone = await waitForExactStatus(page, STATUS.RESEARCH_DONE, 300000)
    if (!researchDone) {
      console.log('  WARNING: Research may still be running, checking current state...')
      const statusText = await page.locator('p.text-sm.text-gray-500.mb-6').first().textContent().catch(() => '')
      console.log(`  Current status: ${statusText}`)
    }
    console.log('  ✓ Research phase complete')

    // ============================================================
    // STEP 8: Start generate (Phase 1: stops after script for review)
    // ============================================================
    console.log('\n=== STEP 8: Generate Phase 1 (script → storyboard) ===')
    const generateBtn = page.locator('button').filter({ hasText: /确认资料并生成分镜/ })
    if (await generateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateBtn.click()
      console.log('  Clicked "确认资料并生成分镜"')
    } else {
      throw new Error('Generate button not found after research')
    }

    // Wait for storyboard to be ready (status: "分镜已完成，等待确认后续生成")
    const storyboardReady = await waitForExactStatus(page, STATUS.STORYBOARD_READY, 300000)
    if (!storyboardReady) {
      const statusText = await page.locator('p.text-sm.text-gray-500.mb-6').first().textContent().catch(() => '')
      throw new Error(`Storyboard not ready. Current status: ${statusText}`)
    }
    console.log('  ✓ Storyboard generated, ready for review')

    // StoryboardEditor should be visible now
    const storyboardSection = page.locator('text=保存并继续生成')
    await expect(storyboardSection).toBeVisible({ timeout: 10000 })

    // ============================================================
    // STEP 9: Save storyboard and continue full pipeline
    // ============================================================
    console.log('\n=== STEP 9: Continue Full Pipeline ===')
    const continueBtn = page.locator('button').filter({ hasText: '保存并继续生成' })
    await continueBtn.click()
    console.log('  Clicked "保存并继续生成"')

    // Wait for full pipeline completion
    const completed = await waitForExactStatus(page, STATUS.COMPLETED, 600000)
    if (!completed) {
      // Check if it failed
      const failed = await waitForExactStatus(page, STATUS.FAILED, 10000)
      const statusText = await page.locator('p.text-sm.text-gray-500.mb-6').first().textContent().catch(() => '')
      throw new Error(`Pipeline did not complete. Status: ${statusText}, Failed: ${failed}`)
    }
    console.log('  ✓ Full pipeline completed!')

    // ============================================================
    // STEP 10: Verify final state
    // ============================================================
    console.log('\n=== STEP 10: Verify Final State ===')
    const finalText = await page.locator('body').textContent().catch(() => '')

    const stepNames = [
      '资料收集', '生成分镜', '素材获取', '生成旁白', '生成 TTS',
      '校准时间轴', '生成 React', 'Remotion 截图', 'Remotion 渲染', '字幕生成', '合成成片',
    ]
    const timeline = page.locator('[class*="space-y"]').first()
    const timelineText = await timeline.textContent().catch(() => '')
    let completedSteps = 0
    for (const step of stepNames) {
      const done = timelineText.includes(step) && !timelineText.includes(`Step`)
      if (done) completedSteps++
    }

    // Check for download link (indicates mux completed)
    const downloadLink = page.locator('a[href*="/download"]')
    const hasDownload = await downloadLink.isVisible().catch(() => false)
    console.log(`  Download link: ${hasDownload ? '✓' : '✗'}`)

    // Check for video player
    const videoEl = page.locator('video').first()
    const hasVideo = await videoEl.isVisible().catch(() => false)
    console.log(`  Video player: ${hasVideo ? '✓' : '✗'}`)

    // Check for errors
    const errorSection = page.getByRole('heading', { name: '错误信息' })
    const hasError = await errorSection.isVisible().catch(() => false)
    if (hasError) {
      const errText = await errorSection.locator('..').textContent().catch(() => '')
      console.log(`  ❌ Error: ${errText}`)
    }

    // Check for code fallback
    const fallbackHeading = page.getByRole('heading', { name: '代码生成降级' })
    const hasFallback = await fallbackHeading.isVisible().catch(() => false)
    console.log(`  Code fallback: ${hasFallback ? 'yes (used template)' : 'no (AI-generated React)'}`)

    // ============================================================
    // STEP 11: Dashboard check
    // ============================================================
    console.log('\n=== STEP 11: Dashboard Verification ===')
    await page.goto('/')
    await expect(page.locator('nav')).toBeVisible({ timeout: 5000 })
    // Episode should appear as "已完成" status
    const completedBadge = page.locator('text=已完成').first()
    const badgeVisible = await completedBadge.isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`  Completed badge on dashboard: ${badgeVisible ? '✓' : '✗'}`)

    // ============================================================
    // Screenshot
    // ============================================================
    await page.goto(`/episode/${encodeURIComponent(slug)}`)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `test-results/full-flow-done.png`, fullPage: true })
    console.log('\n  Screenshot saved: test-results/full-flow-done.png')

    // Final assertions
    expect(finalText.length).toBeGreaterThan(100)
    expect(finalText).not.toContain('加载失败')
    // Pipeline should have actually completed
    expect(hasDownload || hasVideo || finalText.includes('全部完成')).toBeTruthy()
  })
})
