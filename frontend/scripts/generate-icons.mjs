// Generates all PNG/ICO app icons from public/icon.svg.
// Usage: pnpm icons
// Android/iOS targets are skipped if the native projects do not exist yet.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BG = '#1a1a1a'
const BG_LINE = `<rect width="512" height="512" rx="112" fill="${BG}"/>`

const src = fs.readFileSync(path.join(FE, 'public/icon.svg'), 'utf8')
if (!src.includes(BG_LINE)) {
  throw new Error('icon.svg must contain the background line: ' + BG_LINE)
}

// Artwork without the rounded background
const inner = src.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(BG_LINE, '')
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`
const scaled = (s) =>
  `<g transform="translate(256 256) scale(${s}) translate(-256 -256)">${inner}</g>`
const square = `<rect width="512" height="512" fill="${BG}"/>`

const svgRounded = src
const svgSquare = wrap(square + inner)
const svgMaskable = wrap(square + scaled(0.78)) // inside the 80% safe zone
const svgForeground = wrap(scaled(0.7)) // Android adaptive foreground (transparent)
const svgRound = wrap(`<circle cx="256" cy="256" r="256" fill="${BG}"/>` + scaled(0.84))

const out = (...p) => path.join(FE, ...p)

async function png(svg, size, file, { flatten = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  let img = sharp(Buffer.from(svg), { density: 384 }).resize(size, size)
  if (flatten) img = img.flatten({ background: BG })
  await img.png().toFile(file)
  console.log('wrote', path.relative(FE, file))
}

// Web / PWA
await png(svgRounded, 192, out('public/icon-192.png'))
await png(svgRounded, 512, out('public/icon-512.png'))
await png(svgMaskable, 512, out('public/icon-maskable-512.png'))
await png(svgSquare, 180, out('public/apple-touch-icon.png'), { flatten: true })

const icoPngs = await Promise.all(
  [16, 32, 48].map((s) =>
    sharp(Buffer.from(svgRounded), { density: 384 }).resize(s, s).png().toBuffer(),
  ),
)
fs.writeFileSync(out('public/favicon.ico'), await pngToIco(icoPngs))
console.log('wrote public/favicon.ico')

// Splash screens: app background colour with the icon centred.
// Existing splash files are regenerated at their current dimensions.
const SPLASH_BG = '#0f0f0f'
async function splash(file) {
  const { width, height } = await sharp(file).metadata()
  const size = Math.round(Math.min(width, height) * 0.28)
  const icon = await sharp(Buffer.from(svgRounded), { density: 384 }).resize(size, size).png().toBuffer()
  const buf = await sharp({ create: { width, height, channels: 3, background: SPLASH_BG } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toBuffer()
  fs.writeFileSync(file, buf)
  console.log('wrote', path.relative(FE, file))
}
function findSplashes(dir, pattern) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { recursive: true }).filter((f) => pattern.test(String(f))).map((f) => path.join(dir, String(f)))
}
for (const f of findSplashes(out('android/app/src/main/res'), /^drawable[^/\\]*[/\\]splash\.png$/)) await splash(f)
for (const f of findSplashes(out('ios/App/App/Assets.xcassets/Splash.imageset'), /\.png$/)) await splash(f)

// iOS (1024, opaque, square)
const iosDir = out('ios/App/App/Assets.xcassets/AppIcon.appiconset')
if (fs.existsSync(iosDir)) {
  await png(svgSquare, 1024, path.join(iosDir, 'AppIcon-512@2x.png'), { flatten: true })
} else {
  console.log('skip iOS (no ios project)')
}

// Android (legacy, round, adaptive foreground)
const res = out('android/app/src/main/res')
if (fs.existsSync(res)) {
  const densities = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] }
  for (const [d, [legacy, fg]] of Object.entries(densities)) {
    const dir = path.join(res, `mipmap-${d}`)
    await png(svgRounded, legacy, path.join(dir, 'ic_launcher.png'))
    await png(svgRound, legacy, path.join(dir, 'ic_launcher_round.png'))
    await png(svgForeground, fg, path.join(dir, 'ic_launcher_foreground.png'))
  }
  const bg = path.join(res, 'values/ic_launcher_background.xml')
  if (fs.existsSync(bg)) {
    fs.writeFileSync(
      bg,
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG.toUpperCase()}</color>\n</resources>`,
    )
    console.log('wrote android ic_launcher_background.xml')
  }
} else {
  console.log('skip Android (no android project)')
}
