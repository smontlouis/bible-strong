// Importing native Remote Config installs network polyfills that break browser App Check.
// The App Store review flag only applies to the native application.
export const getAppleReviewing = () => false
