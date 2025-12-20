import { Response } from 'express'
import FormData from 'form-data'

export const putNoUpdateAvailableInResponse = (
  res: Response,
  protocolVersion: number
) => {
  const directive = {
    type: 'noUpdateAvailable',
  }

  const form = new FormData()
  form.append('directive', JSON.stringify(directive), {
    contentType: 'application/json',
    header: {
      'content-type': 'application/json; charset=utf-8',
    },
  })

  res.set('expo-protocol-version', `${protocolVersion}`)
  res.set('expo-sfv-version', '0')
  res.set('cache-control', 'private, max-age=0')
  res.set('content-type', `multipart/mixed; boundary=${form.getBoundary()}`)

  return res.status(200).send(form.getBuffer())
}
