// 다이어그램 SVG → PNG (sharp/librsvg, density 192 = 2배 해상도)
// 실행: FONTCONFIG_FILE=scripts/fonts.conf node scripts/render_diagrams.mjs
import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = new URL('../diagrams/', import.meta.url).pathname
for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
  const out = join(dir, file.replace(/\.svg$/, '.png'))
  const info = await sharp(join(dir, file), { density: 192 }).png().toFile(out)
  console.log(`${file} → ${info.width}×${info.height}`)
}
