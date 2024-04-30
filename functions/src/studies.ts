import * as functions from 'firebase-functions'
import puppeteer, { Browser } from 'puppeteer-core'

import chromium from '@sparticuz/chromium-min'

const admin = require('firebase-admin')
const cors = require('cors')({ origin: true })

const runtimeOpts = {
  memory: '1GB' as '1GB',
}

const bucket = admin.storage().bucket('bible-strong-app.appspot.com')

export const exportStudyPDF = functions
  .runWith(runtimeOpts)
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      try {
        const { studyId } = req.body

        console.log('---start')
        if (!studyId) {
          res.status(400).send('Missing studyId')
          return
        }

        let browser: Browser

        if (process.env.IS_OFFLINE) {
          browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: '/opt/homebrew/bin/chromium',
          })
        } else {
          browser = await puppeteer.launch({
            args: [
              ...chromium.args,
              '--hide-scrollbars',
              '--disable-web-security',
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(
              'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar'
            ),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
          })
        }

        const page = await browser.newPage()

        const result = await page.goto(
          `https://bible-strong.app/studies/${studyId}`,
          {
            waitUntil: 'networkidle0',
          }
        )

        if (result?.status() === 404) {
          res.status(404).send('Not found')
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

// ! TODO - Generate meta image for study
export const onStudyUpdate = functions.firestore
  .document('studies/{studyId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data()
    const previousValue = change.before.data()

    if (newValue.published !== previousValue.published || newValue.published) {
      if (!newValue.published) {
        try {
          const { id } = newValue
          await bucket.file(`images/studies/${id}.jpg`).delete()
          await bucket.file(`images/studies/${id}-whatsapp.jpg`).delete()
          console.log(`Files deleted for ${id}`)
        } catch (e) {
          console.log(e)
        }
      }
    }
  })

export const deleteStudy = functions.firestore
  .document('studies/{studyId}')
  .onDelete(async (snap, context) => {
    try {
      const { id } = snap.data()
      await bucket.file(`images/studies/${id}.jpg`).delete()
      await bucket.file(`images/studies/${id}-whatsapp.jpg`).delete()
      console.log(`Files deleted for ${id}`)
    } catch (e) {
      console.log(e)
    }
  })
