import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { resetQuotaEveryDay } from '~redux/modules/user'

const useResetQuotaEveryDay = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(resetQuotaEveryDay())
  }, [dispatch])
}

export default useResetQuotaEveryDay
