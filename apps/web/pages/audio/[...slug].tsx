import { useRouter } from 'next/router'
import AudioPage from '../../features/audio/AudioPage'
import { audioContent } from '../../helpers/audioContent'

const Audio = () => {
  const router = useRouter()
  const { slug } = router.query
  const [version, person] = (slug as string[]) || []
  const validVersion = audioContent.find((v) => v.version === version)
  const validPerson = validVersion?.people.find((p) => p.name === person)

  if (slug?.length !== 2 || !validVersion || !validPerson) {
    return null
  }

  return <AudioPage version={validVersion.version} person={validPerson.name} />
}

export default Audio
