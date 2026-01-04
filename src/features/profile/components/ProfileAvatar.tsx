import React from 'react'

import UserAvatar from '~common/ui/UserAvatar'
import useLogin from '~helpers/useLogin'

const ProfileAvatar = () => {
  const { user } = useLogin()

  return (
    <UserAvatar
      size={100}
      photoURL={user.photoURL}
      displayName={user.displayName}
      email={user.email}
    />
  )
}

export default ProfileAvatar
