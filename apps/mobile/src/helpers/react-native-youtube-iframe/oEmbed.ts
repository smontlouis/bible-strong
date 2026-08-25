interface YoutubeMeta {
  author_name: string
  author_url: string
  height: number
  html: string
  provider_name: string
  provider_url: string
  thumbnail_height: number
  thumbnail_url: string
  thumbnail_width: number
  title: string
  type: string
  version: string
  width: number
}

/**
 * Fetch metadata of a youtube video using the oEmbed Spec -
 * https://oembed.com/#section7
 *
 * @param videoId - youtube video id
 * @returns A promise that resolves into an object with the video metadata
 */
export const getYoutubeMeta = async (videoId: string): Promise<YoutubeMeta> => {
  const response = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
  )
  return await response.json()
}
