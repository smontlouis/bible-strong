import * as functions from 'firebase-functions'
import * as puppeteer from 'puppeteer'

const cors = require('cors')({ origin: true })

const runtimeOpts = {
  memory: '1GB' as '1GB',
}

export const exportStudyPDF = functions
  .runWith(runtimeOpts)
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      try {
        console.log('---start')
        const { studyId } = req.body
        const browser = await puppeteer.launch({
          args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
        })
        const page = await browser.newPage()

        const result = await page.goto(
          `https://bible-strong-web-app.now.sh/studies/${studyId}`,
          {
            waitUntil: 'networkidle0',
          }
        )

        if (result?.status() === 404) {
          res.status(404).send()
        }

        const buffer = await page.pdf({ format: 'A4' })
        console.log('---end')

        await page.close()
        res.send(buffer)
      } catch (error) {
        console.log('---failure')
        console.log(error)
        res.status(500).send(error)
      }
    })
  })
