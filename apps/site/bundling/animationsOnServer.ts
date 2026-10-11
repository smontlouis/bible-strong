// What the server is given in place of the animation library. A page is rendered without
// animation: every call to the library is made from an effect, which the server never runs.
// The library itself starts a timer as soon as it is loaded, which a Worker refuses outside
// the handling of a request (ADR-0083), so the server does not load it at all.
const gsap = { registerPlugin: () => undefined }

export const ScrollTrigger = {}
export const useGSAP = () => ({ context: undefined, contextSafe: <T>(callback: T): T => callback })
export { gsap }
export default gsap
