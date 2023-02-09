import useLiveUpdates from '~helpers/useLiveUpdates'

export interface LiveUpdatesProps {}

const LiveUpdates = ({}: LiveUpdatesProps) => {
  useLiveUpdates()

  return null
}

export default LiveUpdates
