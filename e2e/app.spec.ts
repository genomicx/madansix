import { test, expect } from '@playwright/test'

test.describe('madansix app', () => {
  test('loads correctly', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'madansix' })).toBeVisible()
    await expect(page.getByText('Contig Scaffolding')).toBeVisible()
  })

  test('shows 3 upload zones', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Assembly FASTA')).toBeVisible()
    await expect(page.getByText('Pan-genome FASTA')).toBeVisible()
    await expect(page.getByText('Graph .dot')).toBeVisible()
  })

  test('run button disabled without files', async ({ page }) => {
    await page.goto('/')
    const runBtn = page.getByRole('button', { name: /Run Scaffolding/i })
    await expect(runBtn).toBeDisabled()
  })

  test('tab navigation works', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /How it Works/i }).click()
    // How it works content visible
    await page.getByRole('button', { name: 'About' }).click()
    await expect(page.getByText('No data leaves your machine')).toBeVisible()
  })

  test('theme toggle works', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    // Default is dark
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: /toggle theme/i }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
  })
})
