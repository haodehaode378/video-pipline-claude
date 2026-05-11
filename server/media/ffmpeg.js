import { execFile } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const FFMPEG = 'ffmpeg'

function run(args, timeout = 300000) {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { timeout }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout || stderr)
    })
  })
}

export async function imagesToVideo(framesDir, outputPath, fps = 30) {
  // ffmpeg -framerate 30 -i frames/frame_%05d.png -c:v libx264 -pix_fmt yuv420p output.mp4
  await run([
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame_%05d.png'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '23',
    outputPath,
  ])
  return outputPath
}

export async function concatAudio(files, outputPath) {
  // Concat WAV files using concat demuxer
  const listFile = outputPath + '.list.txt'
  const content = files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
  fs.writeFileSync(listFile, content, 'utf-8')

  await run([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    outputPath,
  ])
  fs.unlinkSync(listFile)
  return outputPath
}

export async function muxVideoAudio(videoPath, audioPath, outputPath) {
  await run([
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    outputPath,
  ])
  return outputPath
}

export async function getAudioDuration(filePath) {
  const output = await run([
    '-i', filePath,
    '-f', 'null',
    '-',
  ])
  const match = output.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/)
  if (match) {
    return (
      parseInt(match[1]) * 3600 +
      parseInt(match[2]) * 60 +
      parseInt(match[3]) +
      parseInt(match[4]) / 100
    )
  }
  return 0
}

export async function applyVideoFilters(videoPath, filterComplex, outputPath) {
  await run([
    '-y',
    '-i', videoPath,
    '-vf', filterComplex,
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'copy',
    outputPath,
  ])
  return outputPath
}

export async function mixAudioTracks(mainAudioPath, bgmPath, outputPath, bgmVolume = 0.15) {
  await run([
    '-y',
    '-i', mainAudioPath,
    '-i', bgmPath,
    '-filter_complex', `[1:a]volume=${bgmVolume}[bgmv];[0:a][bgmv]amix=inputs=2:duration=first`,
    '-c:a', 'aac',
    outputPath,
  ])
  return outputPath
}

export async function burnSubtitles(videoPath, subtitlePath, outputPath) {
  const escaped = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')
  await run([
    '-y',
    '-i', videoPath,
    '-vf', `subtitles='${escaped}':force_style='FontSize=24,PrimaryColour=&H00FFFFFF,Outline=1,Shadow=1'`,
    '-c:a', 'copy',
    outputPath,
  ])
  return outputPath
}

export async function applySpeedCurve(inputPath, outputPath, speedFactor = 1.2) {
  const setpts = `${(1 / speedFactor).toFixed(3)}*PTS`
  const atempo = speedFactor.toFixed(3)
  await run([
    '-y',
    '-i', inputPath,
    '-filter_complex', `[0:v]setpts=${setpts}[v];[0:a]atempo=${atempo}[a]`,
    '-map', '[v]',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '23',
    outputPath,
  ])
  return outputPath
}

export async function muxWithEffects(videoPath, audioPath, outputPath, options = {}) {
  const { bgmPath, bgmVolume = 0.15, subtitlePath, videoFilters, totalDuration } = options
  const inputs = ['-i', videoPath, '-i', audioPath]
  const filterParts = []
  const outputs = []

  if (bgmPath && fs.existsSync(bgmPath)) {
    inputs.push('-i', bgmPath)
    filterParts.push(`[1:a]volume=${bgmVolume}[bgmv];[1:a][bgmv]amix=inputs=2:duration=first[fa]`)
  }

  if (videoFilters) {
    filterParts.push(`[0:v]${videoFilters}[fv]`)
  }

  const filterComplex = filterParts.join(';')

  const args = ['-y', ...inputs]
  if (filterComplex) {
    args.push('-filter_complex', filterComplex)
    if (videoFilters) outputs.push('-map', '[fv]')
    else outputs.push('-map', '0:v')
    if (bgmPath && fs.existsSync(bgmPath)) outputs.push('-map', '[fa]')
    else outputs.push('-map', '1:a')
  } else {
    outputs.push('-map', '0:v', '-map', '1:a')
  }

  args.push(...outputs, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-shortest', outputPath)

  if (subtitlePath && fs.existsSync(subtitlePath)) {
    return burnSubtitles(outputPath, subtitlePath, outputPath.replace('.mp4', '-subbed.mp4'))
  }

  await run(args)
  return outputPath
}
