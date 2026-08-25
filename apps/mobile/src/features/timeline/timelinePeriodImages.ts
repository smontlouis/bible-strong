const timelinePeriodImages: Record<string, number> = {
  'timeline-period-1': require('../../assets/timeline/periods/period-1.jpg'),
  'timeline-period-2': require('../../assets/timeline/periods/period-2.jpg'),
  'timeline-period-3': require('../../assets/timeline/periods/period-3.jpg'),
  'timeline-period-4': require('../../assets/timeline/periods/period-4.jpg'),
  'timeline-period-5': require('../../assets/timeline/periods/period-5.jpg'),
  'timeline-period-6': require('../../assets/timeline/periods/period-6.jpg'),
  'timeline-period-7': require('../../assets/timeline/periods/period-7.jpg'),
  'timeline-period-8': require('../../assets/timeline/periods/period-8.jpg'),
  'timeline-period-9': require('../../assets/timeline/periods/period-9.jpg'),
  'timeline-period-10': require('../../assets/timeline/periods/period-10.jpg'),
  'timeline-period-11': require('../../assets/timeline/periods/period-11.jpg'),
  'timeline-period-12': require('../../assets/timeline/periods/period-12.jpg'),
  'timeline-period-13': require('../../assets/timeline/periods/period-13.jpg'),
}

export const getTimelinePeriodImageSource = (image: string) =>
  timelinePeriodImages[image] ?? { uri: image }
