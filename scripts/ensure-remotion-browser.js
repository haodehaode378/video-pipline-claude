import 'dotenv/config'
import { ensureBrowser } from '@remotion/renderer'

const browser = await ensureBrowser({
  chromeMode: 'headless-shell',
  logLevel: 'info',
})

console.log(`Remotion browser ready: ${browser.path}`)
