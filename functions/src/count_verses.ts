import * as functions from 'firebase-functions'
const admin = require('firebase-admin')

export const count_verses = functions.https.onRequest(async (req, res) => {
  try {
    const { book, chapter } = req.query

    if (!book || !chapter) {
      res.status(400).send({ error: 'id_required' })
    }

    const part = Number(book) > 39 ? 'lsgsnt2' : 'lsgsat2'

    const doc = await admin
      .firestore()
      .collection(part)
      .doc(`${book}-${chapter}`)
      .get()

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
