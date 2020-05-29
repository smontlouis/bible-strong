import * as functions from 'firebase-functions'
const admin = require('firebase-admin')

admin.initializeApp()

exports.grec = functions.https.onRequest(async (req, res) => {
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

exports.hebreu = functions.https.onRequest(async (req, res) => {
  try {
    const code = req.query.code

    if (!code) {
      res.status(400).send({ error: 'id_required' })
    }

    const doc = await admin.firestore().collection('hebreu').doc(code).get()

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

exports.dictionnaire = functions.https.onRequest(async (req, res) => {
  try {
    const word = req.query.word

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

exports.count_verses = functions.https.onRequest(async (req, res) => {
  try {
    const { book, chapter } = req.query

    if (!book || !chapter) {
      res.status(400).send({ error: 'id_required' })
    }

    const part = book > 39 ? 'lsgsnt2' : 'lsgsat2'

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
