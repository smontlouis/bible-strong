/**
 * Single source of truth for the offline onboarding choreography.
 * All durations and delays are expressed in milliseconds.
 *
 * Lower `download.revealStart` to reveal the complete download scene earlier.
 * Change a delay under `download.reveal` to move only that element.
 */
export const OFFLINE_SETUP_MOTION = {
  overview: {
    entranceBezier: [0.22, 1, 0.36, 1] as const,
    exitDuration: 120,
    downloadFadeDuration: 220,
    initialEntrance: {
      folderDuration: 460,
      initialDelay: 120,
      folderStagger: 120,
      headerDuration: 600,
      headerDelay: 40,
    },
    returnEntrance: {
      folderDuration: 300,
      initialDelay: 250,
      folderStagger: 45,
    },
  },
  detail: {
    header: {
      enterDuration: 500,
      exitDuration: 190,
    },
    resourceList: {
      enterDuration: 340,
      enterDelay: 40,
      exitDuration: 210,
    },
  },
  hero: {
    duration: 520,
    handoffStartProgress: 0.72,
    handoffDuration: 140,
  },
  reviewSheet: {
    closedHeight: 150,
    detachedSideInset: 20,
    overdragInset: 8,
    detachedRadius: 36,
    attachedTopRadius: 30,
    overlayMaxOpacity: 0.42,
    dragRatio: 0.7,
    rubberBandCoefficient: 0.55,
    maxOverdrag: 28,
    snapThreshold: 0.5,
    velocityInfluence: 0.0002,
    buttonLabel: {
      enterDelay: 45,
      enterDuration: 120,
      exitDuration: 90,
      slideDistance: 4,
    },
    layout: {
      headerTop: 25,
      summaryHeight: 36,
      subtitleMarginTop: 6,
      subtitleHeight: 18,
      listMarginTop: 18,
      resourceRowHeight: 58,
      resourceRowGap: 9,
      buttonHeight: 56,
      buttonBottom: 12,
      bottomSpacing: 18,
      headerGradientFeather: 28,
      buttonGradientFeather: 28,
    },
  },
  download: {
    revealStart: 250,
    mergeEnd: 720,
    preview: {
      duration: 15_000,
      progressTick: 100,
      factRotationDuration: 6_000,
    },
    success: {
      readyDuration: 1_100,
      reducedMotionReadyDuration: 650,
      messageGap: 320,
      welcomeHoldDuration: 3_000,
      fadeOutDuration: 400,
    },
    merge: {
      folderStagger: 34,
      anticipationDuration: 90,
      anticipationProgress: -0.065,
      convergenceDuration: 520,
    },
    reveal: {
      backgroundDelay: 0,
      progressDelay: 90,
      titleDelay: 190,
      subtitleDelay: 260,
      opacityInDuration: 160,
      opacityOutDuration: 100,
      spring: {
        damping: 17,
        stiffness: 190,
        mass: 0.7,
      },
    },
  },
} as const
