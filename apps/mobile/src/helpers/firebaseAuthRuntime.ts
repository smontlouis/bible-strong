import { deleteUser, getAuth } from '@react-native-firebase/auth'

export const getCurrentAuthUser = () => getAuth().currentUser
export const deleteCurrentAuthUser = async () => {
  const user = getCurrentAuthUser()
  if (user) await deleteUser(user)
}
