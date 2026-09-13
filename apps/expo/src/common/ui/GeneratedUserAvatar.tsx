import { Blobatar, type BlobatarProps } from '@blobatar/react-native'

export type GeneratedUserAvatarProps = Pick<BlobatarProps, 'name' | 'size' | 'traits'>

const GeneratedUserAvatar = (props: GeneratedUserAvatarProps) => <Blobatar {...props} />

export default GeneratedUserAvatar
