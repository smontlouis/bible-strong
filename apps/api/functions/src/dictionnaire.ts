import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'

export const dictionnaire = functions.https.onRequest(async (req, res) => {
  try {
    const word = req.query.word as string

    if (!word) {
      res.status(400).send({ error: 'id_required' })
    }

    const doc = await admin
      .firestore()
      .collection('dictionnaire')
      .doc(word)
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
