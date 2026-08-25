import { scaleFontSize } from './scaleFontSize'

export const getBibleTextFontSize = (isParallel: boolean, fontSizeScale: number) =>
  scaleFontSize(isParallel ? 16 : 19, fontSizeScale)
