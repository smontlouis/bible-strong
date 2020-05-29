import * as functions from 'firebase-functions'
const admin = require('firebase-admin')

export const grec = functions.https.onRequest(async (req, res) => {
  try {
    const code = req.query.code

    if (!code) {
      res.status(400).send({ error: 'id_required' })
    }

    const doc = await admin.firestore().collection('grec').doc(code).get()

    const data = doc.data()

    if (data) {
      res.json(data)
    } else {
      res.status(400).send({ error: 'not_found' })
    }
  } catch (error) {
    res.status(500).send(error)
  }
})
