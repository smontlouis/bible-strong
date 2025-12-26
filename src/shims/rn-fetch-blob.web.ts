// Web shim for rn-fetch-blob
// Provides web-compatible alternatives for file download operations

type FetchConfig = {
  fileCache?: boolean
  path?: string
  appendExt?: string
  indicator?: boolean
}

type FetchResponse = {
  path: () => string
  info: () => { status: number }
  blob: () => Promise<Blob>
  base64: () => Promise<string>
  text: () => Promise<string>
}

class RNFetchBlobWeb {
  fs = {
    dirs: {
      // These are not used on web, but we provide them to avoid errors
      DocumentDir: '',
      DownloadDir: '',
      CacheDir: '',
      MainBundleDir: '',
      LibraryDir: '',
    },
  }

  ios = {
    openDocument: (_path: string) => {
      console.warn('[RNFetchBlob] openDocument is not supported on web')
    },
  }

  android = {
    actionViewIntent: (_path: string, _mimeType: string) => {
      console.warn('[RNFetchBlob] actionViewIntent is not supported on web')
    },
  }

  config(_options: FetchConfig) {
    return {
      fetch: async (
        method: string,
        url: string,
        headers?: Record<string, string>,
        body?: string
      ): Promise<FetchResponse> => {
        const response = await fetch(url, {
          method,
          headers,
          body,
        })

        const status = response.status
        const blob = await response.blob()

        // For web, we'll trigger a download when the response is successful
        if (status === 200) {
          // Create a download link and trigger it
          const blobUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = blobUrl

          // Extract filename from Content-Disposition header or use default
          const contentDisposition = response.headers.get('Content-Disposition')
          let filename = 'study.pdf'
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^";\n]+)"?/)
            if (match) {
              filename = match[1]
            }
          }

          link.download = filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          // Clean up the blob URL after a delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
        }

        return {
          path: () => '',
          info: () => ({ status }),
          blob: async () => blob,
          base64: async () => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1]
                resolve(base64)
              }
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
          },
          text: async () => blob.text(),
        }
      },
    }
  }
}

export default new RNFetchBlobWeb()
