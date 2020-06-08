import fetch from 'node-fetch'
import * as functions from 'firebase-functions'

export const buildStudies = functions.firestore
  .document('studies/{studyId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data()
    const previousValue = change.before.data()

    if (newValue.published !== previousValue.published || newValue.published) {
      await fetch(
        'https://api.zeit.co/v1/integrations/deploy/QmPr9jhLF1bhDakSDDFuLvbax4VCogXsjqzktsmTHDUMXG/FbjfTqbcO7',
        {
          method: 'POST',
        }
      )
    }
  })
