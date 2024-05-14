import express from 'express'
import { ExpoUp } from '../helpers/expo-up'

import * as admin from 'firebase-admin'
import { onRequest } from 'firebase-functions/v2/https'
import multer from 'multer'

const multipartFormDataParser = multer({
  storage: multer.memoryStorage(),
  limits: { fieldSize: 50 * 1024 * 1024 },
  // @ts-expect-error
  startProcessing(req, busboy) {
    req.rawBody ? busboy.end(req.rawBody) : req.pipe(busboy)
  },
})

const app = express()
app.use(express.json())
app.use(
  express.urlencoded({
    extended: true,
  })
)
app.use(multipartFormDataParser.single('file'))

const expoUp = ExpoUp({
  bucket: admin.storage().bucket(),
})

app.get('/expo-up', expoUp.initializeAuthFile)
app.post('/expo-up', expoUp.uploadAndRollback)
app.get('/expo-up/manifest', expoUp.sendUpdate)

export const api = onRequest(app)
