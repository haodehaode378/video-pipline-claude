import { info, warn } from '../utils/logger.js'
import { readJSON, getScriptDir } from '../utils/file-helper.js'

export async function runStep2(episode) {
  const slug = episode.slug
  info(`[Assets] Starting asset fetching for "${episode.title}" (${slug})`)

  const pexelsKey = process.env.PEXELS_API_KEY
  const unsplashKey = process.env.UNSPLASH_API_KEY

  if (!pexelsKey && !unsplashKey) {
    warn('[Assets] No Pexels or Unsplash API keys configured — skipping')
    return { success: true, assets: {}, skipped: true }
  }

  try {
    const { fetchAssetsForStoryboard } = await import('../media/asset-library.js')
    const storyboard = episode.storyboardContent
    if (!storyboard || !storyboard.scenes) {
      warn('[Assets] No storyboard found — skipping')
      return { success: true, assets: {}, skipped: true }
    }

    const outputDir = getScriptDir(slug)
    const assets = await fetchAssetsForStoryboard(storyboard.scenes, outputDir, {
      pexelsKey,
      unsplashKey,
    })

    info(`[Assets] Fetched assets for ${Object.keys(assets).length} scenes`)
    return { success: true, assets }
  } catch (err) {
    warn(`[Assets] Asset fetching failed: ${err.message} — continuing without assets`)
    return { success: true, assets: {}, skipped: true, warning: err.message }
  }
}
