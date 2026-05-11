import { test, expect } from '@playwright/test'

function mockEpisode(overrides = {}) {
  const base = {
    slug: 'test-slug',
    title: '测试视频主题',
    duration: 3,
    template: 'default',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: {
      research: 'completed',
      script: 'completed',
      assets: 'completed',
      narration: 'completed',
      tts: 'completed',
      timeline: 'completed',
      code: 'completed',
      snapshot: 'completed',
      render: 'completed',
      whisper: 'completed',
      mux: 'completed',
    },
    ...overrides,
  }
  return base
}

test.describe('PipelineTimeline status display', () => {
  test('shows all steps completed when pipeline is done', async ({ page }) => {
    await page.route('**/api/episodes/test-slug', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockEpisode()) }),
    )
    await page.route('**/api/episodes', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([mockEpisode()]) }),
    )

    await page.goto('/episode/test-slug')
    await expect(page.locator('text=全部完成')).toBeVisible({ timeout: 5000 })
  })

  test('handles missing assets step gracefully', async ({ page }) => {
    // Simulate old pipeline data where assets step was never initialized
    const episode = mockEpisode({ status: 'completed' })
    delete episode.steps.assets

    await page.route('**/api/episodes/test-missing', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(episode) }),
    )

    await page.goto('/episode/test-missing')
    // Should still show as completed, not stuck on "素材获取"
    await expect(page.locator('text=全部完成')).toBeVisible({ timeout: 5000 })
  })

  test('shows running step correctly', async ({ page }) => {
    const episode = mockEpisode({
      status: 'running',
      steps: {
        research: 'completed',
        script: 'completed',
        narration: 'running',
        tts: 'pending',
        timeline: 'pending',
        code: 'pending',
        snapshot: 'pending',
        render: 'pending',
        whisper: 'pending',
        mux: 'pending',
      },
    })

    await page.route('**/api/episodes/test-running', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(episode) }),
    )

    await page.goto('/episode/test-running')
    await expect(page.locator('text=进行中')).toBeVisible({ timeout: 5000 })
    // Should show narration step as active, not stuck on assets
    await expect(page.locator('text=旁白分段提取')).toBeVisible({ timeout: 5000 })
  })

  test('shows failed step correctly', async ({ page }) => {
    const episode = mockEpisode({
      status: 'failed',
      error: 'TTS generation failed',
      steps: {
        research: 'completed',
        script: 'completed',
        assets: 'completed',
        narration: 'completed',
        tts: 'failed',
        timeline: 'pending',
        code: 'pending',
        snapshot: 'pending',
        render: 'pending',
        whisper: 'pending',
        mux: 'pending',
      },
    })

    await page.route('**/api/episodes/test-failed', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(episode) }),
    )

    await page.goto('/episode/test-failed')
    // Status line shows "失败 · X 分钟"
    await expect(page.locator('p.text-sm.text-gray-500:has-text("失败")')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Step 5: TTS 语音合成').first()).toBeVisible({ timeout: 5000 })
  })

  test('shows empty steps object without crashing', async ({ page }) => {
    const episode = mockEpisode({ status: 'running', steps: {} })

    await page.route('**/api/episodes/test-empty', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(episode) }),
    )

    await page.goto('/episode/test-empty')
    // Should render the first step as current (all undefined treated as pending)
    await expect(page.locator('text=进行中')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('EpisodeDetail computeCurrentStep', () => {
  test('step display matches actual pipeline progress', async ({ page }) => {
    const episode = mockEpisode({
      status: 'running',
      steps: {
        research: 'completed',
        script: 'completed',
        assets: 'completed',
        narration: 'completed',
        tts: 'completed',
        timeline: 'running',
        code: 'pending',
        snapshot: 'pending',
        render: 'pending',
        whisper: 'pending',
        mux: 'pending',
      },
    })

    await page.route('**/api/episodes/test-progress', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(episode) }),
    )

    await page.goto('/episode/test-progress')
    // Should show timeline as current step (step 7), not assets
    await expect(page.locator('text=校准时间轴')).toBeVisible({ timeout: 5000 })
  })
})
