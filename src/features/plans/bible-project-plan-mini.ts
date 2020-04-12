import { Plan } from 'src/common/types'

export const bibleProjectPlanMini: Plan = {
  id: 'bible-project-plan-mini',
  title: 'Lire les écritures (mini)',
  description: `Découvrez le plan "ReadScripture" que la ministère Crazy Love a développé en collaboration avec The Bible Project. Ce plan se déroule généralement sur 365 jours, mais vous êtes libres de le lire à votre rythme !`,
  image:
    'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Freadscripture.png?alt=media&token=7d72f066-1a5b-43a0-bb6b-d1fcb0299f62',
  author: {
    id: 'ZvfOG5Yt9rN2lKc4sjb3n5W5pit1',
    displayName: 'Stéphane MLC',
    photoUrl:
      'https://lh3.googleusercontent.com/a-/AOh14GgMHihnLd5Bje30QhtP8s_eaUALPMDalSyOhTAWiw=s96-c',
  },
  sections: [
    {
      id: '1',
      title: 'Création et chute',
      subTitle: 'Genèse 1-11',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Ftree.png?alt=media&token=39574418-0ef6-4208-981c-2e60b76d9d65',
      readingSlices: [
        {
          id: '0',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Genesis 1-11',
              description:
                'Genesis 1-11:  God creates a good world, but humanity rebels against God and ruins it. We trace that story to see how God has a plan to rescue and bless the whole world through Abraham.',
              url: 'https://www.youtube.com/watch?v=GQI72THyO5I',
            },
            { id: '1', src: '1_genesis_1', type: 'Image' },
            { id: '2', chapters: '1|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|1',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '347',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Image of God',
              description:
                'Explore the theme of the image of God which surfaced in your previous session reading.',
              url: 'https://www.youtube.com/watch?v=YbipxLDtY8c',
            },
            { id: '1', src: '1_genesis_1', type: 'Image' },
            { id: '2', chapters: '1|4-7', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|2',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '348',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Torah: Genesis 1-11',
              description:
                'Recap this chapter on Creation and Fall with our animated Torah series video on Genesis 1-11',
              url: 'https://www.youtube.com/watch?v=KOUV7mWDI34',
            },
            { id: '1', src: '1_genesis_1', type: 'Image' },
            { id: '2', chapters: '1|8-11', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|3',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '2',
      title: "L'alliance avec Abraham",
      subTitle: 'Genèse 12-50',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fface.png?alt=media&token=a9298829-a6a7-4dfe-8b7b-3b748d8b98f2',
      readingSlices: [
        {
          id: '8',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|41-42', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|13',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '15',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|43-45', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|14',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '16',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|46-47', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|15',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
  ],
}
