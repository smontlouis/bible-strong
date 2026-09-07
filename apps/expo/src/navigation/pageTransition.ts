export const navigateWithPageTransition = (
  _pathname: string,
  navigate: () => void,
  _direction: 'forward' | 'back' = 'forward'
) => navigate()
export const finishPageTransition = () => {}
