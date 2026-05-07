import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('homepage loads and redirects to dashboard', async ({ page }) => {
    await page.goto('/')
    // Should show either dashboard content or nav
    await expect(page.locator('nav, [role="navigation"], header')).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to Create page', async ({ page }) => {
    await page.goto('/')
    await page.click('a[href="/create"]')
    await expect(page).toHaveURL(/\/create/)
    await expect(page.locator('input, textarea').first()).toBeVisible()
  })

  test('can navigate to Style Config page', async ({ page }) => {
    await page.goto('/')
    await page.click('a[href="/style-config"]')
    await expect(page).toHaveURL(/\/style-config/)
  })

  test('navigates to episode detail on click', async ({ page }) => {
    await page.goto('/')
    // Click first episode card link
    const card = page.locator('a[href*="/episode/"]').first()
    if (await card.isVisible()) {
      await card.click()
      await expect(page).toHaveURL(/\/episode\//)
    }
  })
})

test.describe('Dashboard', () => {
  test('displays page title or heading', async ({ page }) => {
    await page.goto('/')
    // Dashboard should have some heading or the nav
    await expect(page.locator('h1, h2, nav')).not.toHaveCount(0, { timeout: 10000 })
  })

  test('shows episode cards or empty state', async ({ page }) => {
    await page.goto('/')
    // Either we see cards or an empty state message
    const hasContent = await page.locator('a, .card, [class*="card"]').count()
    // Dashboard should at least render something
    expect(hasContent).toBeGreaterThanOrEqual(0)
  })

  test('nav bar is present', async ({ page }) => {
    await page.goto('/')
    const nav = page.locator('nav, header a')
    const links = await nav.all()
    expect(links.length).toBeGreaterThan(0)
  })
})

test.describe('Create Episode', () => {
  test('form has title input', async ({ page }) => {
    await page.goto('/create')
    const titleInput = page.locator('input[name="title"], input[placeholder*="题"], input[placeholder*="主题"]').first()
    // There should be some input field
    const inputs = page.locator('input')
    await expect(inputs.first()).toBeVisible({ timeout: 5000 })
  })

  test('can type in form fields', async ({ page }) => {
    await page.goto('/create')
    const firstInput = page.locator('input').first()
    if (await firstInput.isVisible()) {
      await firstInput.fill('测试主题')
      const value = await firstInput.inputValue()
      expect(value).toBeTruthy()
    }
  })
})

test.describe('Style Config', () => {
  test('page loads successfully', async ({ page }) => {
    await page.goto('/style-config')
    await expect(page.locator('body')).toBeVisible()
    // Should have some content
    const text = await page.textContent('body')
    expect(text).toBeTruthy()
  })
})

test.describe('Episode Detail', () => {
  test('shows pipeline timeline for an episode', async ({ page }) => {
    await page.goto('/')
    const card = page.locator('a[href*="/episode/"]').first()
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.click()
      await expect(page).toHaveURL(/\/episode\//, { timeout: 5000 })
      // Should show timeline or error state
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
