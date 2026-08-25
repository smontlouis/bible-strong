export default {
  baseStyle: {},
  sizes: {
    xs: {
      fontSize: 10,
    },
    s: {
      fontSize: 14,
    },
    m: {
      fontSize: 18,
    },
    l: {
      fontSize: 20,
    },
    xl: {
      fontSize: 24,
    },
    '2xl': {
      fontSize: 32,
    },
    '3xl': {
      fontSize: 42,
    },
  },
  variants: {
    light: {
      fontFamily: 'normal',
      fontWeight: '300',
      lineHeight: 1,
    },
    normal: {
      fontFamily: 'normal',
      lineHeight: 1.5,
    },
    medium: {
      fontFamily: 'normal',
      fontWeight: '500',
      lineHeight: 1,
    },
    bold: {
      fontFamily: 'normal',
      fontWeight: '700',
      lineHeight: 1,
    },
    text: {
      fontFamily: 'text',
      lineHeight: 1.2,
    },
  },
  defaultProps: {
    variant: 'normal',
    size: 'm',
  },
}
