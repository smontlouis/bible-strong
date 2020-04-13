import { Plan } from 'src/common/types'

export const bibleProjectPlanMini: Plan = {
  id: 'bible-project-plan-mini',
  title: 'Lire les écritures (mini)',
  image: 'readscripture',
  description: `Découvrez le plan "ReadScripture" que la ministère Crazy Love a développé en collaboration avec The Bible Project. Ce plan se déroule généralement sur 365 jours, mais vous êtes libres de le lire à votre rythme !`,
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
      image: 'tree',
      readingSlices: [
        {
          id: '0',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Genesis 1-11',
              description:
                "Genèse 1-11 : Dieu crée un monde bon, mais l'humanité se rebelle contre Dieu et le ruine. Nous retraçons cette histoire pour voir comment Dieu a un plan pour sauver et bénir le monde entier à travers Abraham",
              url: 'https://www.youtube.com/watch?v=3m24IHVZ0XM',
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
      image: 'face',
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
