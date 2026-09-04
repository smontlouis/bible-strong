import { deleteUser, getAuth } from 'firebase/auth'

import { firebaseApp } from './firebaseApp.web'

export const getCurrentAuthUser = () => getAuth(firebaseApp).currentUser
export const deleteCurrentAuthUser = async () => {
  const user = getCurrentAuthUser()
  if (user) await deleteUser(user)
}
