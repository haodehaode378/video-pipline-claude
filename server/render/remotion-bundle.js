import { info, warn } from '../utils/logger.js'
import { ensureDir, readJSON } from '../utils/file-helper.js'
import path from 'node:path'
import fs from 'node:fs'

const dynamicImport = (specifier) => import(specifier)
let browserExecutablePromise = null

async function getBrowserExecutable() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) {
    return process.env.REMOTION_BROWSER_EXECUTABLE
  }

  browserExecutablePromise ||= (async () => {
    const { ensureBrowser } = await dynamicImport('@remotion/renderer')
    const browser = await ensureBrowser({
      chromeMode: 'headless-shell',
      logLevel: 'info',
    })
    info(`[Remotion] Browser executable: ${browser.path}`)
    return browser.path
  })()

  return browserExecutablePromise
}

export async function bootstrapRemotionProject(slug, scenes, outputDir) {
  ensureDir(outputDir)
  const styleConfig = readJSON('data/style-config.json') || {}

  const { buildRootJsx } = await import('./remotion-root.js')
  const rootJsx = buildRootJsx(scenes, styleConfig)

  fs.writeFileSync(path.join(outputDir, 'Root.jsx'), rootJsx, 'utf-8')

  const packageJson = {
    name: `remotion-${slug}`,
    private: true,
    scripts: { build: 'remotion render' },
    dependencies: {
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      remotion: '^4.0.0',
      '@remotion/cli': '^4.0.0',
      '@remotion/renderer': '^4.0.0',
    },
  }
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8')

  const remotionConfig = `import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('png')
Config.setOverwriteOutput(true)
`
  fs.writeFileSync(path.join(outputDir, 'remotion.config.mjs'), remotionConfig, 'utf-8')

  const entryJsx = `import { registerRoot } from 'remotion'
import { compositions } from './Root.jsx'

registerRoot(() => compositions)
`
  fs.writeFileSync(path.join(outputDir, 'entry.jsx'), entryJsx, 'utf-8')

  return outputDir
}

export async function renderRemotionVideo(projectDir, outputPath, fps = 30) {
  info(`[Remotion] Rendering video from ${projectDir} to ${outputPath}`)

  try {
    const remotion = await dynamicImport('@remotion/renderer')
    const bundler = await dynamicImport('@remotion/bundler')
    const { renderMedia, selectComposition } = remotion
    const { bundle } = bundler
    const browserExecutable = await getBrowserExecutable()

    const bundleLocation = await bundle({ entryPoint: path.join(projectDir, 'entry.jsx') })

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'MainVideo',
      browserExecutable,
    })

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {},
      browserExecutable,
    })

    info(`[Remotion] Video rendered successfully: ${outputPath}`)
    return outputPath
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      warn('[Remotion] @remotion packages not installed — falling back to Puppeteer')
      throw new Error('Remotion packages not installed. Run: npm install @remotion/renderer @remotion/bundler')
    }
    throw err
  }
}

export async function renderRemotionStill(projectDir, frame, outputPath) {
  info(`[Remotion] Rendering still frame ${frame} from ${projectDir}`)

  try {
    const remotion = await dynamicImport('@remotion/renderer')
    const bundler = await dynamicImport('@remotion/bundler')
    const { renderStill, selectComposition } = remotion
    const { bundle } = bundler
    const browserExecutable = await getBrowserExecutable()

    const bundleLocation = await bundle({ entryPoint: path.join(projectDir, 'entry.jsx') })

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'MainVideo',
      browserExecutable,
    })

    await renderStill({
      composition,
      serveUrl: bundleLocation,
      output: outputPath,
      frame,
      browserExecutable,
    })

    return outputPath
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      warn('[Remotion] @remotion packages not installed — falling back to Puppeteer')
      throw new Error('Remotion packages not installed')
    }
    throw err
  }
}
