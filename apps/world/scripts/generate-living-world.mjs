import { fal } from '@fal-ai/client'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const work = resolve(root, 'art-workbench/experiments/living-world-v1')
process.loadEnvFile(resolve(root, '../../.env'))
if (!process.env.FAL_KEY) throw new Error('FAL_KEY is missing')
const jobs = JSON.parse(await readFile(resolve(work, 'config.json'), 'utf8'))
const mode = process.argv[2] ?? 'video'
const action = process.argv[3] ?? 'status'
const endpoint = mode === 'video' ? 'minimax/h3/image-to-video' : 'fal-ai/sam-3/video'
const selected = process.argv[4]
for (const job of jobs.filter(job => !selected || job.id === selected)) {
  const dir = resolve(work, job.id)
  await mkdir(dir, { recursive: true })
  const requestPath = resolve(dir, `${mode}-request.json`)
  const output = resolve(dir, `${mode}.mp4`)
  try {
    if (action === 'submit') {
      if (existsSync(requestPath)) {
        console.log(job.id, mode, 'already submitted')
        continue
      }
      let input
      if (mode === 'video') {
        const still = await readFile(job.still)
        const image = `data:image/png;base64,${still.toString('base64')}`
        input = {
          prompt: job.prompt,
          duration: 10,
          resolution: '768P',
          seed: 20260921 + job.number,
          prompt_expansion_mode: 'disabled',
          image_url: image,
          end_image_url: image,
        }
      } else {
        const video = await readFile(resolve(dir, 'input-12fps.mp4'))
        const url = await fal.storage.upload(
          new File([video], `${job.id}.mp4`, { type: 'video/mp4' })
        )
        input = {
          video_url: url,
          prompt: job.maskPrompt,
          apply_mask: false,
          video_output_type: 'X264 (.mp4)',
        }
      }
      const request = await fal.queue.submit(endpoint, { input })
      await writeFile(requestPath, JSON.stringify({ endpoint, ...request }, null, 2))
      console.log(job.id, mode, 'submitted', request.request_id)
    } else {
      if (!existsSync(requestPath)) {
        console.log(job.id, mode, 'not submitted')
        continue
      }
      if (existsSync(output)) {
        console.log(job.id, mode, 'saved')
        continue
      }
      const request = JSON.parse(await readFile(requestPath, 'utf8'))
      const status = await fal.queue.status(endpoint, { requestId: request.request_id })
      console.log(job.id, mode, status.status)
      if (action !== 'collect' || status.status !== 'COMPLETED') continue
      const result = await fal.queue.result(endpoint, { requestId: request.request_id })
      await writeFile(resolve(dir, `${mode}-result.json`), JSON.stringify(result, null, 2))
      const response = await fetch(result.data.video.url)
      if (!response.ok) throw new Error(`Download HTTP ${response.status}`)
      await writeFile(output, Buffer.from(await response.arrayBuffer()))
      if (mode === 'video') {
        execFileSync('ffmpeg', [
          '-v',
          'error',
          '-y',
          '-i',
          output,
          '-an',
          '-vf',
          'fps=12',
          '-c:v',
          'libx264',
          '-crf',
          '16',
          resolve(dir, 'input-12fps.mp4'),
        ])
      }
      console.log(job.id, mode, 'downloaded')
    }
  } catch (error) {
    console.error(job.id, mode, error.message)
    process.exitCode = 1
  }
}
