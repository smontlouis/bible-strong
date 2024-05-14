import { Request, Response } from 'express'
import { generateToken, getFilesArrayString } from '../helpers.js'
import { Bucket } from '@google-cloud/storage'

export const initializeAuthFile = async ({
  req,
  res,
  bucket,
  authFileName,
  storageRootFolder,
}: {
  req: Request
  res: Response
  bucket: Bucket
  authFileName: string
  storageRootFolder: string
}) => {
  const bucketPrefix = `${storageRootFolder}`
  const [result] = await bucket.getFiles({
    prefix: bucketPrefix,
  })
  const filesStringArray = getFilesArrayString(result, `${bucketPrefix}`)
  const hasAuthFile = filesStringArray.includes(authFileName)
  if (hasAuthFile) {
    return res.status(403).json({
      error: `${authFileName} file has been generated. Please check storage server.`,
    })
  } else {
    // create a new auth token
    const authToken = generateToken()
    const file = bucket.file(`${bucketPrefix}/${authFileName}`)
    await file.save(authToken, {
      contentType: 'text/plain',
    })
    return res.json({
      message: 'Auth Token generated successfully.',
      authToken: authToken,
    })
  }
}
