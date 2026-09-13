import { Blobatar } from '@blobatar/react'
import 'blobatar/motion.css'
import type { GeneratedUserAvatarProps } from './GeneratedUserAvatar'

const GeneratedUserAvatar = (props: GeneratedUserAvatarProps) => (
  <Blobatar {...props} animate="always" />
)

export default GeneratedUserAvatar
