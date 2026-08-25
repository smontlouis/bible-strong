declare module 'react-native-boring-avatars' {
  import { ComponentType } from 'react'

  export interface AvatarProps {
    size?: number
    name?: string
    variant?: 'beam' | 'pixel' | 'sunset' | 'ring' | 'bauhaus'
    colors?: string[]
    square?: boolean
  }

  const Avatar: ComponentType<AvatarProps>
  export default Avatar
}
