import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { resetQuotaEveryDay } from '~redux/modules/user'

const useResetQuotaEveryDay = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    console.log('RESET QUOTA')
    dispatch(resetQuotaEveryDay())
  }, [dispatch])
}

export default useResetQuotaEveryDay
