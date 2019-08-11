import React from 'react'
import { useSelector } from 'react-redux'

import Login from './Login'

const withLogin = (Component) => props => {
  const isLogged = useSelector(state => !!state.user.email)

  if (!isLogged) {
    return <Login />
  }

  return <Component {...props} />
}

export default withLogin
