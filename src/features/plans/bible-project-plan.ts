import { Plan } from 'src/common/types'

export const bibleProjectPlan: Plan = {
  id: 'bible-project-plan',
  title: 'Lire les écritures',
  description: `Découvrez le plan "ReadScripture" que la ministère Crazy Love a développé en collaboration avec The Bible Project. Ce plan se déroule généralement sur 365 jours, mais vous êtes libres de le lire à votre rythme !`,
  image:
    'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Freadscripture.png?alt=media&token=7d72f066-1a5b-43a0-bb6b-d1fcb0299f62',
  author: { id: '', displayName: '', photoUrl: '' },
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
        {
          id: '20',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Genesis 12-50',
              description:
                'Genesis 12-50: God makes a promise to bless rebellious humanity through the family of Abraham, and the story follows this promise through four generations.',
              url: 'https://www.youtube.com/watch?v=F4isSyennFo',
            },
            { id: '1', src: '1_genesis_2', type: 'Image' },
            { id: '2', chapters: '1|12-15', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|4',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '81',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Torah: Genesis 12-50',
              description:
                "You're almost through the book of Genesis! Watch our animated Torah series video on Genesis 12-50 to remember what you've covered and where you're going.",
              url: 'https://www.youtube.com/watch?v=VpbWbyx1008',
            },
            { id: '1', src: '1_genesis_2', type: 'Image' },
            { id: '2', chapters: '1|35-37', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|11',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '82',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|19-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|6',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '83',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|22-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|7',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '84',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|29-31', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|9',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '85',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|25-28', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|8',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '86',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|32-34', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|10',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '87',
          slices: [
            { id: '0', src: '1_genesis_2', type: 'Image' },
            { id: '1', chapters: '1|38-40', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|12',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '349',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: The Covenants',
              description:
                "See how God's covenant with Noah fits into the overall story of the Bible",
              url: 'https://www.youtube.com/watch?v=8ferLIsvlmI',
            },
            { id: '1', src: '1_genesis_2', type: 'Image' },
            { id: '2', chapters: '1|16-18', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|5',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '351',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: The Messiah',
              description:
                "The Messiah: Learn more about Jacob's promise to Judah about the future King",
              url: 'https://www.youtube.com/watch?v=3dEh25pduQ8',
            },
            { id: '1', src: '1_genesis_2', type: 'Image' },
            { id: '2', chapters: '1|48-50', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|16',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '3',
      title: "L'exode d'Egypte",
      subTitle: 'Exode 1-18',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fsea.png?alt=media&token=08658e47-938b-42ae-9332-e16aaf0b41b9',
      readingSlices: [
        {
          id: '17',
          slices: [
            { id: '0', src: '02', type: 'Image' },
            { id: '1', chapters: '2|10-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|20',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '18',
          slices: [
            { id: '0', src: '02', type: 'Image' },
            { id: '1', chapters: '2|7-9', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|19',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '19',
          slices: [
            { id: '0', src: '02', type: 'Image' },
            { id: '1', chapters: '2|13-15', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|21',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '21',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Exodus 1-18',
              description:
                'Exodus 1-18: God rescues the Israelites from slavery in Egypt and confronts the evil and injustice of Pharaoh the king.',
              url: 'https://www.youtube.com/watch?v=jH_aojNJM3E',
            },
            { id: '1', src: '02', type: 'Image' },
            { id: '2', chapters: '2|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|17',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '350',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Holiness',
              description:
                "After Moses and the burning bush, it's a good time to explore the theme of God's holiness.",
              url: 'https://www.youtube.com/watch?v=l9vn5UvsHvM',
            },
            { id: '1', src: '02', type: 'Image' },
            { id: '2', chapters: '2|4-6', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|18',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '352',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Torah: Exodus 1-18',
              description:
                'Recap this chapter on the Exodus from Egypt with an animated video of Exodus 1-18.',
              url: 'https://www.youtube.com/watch?v=0uf-PgW7rqE',
            },
            { id: '1', src: '02', type: 'Image' },
            { id: '2', chapters: '2|16-18', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|22',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '4',
      title: "L'Alliance au Mont Sinaï",
      subTitle: 'Exode 19-Leviticus',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fcovenant.png?alt=media&token=51032b01-f36d-4ddd-ace4-61ba8c1d35ea',
      readingSlices: [
        {
          id: '3',
          slices: [
            { id: '0', src: '02', type: 'Image' },
            { id: '1', chapters: '2|22-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|24',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '22',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Exodus 19-40',
              description:
                'Exodus 19-40: God invites the redeemed Israelites into a covenant relationship with Him, and descends to dwell among them in the Tabernacle. The Israelites rebel, however, creating a rift in the relationship.',
              url: 'https://www.youtube.com/watch?v=oNpTha80yyE',
            },
            { id: '1', src: '02', type: 'Image' },
            { id: '2', chapters: '2|19-21', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|23',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '23',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Leviticus',
              description:
                "God responds to the Israelites' sin and rebellion by providing them an elaborate series of rituals and institutions to deal with their sin. God's holiness motivates Him to deal with their rebellion so He can live among them in peace.",
              url: 'https://www.youtube.com/watch?v=IJ-FekWUZzE',
            },
            { id: '1', src: '03', type: 'Image' },
            { id: '2', chapters: '3|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|30',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '88',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Heaven and Earth',
              description:
                "More than a boring list of building specifications, these chapters on the Tabernacle point us to the important biblical theme of God's restoration of heaven and earth. ",
              url: 'https://www.youtube.com/watch?v=Zy2AQlK6C5k',
            },
            { id: '1', src: '02', type: 'Image' },
            { id: '2', chapters: '2|25-27', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|25',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '89',
          slices: [
            { id: '0', src: '02', type: 'Image' },
            { id: '1', chapters: '2|28-29', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|26',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '90',
          slices: [
            { id: '0', src: '02', type: 'Image' },
            { id: '1', chapters: '2|30-31', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|27',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '91',
          slices: [
            { id: '0', src: '02', type: 'Image' },
            { id: '1', chapters: '2|32-34', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|28',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '92',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Atonement',
              description:
                "As you progress through Leviticus you'll learn a lot about animal sacrfices and priestly rituals. This is a good time to remember the big picture Biblical theme represented here: Atonement",
              url: 'https://www.youtube.com/watch?v=G_OlRWGLdnw',
            },
            { id: '1', src: '03', type: 'Image' },
            { id: '2', chapters: '3|5-7', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|31',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '93',
          slices: [
            { id: '0', src: '03', type: 'Image' },
            { id: '1', chapters: '3|8-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|32',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '94',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Related Video: Holiness',
              description:
                "You're halfway through Leviticus! As we are learning about the sacrifical laws, it's a good time to remember the big picture theme represented here: God's holiness",
              url: 'https://www.youtube.com/watch?v=l9vn5UvsHvM',
            },
            { id: '1', src: '03', type: 'Image' },
            { id: '2', chapters: '3|11-13', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|33',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '95',
          slices: [
            { id: '0', src: '03', type: 'Image' },
            { id: '1', chapters: '3|24-25', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|38',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '96',
          slices: [
            { id: '0', src: '03', type: 'Image' },
            { id: '1', chapters: '3|16-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|35',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '97',
          slices: [
            { id: '0', src: '03', type: 'Image' },
            { id: '1', chapters: '3|21-23', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|37',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '98',
          slices: [
            { id: '0', src: '03', type: 'Image' },
            { id: '1', chapters: '3|14-15', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|34',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '99',
          slices: [
            { id: '0', src: '03', type: 'Image' },
            { id: '1', chapters: '3|19-20', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|36',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '353',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Torah: Exodus 19-40',
              description:
                'Watch an animated recap of Exodus 19-40 as you finish up the book of Exodus today.',
              url: 'https://www.youtube.com/watch?v=b0GhR-2kPKI',
            },
            { id: '1', src: '02', type: 'Image' },
            { id: '2', chapters: '2|35-40', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|29',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '354',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Torah: Leviticus',
              description:
                "Congratulations! You're going to finish Leviticus today. Here's an animated recap of the book.",
              url: 'https://www.youtube.com/watch?v=WmvyrLXoQio',
            },
            { id: '1', src: '03', type: 'Image' },
            { id: '2', chapters: '3|26-27', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|39',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '5',
      title: 'Le désert',
      subTitle: 'Nombres, Deutéronome',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Faltar.png?alt=media&token=5df0ea92-367c-4b35-a80a-3cebde32934e',
      readingSlices: [
        {
          id: '24',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Numbers',
              description:
                'Numbers: Israel leaves Mount Sinai and travels through the wilderness on the way to the land promised to Abraham. The trip goes horribly as Israel rebels, and reveals how God shows both justice and mercy on his people.',
              url: 'https://www.youtube.com/watch?v=tp5MIrMZFqo',
            },
            { id: '1', src: '04', type: 'Image' },
            { id: '2', chapters: '4|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|40',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '25',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Deuteronomy',
              description:
                'Moses gives the Israelites his final words of wisdom and warning before they enter the promised land. He challenges them to be faithful to the covenant and to love God.',
              url: 'https://www.youtube.com/watch?v=q5QEH9bH8AU',
            },
            { id: '1', src: '05', type: 'Image' },
            { id: '2', chapters: '5|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|53',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '26',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|4-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|54',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '100',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Holiness',
              description:
                "You're about to read detailed instructions on cleanliness in the land which might be confusing. This is another good time to remember the greater truth God is trying to teach the people at this time and re-watch the video on holiness.",
              url: 'https://www.youtube.com/watch?v=l9vn5UvsHvM',
            },
            { id: '1', src: '04', type: 'Image' },
            { id: '2', chapters: '4|5-7', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|41',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '101',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|8-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|42',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '102',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|11-13', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|43',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '103',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|14-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|44',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '104',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|17-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|45',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '105',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|19-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|46',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '106',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|28-30', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|49',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '107',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|25-27', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|48',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '108',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|22-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|47',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '120',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|31-32', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|50',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '121',
          slices: [
            { id: '0', src: '04', type: 'Image' },
            { id: '1', chapters: '4|33-34', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|51',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '122',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|7-9', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|55',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '123',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: The Law',
              description:
                'Old Testament Law is often times confusing to people. Watch this animated theme video to learn more about the Law in context.',
              url: 'https://www.youtube.com/watch?v=3BGO9Mmd_cU',
            },
            { id: '1', src: '05', type: 'Image' },
            { id: '2', chapters: '5|10-12', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|56',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '124',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|13-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|57',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '125',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|15-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|58',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '126',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|17-20', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|59',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '127',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|21-23', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|60',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '128',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|24-27', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|61',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '129',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|28-29', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|62',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '130',
          slices: [
            { id: '0', src: '05', type: 'Image' },
            { id: '1', chapters: '5|30-31', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|63',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '131',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Torah: Deuteronomy',
              description:
                "Here's an animated recap of the book of Deuteronomy! Congrats on finishing another book today.",
              url: 'https://www.youtube.com/watch?v=NMhmDPWeftw',
            },
            { id: '1', src: '05', type: 'Image' },
            { id: '2', chapters: '5|32-34', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|64',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '355',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Torah: Numbers',
              description:
                "Today is your last day in the book of Numbers! Watch an animated recap of what you've covered.",
              url: 'https://www.youtube.com/watch?v=zebxH-5o-SQ',
            },
            { id: '1', src: '04', type: 'Image' },
            { id: '2', chapters: '4|35-36', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|52',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '6',
      title: 'La terre promise',
      subTitle: 'Josué, Juges',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fgrape.png?alt=media&token=0ff57f8d-9a81-471d-be36-ecfd328cd558',
      readingSlices: [
        {
          id: '27',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Joshua',
              description:
                "After Moses' death, Joshua leads the Israelites into the land God promised Abraham and helps them defeat the Canaanites. The Israelites settle in the land and are challenged to be faithful to God.",
              url: 'https://www.youtube.com/watch?v=JqOqJlFF_eU',
            },
            { id: '1', src: '06', type: 'Image' },
            { id: '2', chapters: '6|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|65',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '28',
          slices: [
            { id: '0', src: '06', type: 'Image' },
            { id: '1', chapters: '6|22-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|69',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '29',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Judges',
              description:
                "After Joshua's death, the Israelites turn away from God and break the covenant. This begins a cycle of rebellion, repentance, and restoration as God patiently stays committed to an unfaithful people.",
              url: 'https://www.youtube.com/watch?v=kOYy8iCfIJ4',
            },
            { id: '1', src: '07', type: 'Image' },
            { id: '2', chapters: '7|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|70',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '132',
          slices: [
            { id: '0', src: '06', type: 'Image' },
            { id: '1', chapters: '6|5-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|66',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '133',
          slices: [
            { id: '0', src: '06', type: 'Image' },
            { id: '1', chapters: '6|9-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|67',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '134',
          slices: [
            { id: '0', src: '06', type: 'Image' },
            { id: '1', chapters: '6|13-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|68',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '135',
          slices: [
            { id: '0', src: '07', type: 'Image' },
            { id: '1', chapters: '7|4-5', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|71',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '136',
          slices: [
            { id: '0', src: '07', type: 'Image' },
            { id: '1', chapters: '7|6-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|72',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '137',
          slices: [
            { id: '0', src: '07', type: 'Image' },
            { id: '1', chapters: '7|9-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|73',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '138',
          slices: [
            { id: '0', src: '07', type: 'Image' },
            { id: '1', chapters: '7|13-15', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|74',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '139',
          slices: [
            { id: '0', src: '07', type: 'Image' },
            { id: '1', chapters: '7|16-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|75',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '140',
          slices: [
            { id: '0', src: '07', type: 'Image' },
            { id: '1', chapters: '7|19-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|76',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '7',
      title: "La montée et la chute du royaume d'Israël",
      subTitle: 'Ruth - 2 Rois',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fcity.png?alt=media&token=5b4a4f9e-f30d-4ed3-8c78-57e131bc2907',
      readingSlices: [
        {
          id: '30',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Ruth',
              description:
                'An Israelite family is struck by a series of tragic deaths, and God mysteriously provides for the widows through the generous acts of an Israelite farmer. The story explores how God can use all life experiences as part of His plan to bless and redeem His people.',
              url: 'https://www.youtube.com/watch?v=nl-Nlu17_ao',
            },
            { id: '1', src: '10', type: 'Image' },
            { id: '2', chapters: '8|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|77',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '31',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 1 Samuel',
              description:
                "God raises up Samuel to lead Israel in a desperate time, which eventually leads to the advent of the kingdom in Israel. Israel's first king, Saul, is a miserable failure and is replaced by the humble and faithful David who rises to greatness.",
              url: 'https://www.youtube.com/watch?v=QJOju5Dw0V0',
            },
            { id: '1', src: '11', type: 'Image' },
            { id: '2', chapters: '9|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|78',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '32',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 2 Samuel',
              description:
                "David becomes God's most faithful king, but then rebels, resulting in the slow destruction of his family and kingdom. The story offers a many-sided portrait of Israel's most famous king as a case study in human nature.",
              url: 'https://www.youtube.com/watch?v=YvoWDXNDJgs',
            },
            { id: '1', src: '12', type: 'Image' },
            { id: '2', chapters: '10|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|87',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '33',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 1 & 2 Kings',
              description:
                'After David, Solomon leads Israel into a period of greatness, followed by failure and rebellion. Israel splits into two separate kingdoms, and the story traces the slow decline of both, resulting in destruction at the hands of foreign empires. God sends waves of prophets to hold Israel accountable, but Israel ignores them, to her peril.',
              url: 'https://www.youtube.com/watch?v=bVFW3wbi9pk',
            },
            { id: '1', src: '13', type: 'Image' },
            { id: '2', chapters: '11|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|94',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '34',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '11|4-7', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|95',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '109',
          slices: [
            { id: '0', src: '12', type: 'Image' },
            { id: '1', chapters: '10|9-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|89',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '141',
          slices: [
            { id: '0', src: '11', type: 'Image' },
            { id: '1', chapters: '9|4-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|79',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '142',
          slices: [
            { id: '0', src: '11', type: 'Image' },
            { id: '1', chapters: '9|9-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|80',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '143',
          slices: [
            { id: '0', src: '11', type: 'Image' },
            { id: '1', chapters: '9|13-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|81',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '144',
          slices: [
            { id: '0', src: '11', type: 'Image' },
            { id: '1', chapters: '9|15-17', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|82',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '145',
          slices: [
            { id: '0', src: '11', type: 'Image' },
            { id: '1', chapters: '9|18-20', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|83',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '146',
          slices: [
            { id: '0', src: '11', type: 'Image' },
            { id: '1', chapters: '9|21-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|84',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '147',
          slices: [
            { id: '0', src: '11', type: 'Image' },
            { id: '1', chapters: '9|25-27', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|85',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '148',
          slices: [
            { id: '0', src: '11', type: 'Image' },
            { id: '1', chapters: '9|28-31', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|86',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '149',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: The Messiah',
              description:
                "You're about to read a very important part of the unified story of the Bible. God is going to promise David that there will always be a human representative from his line on the throne of Israel, which is a major part of our understanding of Jesus as Messiah in the New Testament. Watch this theme video as it unpacks the theme of `The Messiah`",
              url: 'https://www.youtube.com/watch?v=3dEh25pduQ8',
            },
            { id: '1', src: '12', type: 'Image' },
            { id: '2', chapters: '10|4-8', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|88',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '150',
          slices: [
            { id: '0', src: '12', type: 'Image' },
            { id: '1', chapters: '10|13-15', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|90',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '151',
          slices: [
            { id: '0', src: '12', type: 'Image' },
            { id: '1', chapters: '10|16-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|91',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '152',
          slices: [
            { id: '0', src: '12', type: 'Image' },
            { id: '1', chapters: '10|19-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|92',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '153',
          slices: [
            { id: '0', src: '12', type: 'Image' },
            { id: '1', chapters: '10|22-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|93',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '154',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '11|8-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|96',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '155',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '11|11-13', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|97',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '156',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '11|14-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|98',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '157',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '11|17-19', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|99',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '158',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '12|1-3', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|101',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '159',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '11|20-22', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|100',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '160',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '12|8-11', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|103',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '161',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '12|4-7', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|102',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '162',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '12|12-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|104',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '163',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '12|15-17', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|105',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '164',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '12|18-19', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|106',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '165',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '12|20-22', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|107',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '166',
          slices: [
            { id: '0', src: '13', type: 'Image' },
            { id: '1', chapters: '12|23-25', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|108',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '8',
      title: "Les prophètes avant l'Exode",
      subTitle: 'Ésaïe - Sophonie',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Flion.png?alt=media&token=d7ab972b-642d-4975-b2df-24985359c3dd',
      readingSlices: [
        {
          id: '35',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Isaiah 1-39',
              description:
                "Isaiah announces a message of judgment on Israel's failure to keep their covenant with God. It will purify Israel to prepare them for the coming messianic king who found the new Jerusalem to become a light to the nations. But all of these hopes seem to come crashing down with Israel's exile. How will the promises be fulfilled?",
              url: 'https://www.youtube.com/watch?v=d0A6Uchb1F8',
            },
            { id: '1', src: '22', type: 'Image' },
            { id: '2', chapters: '23|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|109',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '36',
          slices: [
            { id: '0', src: '22', type: 'Image' },
            { id: '1', chapters: '23|5-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|110',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '37',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Isaiah 40-66',
              description:
                "On the other side of Israel's exile, Isaiah's hope for the new Jerusalem and the messianic king are announced. It's then revealed that Israel is still hard-hearted after the exile, and that their king will become a suffering servant who will die for the sins of Israel and open up the covenant family of God to all nations.",
              url: 'https://www.youtube.com/watch?v=_TzdEPuqgQg',
            },
            { id: '1', src: '23', type: 'Image' },
            { id: '2', chapters: '23|39-41', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|118',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '38',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: The Gospel of the Kingdom',
              description:
                "Although the kingdom of Israel is currently going downhill, the prophet Isaiah looks forward to a coming messenger bringing 'the gospel of the Kingdom'. This theme is key to understanding the good news Jesus brought in the New Testament so take a look at this video.",
              url: 'https://www.youtube.com/watch?v=xmFPS0f-kzs',
            },
            { id: '1', src: '23', type: 'Image' },
            { id: '2', chapters: '23|52-54', type: 'Chapter' },
            {
              id: '3',
              verses: '19|119:97-128',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '39',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Hosea',
              description:
                "Hosea accuses Israel of breaking their covenant with God, and warns them of the tragic consequences to follow. But because God's mercy and covenant love are more powerful than Israel's sin, Hosea also announces hope for the future of Israel after the exile.",
              url: 'https://www.youtube.com/watch?v=kE6SZ1ogOVU',
            },
            { id: '1', src: '29', type: 'Image' },
            { id: '2', chapters: '28|1-5', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|122',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '40',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Joel',
              description:
                'Joel views a recent locust plague as an expression of the "Day of the Lord\'s" justice for Israel\'s sin. But his reflection on the Scriptures leads him to trust that true repentance will bring about the great restoration hoped for in the other prophetic books. For Joel, the past has become an image of the future.',
              url: 'https://www.youtube.com/watch?v=zQLazbgz90c',
            },
            { id: '1', src: '30', type: 'Image' },
            { id: '2', chapters: '29|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|125',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '41',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Amos',
              description:
                "Amos accuses Israel of breaking their covenant with God, and highlights how their idolatry has led to injustice and the neglect of the poor. Amos warns of God's coming justice on their sin, and challenges them that true worship of God will always lead to justice for the poor. The book ends with a promise of the messianic kingdom on the other side of God's judgment.",
              url: 'https://www.youtube.com/watch?v=mGgWaPGpGz4',
            },
            { id: '1', src: '31', type: 'Image' },
            { id: '2', chapters: '30|1-5', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|126',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '42',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Obadiah',
              description:
                "Obadiah accuses the nation of Edom, Israel's neighbor and relative, of violence and injustice. But Edom's downfall before Babylon becomes an image of how God will one day bring down all arrogant and violent nations and establish his kingdom of justice over them.",
              url: 'https://www.youtube.com/watch?v=i4ogCrEoG5s',
            },
            { id: '1', src: '32', type: 'Image' },
            { id: '2', chapters: '31|1', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|128',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '43',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Micah',
              description:
                "Micah announces that God's justice is coming down on Israel's sin and covenant failure. But their sin is not the final word, as God's covenant love and faithfulness will create a new future on the other side of Israel's sin and exile.",
              url: 'https://www.youtube.com/watch?v=MFEUEcylwLc',
            },
            { id: '1', src: '34', type: 'Image' },
            { id: '2', chapters: '33|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|130',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '44',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Jonah',
              description:
                "A subversive story about a rebellious prophet who hates his God for loving his enemies. Jonah's ridiculous behavior contrasts the soft-hearted repentant of the gentiles in this story, and so becomes the author's way of challenging the reader to reckon with God's love for their enemies as well.",
              url: 'https://www.youtube.com/watch?v=dLIabZc0O4c',
            },
            { id: '1', src: '33', type: 'Image' },
            { id: '2', chapters: '32|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|129',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '45',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Nahum',
              description:
                "Nahum portrays the downfall of Nineveh and Assyria as an image of how God will confront and bring down all violent human empires. His message of justice against Nineveh challenges us toward humility and hope for the future of God's world.",
              url: 'https://www.youtube.com/watch?v=Y30DanA5EhU',
            },
            { id: '1', src: '35', type: 'Image' },
            { id: '2', chapters: '34|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|132',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '46',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Habakkuk',
              description:
                "Habakkuk struggles to understand God's goodness in the midst of such evil and injustice in the world. God announces that he will bring down Babylon and any nations that act like Babylon and bring his kingdom and the messiah in the future. And so Habakkuk becomes an example of God's righteous people living by faith in his promises to rescue his world.",
              url: 'https://www.youtube.com/watch?v=OPMaRqGJPUU',
            },
            { id: '1', src: '36', type: 'Image' },
            { id: '2', chapters: '35|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|133',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '47',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Zephaniah',
              description:
                "Zephaniah announces God's coming judgment on Israel's injustice and covenant unfaithfulness. It will devastate Jerusalem and end in exile. But God's love and mercy will endure, and so Zephaniah sees this purifying judgment as the true hope of the world, as God creates a world where all people can flourish in safety and peace.",
              url: 'https://www.youtube.com/watch?v=oFZknKPNvz8',
            },
            { id: '1', src: '37', type: 'Image' },
            { id: '2', chapters: '36|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|134',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '167',
          slices: [
            { id: '0', src: '22', type: 'Image' },
            { id: '1', chapters: '23|9-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|111',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '168',
          slices: [
            { id: '0', src: '22', type: 'Image' },
            { id: '1', chapters: '23|13-17', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|112',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '169',
          slices: [
            { id: '0', src: '22', type: 'Image' },
            { id: '1', chapters: '23|18-22', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|113',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '170',
          slices: [
            { id: '0', src: '22', type: 'Image' },
            { id: '1', chapters: '23|23-27', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|114',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '171',
          slices: [
            { id: '0', src: '22', type: 'Image' },
            { id: '1', chapters: '23|28-30', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|115',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '172',
          slices: [
            { id: '0', src: '22', type: 'Image' },
            { id: '1', chapters: '23|31-35', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|116',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '173',
          slices: [
            { id: '0', src: '22', type: 'Image' },
            { id: '1', chapters: '23|36-38', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|117',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '174',
          slices: [
            { id: '0', src: '23', type: 'Image' },
            { id: '1', chapters: '23|42-44', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:1-32',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '175',
          slices: [
            { id: '0', src: '23', type: 'Image' },
            { id: '1', chapters: '23|45-48', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:33-64',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '176',
          slices: [
            { id: '0', src: '23', type: 'Image' },
            { id: '1', chapters: '23|49-51', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:65-96',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '177',
          slices: [
            { id: '0', src: '23', type: 'Image' },
            { id: '1', chapters: '23|55-57', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:129-152',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '178',
          slices: [
            { id: '0', src: '23', type: 'Image' },
            { id: '1', chapters: '23|58-60', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:153-176',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '179',
          slices: [
            { id: '0', src: '23', type: 'Image' },
            { id: '1', chapters: '23|61-64', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|120',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '180',
          slices: [
            { id: '0', src: '23', type: 'Image' },
            { id: '1', chapters: '23|65-66', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|121',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '181',
          slices: [
            { id: '0', src: '29', type: 'Image' },
            { id: '1', chapters: '28|6-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|123',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '182',
          slices: [
            { id: '0', src: '29', type: 'Image' },
            { id: '1', chapters: '28|11-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|124',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '183',
          slices: [
            { id: '0', src: '31', type: 'Image' },
            { id: '1', chapters: '30|6-9', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|127',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '184',
          slices: [
            { id: '0', src: '34', type: 'Image' },
            { id: '1', chapters: '33|5-7', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|131',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '9',
      title: "La Sagesse d'Israël",
      subTitle: 'Job - Cantique des cantiques',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fmessiah.png?alt=media&token=39a1fdb6-9860-4d73-8112-c46d3047ea24',
      readingSlices: [
        {
          id: '48',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Job',
              description:
                "The book of Job explores the difficult question of God's relationship to human suffering. And while it doesn't offer tidy answers, we are invited into new levels of trust in God's wisdom and character.",
              url: 'https://www.youtube.com/watch?v=xQwnH8th_fs',
            },
            { id: '1', src: '17', type: 'Image' },
            { id: '2', chapters: '18|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|135',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '49',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Ecclesiastes',
              description:
                "Ecclesiastes dismantles our simplistic ideas about God and our lives, by showing that death, chance, and the passage of time makes it impossible to control life's outcomes. But this unpredictable nature of life actually opens up the way to wisdom and the fear of the Lord.",
              url: 'https://www.youtube.com/watch?v=lrsQ1tc-2wk',
            },
            { id: '1', src: '20', type: 'Image' },
            { id: '2', chapters: '21|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|8',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '79',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Psalms',
              description:
                "The book of Psalms has been designed to be the prayerbook of God's people who are trying to be faithful to God as they wait for the messiah and his coming kingdom.",
              url: 'https://www.youtube.com/watch?v=j9phNEaPrv8',
            },
            { id: '1', chapters: '19|1-2', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|147',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '80',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Song of Songs',
              description:
                "The Song of Songs is a collection of ancient Israelite love poems that celebrates the beauty and power of God's gift of love and sexual desire.",
              url: 'https://www.youtube.com/watch?v=4KC7xE4fgOw',
            },
            { id: '1', src: '21', type: 'Image' },
            { id: '2', chapters: '22|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|11',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '110',
          slices: [
            { id: '0', src: '19', type: 'Image' },
            { id: '1', chapters: '20|4-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|149',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '185',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|4-7', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|136',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '186',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|8-11', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|137',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '187',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|12-15', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|138',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '188',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|16-19', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|139',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '189',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|20-23', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|140',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '190',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|24-28', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|141',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '191',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|29-31', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|142',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '192',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Wisdom: Job',
              description:
                'You are almost done with the book of Job! Take a look at this video highlighting the books place in the wisdom literature tradition of Israel.',
              url: 'https://www.youtube.com/watch?v=GswSg2ohqmA',
            },
            { id: '1', src: '17', type: 'Image' },
            { id: '2', chapters: '18|32-34', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|143',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '193',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|35-37', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|144',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '194',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|38-39', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|145',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '195',
          slices: [
            { id: '0', src: '17', type: 'Image' },
            { id: '1', chapters: '18|40-42', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|146',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '196',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Proverbs',
              description:
                "Proverbs explores what it means to live well in God's world, using wisdom and the fear of the Lord as your guide.",
              url: 'https://www.youtube.com/watch?v=AzmYV8GNAIM',
            },
            { id: '1', src: '19', type: 'Image' },
            { id: '2', chapters: '20|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|148',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '197',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Wisdom: Proverbs',
              description:
                'The book of Proverbs has a unique place in the wisdom literature tradition of Israel. Watch this video to see where it fits.',
              url: 'https://www.youtube.com/watch?v=Gab04dPs_uA',
            },
            { id: '1', src: '19', type: 'Image' },
            { id: '2', chapters: '20|7-9', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|150',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '198',
          slices: [
            { id: '0', src: '19', type: 'Image' },
            { id: '1', chapters: '20|13-15', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|2',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '199',
          slices: [
            { id: '0', src: '19', type: 'Image' },
            { id: '1', chapters: '20|10-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|1',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '200',
          slices: [
            { id: '0', src: '19', type: 'Image' },
            { id: '1', chapters: '20|16-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|3',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '201',
          slices: [
            { id: '0', src: '19', type: 'Image' },
            { id: '1', chapters: '20|19-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|4',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '202',
          slices: [
            { id: '0', src: '19', type: 'Image' },
            { id: '1', chapters: '20|22-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|5',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '203',
          slices: [
            { id: '0', src: '19', type: 'Image' },
            { id: '1', chapters: '20|28-31', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|7',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '204',
          slices: [
            { id: '0', src: '19', type: 'Image' },
            { id: '1', chapters: '20|25-27', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|6',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '205',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Wisdom: Ecclesiastes',
              description:
                'The book of Ecclesiastes has a unique place in the wisdom literature tradition of Israel. Watch this video to see where it fits.',
              url: 'https://www.youtube.com/watch?v=VeUiuSK81-0',
            },
            { id: '1', src: '20', type: 'Image' },
            { id: '2', chapters: '21|9-12', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|10',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '206',
          slices: [
            { id: '0', src: '20', type: 'Image' },
            { id: '1', chapters: '21|5-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|9',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '207',
          slices: [
            { id: '0', src: '21', type: 'Image' },
            { id: '1', chapters: '22|5-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|12',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '10',
      title: "Les prophètes de l'Exode",
      subTitle: 'Jérémie - Ézéchiel',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fcup.png?alt=media&token=c845af22-a02e-4dfe-a53b-df715f936db3',
      readingSlices: [
        {
          id: '4',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Ezekiel 1-32',
              description:
                "Ezekiel encounters God's glorious temple presence among the exiled Israelites in Babylon. He's commissioned to announce God's judgment on Israel and the nations for covenant failure and injustice.",
              url: 'https://www.youtube.com/watch?v=R-CIPu1nko8',
            },
            { id: '1', src: '26', type: 'Image' },
            { id: '2', chapters: '26|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|31',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '5',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Ezekiel 33-48',
              description:
                'After the fall of Jerusalem to Babylon, Ezekiel announces a message of hope that God will rescue Israel by bringing the messianic king, defeating evil among the nations, and bringing restoration to all of creation from his cosmic temple.',
              url: 'https://www.youtube.com/watch?v=SDeCWW_Bnyw',
            },
            { id: '1', src: '27', type: 'Image' },
            { id: '2', chapters: '26|31-33', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|40',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '50',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Jeremiah',
              description:
                "Jeremiah accuses Israel of breaking their covenant with God and warns them about the resulting exile to Babylon. But his hope is that God's mercy will one day heal Israel's rebellious hearts so they can truly know and follow their God.",
              url: 'https://www.youtube.com/watch?v=RSK36cHbrk0',
            },
            { id: '1', src: '24', type: 'Image' },
            { id: '2', chapters: '24|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|13',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '51',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|30-32', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|21',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '52',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Lamentations',
              description:
                "Lamentations is a collection of five poems that explore the grief and trauma experienced by Israel in the fall of Jerusalem and the exile to Babylon. These honest expressions of pain become the basis for hope in God's mercy, and teach us that lamenting evil and tragedy is part of the journey of faith.",
              url: 'https://www.youtube.com/watch?v=p8GDFPdaQZQ',
            },
            { id: '1', src: '25', type: 'Image' },
            { id: '2', chapters: '25|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|28',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '53',
          slices: [
            { id: '0', src: '27', type: 'Image' },
            { id: '1', chapters: '26|34-36', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|41',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '54',
          slices: [
            { id: '0', src: '27', type: 'Image' },
            { id: '1', chapters: '26|45-48', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|44',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '208',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|4-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|14',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '209',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|7-9', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|15',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '210',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|10-13', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|16',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '211',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|14-17', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|17',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '212',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|18-22', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|18',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '213',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|23-25', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|19',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '214',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|26-29', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|20',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '215',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|33-36', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|22',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '216',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|37-39', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|23',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '217',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|40-44', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|24',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '218',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|45-48', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|25',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '219',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|49-50', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|26',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '220',
          slices: [
            { id: '0', src: '24', type: 'Image' },
            { id: '1', chapters: '24|51-52', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|27',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '221',
          slices: [
            { id: '0', src: '25', type: 'Image' },
            { id: '1', chapters: '25|3', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|29',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '222',
          slices: [
            { id: '0', src: '25', type: 'Image' },
            { id: '1', chapters: '25|4-5', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|30',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '223',
          slices: [
            { id: '0', src: '26', type: 'Image' },
            { id: '1', chapters: '26|5-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|32',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '224',
          slices: [
            { id: '0', src: '26', type: 'Image' },
            { id: '1', chapters: '26|9-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|33',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '225',
          slices: [
            { id: '0', src: '26', type: 'Image' },
            { id: '1', chapters: '26|13-15', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|34',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '226',
          slices: [
            { id: '0', src: '26', type: 'Image' },
            { id: '1', chapters: '26|16-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|35',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '227',
          slices: [
            { id: '0', src: '26', type: 'Image' },
            { id: '1', chapters: '26|19-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|36',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '228',
          slices: [
            { id: '0', src: '26', type: 'Image' },
            { id: '1', chapters: '26|22-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|37',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '229',
          slices: [
            { id: '0', src: '26', type: 'Image' },
            { id: '1', chapters: '26|25-27', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|38',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '230',
          slices: [
            { id: '0', src: '26', type: 'Image' },
            { id: '1', chapters: '26|28-30', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|39',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '231',
          slices: [
            { id: '0', src: '27', type: 'Image' },
            { id: '1', chapters: '26|37-39', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|42',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '232',
          slices: [
            { id: '0', src: '27', type: 'Image' },
            { id: '1', chapters: '26|40-44', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|43',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '11',
      title: "Le retour d'Exode",
      subTitle: 'Esdras-Néhémie, Esther',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fwall.png?alt=media&token=d33b38e2-76dc-4c97-a29d-bf2d67f51219',
      readingSlices: [
        {
          id: '6',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Ezra-Nehemiah',
              description:
                "The book of Ezra-Nehemiah tells the story of Israel's return to Jerusalem to rebuild their lives and renew the covenant. Despite their best attempts, Israel's leaders are unable to bring about the fulfillment of the prophetic hopes, and so the story ends waiting for God to heal the hearts of his people and send the messianic kingdom.",
              url: 'https://www.youtube.com/watch?v=MkETkRv9tG8',
            },
            { id: '1', src: '15', type: 'Image' },
            { id: '2', chapters: '15|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|45',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '7',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Esther',
              description:
                "Esther tells the story of God's mysterious providence at work to rescue his people from disaster. It happens through the most unlikely people and in surprising ways, encouraging us to look for signs of God's direction in our own lives as well.",
              url: 'https://www.youtube.com/watch?v=JydNSlufRIs',
            },
            { id: '1', src: '16', type: 'Image' },
            { id: '2', chapters: '17|1-5', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|53',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '233',
          slices: [
            { id: '0', src: '15', type: 'Image' },
            { id: '1', chapters: '15|4-7', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|46',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '234',
          slices: [
            { id: '0', src: '15', type: 'Image' },
            { id: '1', chapters: '15|8-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|47',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '235',
          slices: [
            { id: '0', src: '15', type: 'Image' },
            { id: '1', chapters: '16|1-3', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|48',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '236',
          slices: [
            { id: '0', src: '15', type: 'Image' },
            { id: '1', chapters: '16|7-9', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|50',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '237',
          slices: [
            { id: '0', src: '15', type: 'Image' },
            { id: '1', chapters: '16|4-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|49',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '238',
          slices: [
            { id: '0', src: '15', type: 'Image' },
            { id: '1', chapters: '16|10-11', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|51',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '239',
          slices: [
            { id: '0', src: '15', type: 'Image' },
            { id: '1', chapters: '16|12-13', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|52',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '240',
          slices: [
            { id: '0', src: '16', type: 'Image' },
            { id: '1', chapters: '17|6-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|54',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '12',
      title: "Les prophètes après l'Exode",
      subTitle: 'Daniel - Malachie',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fstaff.png?alt=media&token=73052845-a68d-4f77-9dc5-3a5120c46439',
      readingSlices: [
        {
          id: '9',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Daniel',
              description:
                "The story of Daniel and his friends in Babylon motivate faithfulness in the midst of exile in a foreign land. Daniels' visions offer hope that God will one day bring his kingdom and defeat evil among all the nations.",
              url: 'https://www.youtube.com/watch?v=9cSC9uobtPM',
            },
            { id: '1', src: '28', type: 'Image' },
            { id: '2', chapters: '27|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|55',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '10',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Haggai',
              description:
                "Haggai challenges Israel after the exile to remain faithful to their God and rebuild the temple. If they disobey, they risk losing their role in the fulfillment of God's promises to bring the messianic kingdom. ",
              url: 'https://www.youtube.com/watch?v=juPvv_xcX-U',
            },
            { id: '1', src: '38', type: 'Image' },
            { id: '2', chapters: '37|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|59',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '11',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Malachi',
              description:
                "Malachi exposes the selfishness and hard hearts of Israel after the exile, and announces that the coming day of the Lord will purify Israel and prepare them for God's future kingdom.",
              url: 'https://www.youtube.com/watch?v=HPGShWZ4Jvk',
            },
            { id: '1', src: '40', type: 'Image' },
            { id: '2', chapters: '39|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|63',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '111',
          slices: [
            { id: '0', src: '39', type: 'Image' },
            { id: '1', chapters: '38|5-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|61',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '241',
          slices: [
            { id: '0', src: '28', type: 'Image' },
            { id: '1', chapters: '27|4-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|56',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '242',
          slices: [
            { id: '0', src: '28', type: 'Image' },
            { id: '1', chapters: '27|7-9', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|57',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '243',
          slices: [
            { id: '0', src: '28', type: 'Image' },
            { id: '1', chapters: '27|10-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|58',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '244',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Zechariah',
              description:
                "Zechariah's visions foster hope in the future promise of the messianic kingdom, and challenge Israel after the exile to remain faithful to their God.",
              url: 'https://www.youtube.com/watch?v=_106IfO6Kc0',
            },
            { id: '1', src: '39', type: 'Image' },
            { id: '2', chapters: '38|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|60',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '245',
          slices: [
            { id: '0', src: '39', type: 'Image' },
            { id: '1', chapters: '38|9-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|62',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '246',
          slices: [
            { id: '0', src: '40', type: 'Image' },
            { id: '1', chapters: '39|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|64',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '13',
      title: "L'histoire jusqu'à présent ",
      subTitle: '1-2 Chroniques',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fscroll.png?alt=media&token=742cecb4-e07b-4bc9-ab49-a527fb4ce7f7',
      readingSlices: [
        {
          id: '12',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 1-2 Chronicles',
              description:
                "Chronicles is a majestic summary of the entire Old Testament. It was written to show how Israel's story from the past points to the future hope of the messianic kingdom. ",
              url: 'https://www.youtube.com/watch?v=HR7xaHv3Ias',
            },
            { id: '1', src: '41', type: 'Image' },
            { id: '2', chapters: '13|1-10', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|65',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '247',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '13|11-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|66',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '248',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '13|18-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|68',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '249',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '13|15-17', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|67',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '250',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '13|22-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|69',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '251',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '13|25-29', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|70',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '252',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|1-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|71',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '253',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|5-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|72',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '254',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|9-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|73',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '255',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|13-17', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|74',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '256',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|18-20', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|75',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '257',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|21-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|76',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '258',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|25-27', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|77',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '259',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|28-31', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|78',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '260',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|35-36', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|80',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '261',
          slices: [
            { id: '0', src: '41', type: 'Image' },
            { id: '1', chapters: '14|32-34', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|79',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '14',
      title: 'Jésus et le Royaume',
      subTitle: 'Matthieu - Actes',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fcross.png?alt=media&token=241e0fb0-178a-4fd0-9389-7a50db213854',
      readingSlices: [
        {
          id: '1',
          slices: [
            { id: '0', src: '48', type: 'Image' },
            { id: '1', chapters: '42|14-16', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:1-32',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '13',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Matthew 14-28',
              description:
                "Matthew shows how Jesus' announcement of God's kingdom generates hostility from Israel's leaders. It all leads to his sacrificial death and resurrection in Jerusalem, and the story ends with the risen Jesus as the new king of the world.",
              url: 'https://www.youtube.com/watch?v=GGCF3OPWN14',
            },
            { id: '1', src: '43', type: 'Image' },
            { id: '2', chapters: '40|13-14', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|87',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '14',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: John 1-12',
              description:
                "John presents Jesus as the incarnation of the creator God of Israel, who has come as the fulfillment of Israel's entire story. In Jesus, God's love and the gift of eternal life are offered to the world.",
              url: 'https://www.youtube.com/watch?v=G-2e9mMf7E8',
            },
            { id: '1', src: '45', type: 'Image' },
            { id: '2', chapters: '43|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|103',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '55',
          slices: [
            { id: '0', src: '42', type: 'Image' },
            { id: '1', chapters: '40|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|82',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '56',
          slices: [
            { id: '0', src: '42', type: 'Image' },
            { id: '1', chapters: '40|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|83',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '57',
          slices: [
            { id: '0', src: '44', type: 'Image' },
            { id: '1', chapters: '41|7-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|98',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '71',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: John 13-21',
              description:
                "John presents Jesus' final words to his disciples before his death and resurrection. His departure will allow the Spirit to come and empower his followers to carry on his mission in the world.",
              url: 'https://www.youtube.com/watch?v=RUfh_wOsauk',
            },
            { id: '1', src: '46', type: 'Image' },
            { id: '2', chapters: '43|13-15', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|109',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '72',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Luke 1-9',
              description:
                "Luke introduces Jesus as promised king of Israel and God's son who announces good news to the poor. Jesus is portrayed as a new Moses who will liberate Israel through a new Exodus.",
              url: 'https://www.youtube.com/watch?v=XIb_dCIxzr0',
            },
            { id: '1', src: '47', type: 'Image' },
            { id: '2', chapters: '42|1', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|112',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '73',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Acts 1-12',
              description:
                "Luke continues Jesus' story by showing the Holy Spirit is sent to make the disciples into a new temple. Through them, Jesus and the Spirit will carry on the mission of God's kingdom in the world.",
              url: 'https://www.youtube.com/watch?v=CGbNw855ksw',
            },
            { id: '1', src: '49', type: 'Image' },
            { id: '2', chapters: '44|1-2', type: 'Chapter' },
            {
              id: '3',
              verses: '19|119:153-176',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '112',
          slices: [
            { id: '0', src: '42', type: 'Image' },
            { id: '1', chapters: '40|7-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|84',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '113',
          slices: [
            { id: '0', src: '44', type: 'Image' },
            { id: '1', chapters: '41|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|97',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '114',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|15-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|126',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '262',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Matthew 1-13',
              description:
                "Matthew presents Jesus as the God of Israel who comes to be with his people. He is a new Moses who brings God's kingdom and a new Torah to Israel.",
              url: 'https://www.youtube.com/watch?v=NUh9Bsiee_U',
            },
            { id: '1', src: '42', type: 'Image' },
            { id: '2', chapters: '40|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|81',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '263',
          slices: [
            { id: '0', src: '42', type: 'Image' },
            { id: '1', chapters: '40|9-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|85',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '264',
          slices: [
            { id: '0', src: '42', type: 'Image' },
            { id: '1', chapters: '40|11-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|86',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '265',
          slices: [
            { id: '0', src: '43', type: 'Image' },
            { id: '1', chapters: '40|15-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|88',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '266',
          slices: [
            { id: '0', src: '43', type: 'Image' },
            { id: '1', chapters: '40|17-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|89',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '267',
          slices: [
            { id: '0', src: '43', type: 'Image' },
            { id: '1', chapters: '40|21-22', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|91',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '268',
          slices: [
            { id: '0', src: '43', type: 'Image' },
            { id: '1', chapters: '40|19-20', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|90',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '269',
          slices: [
            { id: '0', src: '43', type: 'Image' },
            { id: '1', chapters: '40|25-26', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|93',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '270',
          slices: [
            { id: '0', src: '43', type: 'Image' },
            { id: '1', chapters: '40|23-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|92',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '271',
          slices: [
            { id: '0', src: '43', type: 'Image' },
            { id: '1', chapters: '40|27-28', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|94',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '272',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Mark',
              description:
                "Mark's story emphasizes the scandalous claim that Jesus is Israel's messianic king who established his kingdom through his suffering, death, and resurrection. ",
              url: 'https://www.youtube.com/watch?v=HGHqu9-DtXk',
            },
            { id: '1', src: '44', type: 'Image' },
            { id: '2', chapters: '41|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|95',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '273',
          slices: [
            { id: '0', src: '44', type: 'Image' },
            { id: '1', chapters: '41|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|96',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '274',
          slices: [
            { id: '0', src: '44', type: 'Image' },
            { id: '1', chapters: '41|11-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|100',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '275',
          slices: [
            { id: '0', src: '44', type: 'Image' },
            { id: '1', chapters: '41|13-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|101',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '276',
          slices: [
            { id: '0', src: '44', type: 'Image' },
            { id: '1', chapters: '41|15-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|102',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '277',
          slices: [
            { id: '0', src: '45', type: 'Image' },
            { id: '1', chapters: '43|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|104',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '278',
          slices: [
            { id: '0', src: '45', type: 'Image' },
            { id: '1', chapters: '43|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|105',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '279',
          slices: [
            { id: '0', src: '45', type: 'Image' },
            { id: '1', chapters: '43|7-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|106',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '280',
          slices: [
            { id: '0', src: '45', type: 'Image' },
            { id: '1', chapters: '43|9-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|107',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '281',
          slices: [
            { id: '0', src: '45', type: 'Image' },
            { id: '1', chapters: '43|11-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|108',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '282',
          slices: [
            { id: '0', src: '46', type: 'Image' },
            { id: '1', chapters: '43|16-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|110',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '283',
          slices: [
            { id: '0', src: '46', type: 'Image' },
            { id: '1', chapters: '43|19-21', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|111',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '284',
          slices: [
            { id: '0', src: '47', type: 'Image' },
            { id: '1', chapters: '42|2-3', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|113',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '285',
          slices: [
            { id: '0', src: '47', type: 'Image' },
            { id: '1', chapters: '42|4-5', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|114',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '286',
          slices: [
            { id: '0', src: '47', type: 'Image' },
            { id: '1', chapters: '42|8-9', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|116',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '287',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Luke 10-24',
              description:
                "Luke traces Jesus' journey to Jerusalem, which becomes an education in discipleship for his followers. Israel's resistance to Jesus' message culminates in his death and resurrection, which opens up hope for all nations.",
              url: 'https://www.youtube.com/watch?v=26z_KhwNdD8',
            },
            { id: '1', src: '48', type: 'Image' },
            { id: '2', chapters: '42|10-11', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|117',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '288',
          slices: [
            { id: '0', src: '47', type: 'Image' },
            { id: '1', chapters: '42|6-7', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|115',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '289',
          slices: [
            { id: '0', src: '48', type: 'Image' },
            { id: '1', chapters: '42|12-13', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|118',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '290',
          slices: [
            { id: '0', src: '48', type: 'Image' },
            { id: '1', chapters: '42|17-18', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:33-64',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '291',
          slices: [
            { id: '0', src: '48', type: 'Image' },
            { id: '1', chapters: '42|21-22', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:97-128',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '292',
          slices: [
            { id: '0', src: '48', type: 'Image' },
            { id: '1', chapters: '42|19-20', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:65-96',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '293',
          slices: [
            { id: '0', src: '48', type: 'Image' },
            { id: '1', chapters: '42|23-24', type: 'Chapter' },
            {
              id: '2',
              verses: '19|119:129-152',
              type: 'Verse',
              subType: 'pray',
            },
          ],
        },
        {
          id: '294',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|120',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '295',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|11-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|124',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '296',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|121',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '297',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|9-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|123',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '298',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|7-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|122',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '299',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Acts 13-28',
              description:
                'Luke traces how the Spirit-empowered messianic movement in Jerusalem becomes a multi-ethnic international movement that spreads all the way to Rome. ',
              url: 'https://www.youtube.com/watch?v=Z-17KxpjL0Q',
            },
            { id: '1', src: '49', type: 'Image' },
            { id: '2', chapters: '44|13-14', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|125',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '300',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|17-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|127',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '301',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|19-20', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|128',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '302',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|23-24', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|130',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '303',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|21-22', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|129',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '304',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|25-26', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|131',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '305',
          slices: [
            { id: '0', src: '49', type: 'Image' },
            { id: '1', chapters: '44|27-28', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|132',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '356',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Gospel of Mark',
              description:
                "Our gospel video series gives you an animated look at all the action. Here's a good recap of Mark.",
              url: 'https://www.youtube.com/watch?v=OVRixfameGY',
            },
            { id: '1', src: '44', type: 'Image' },
            { id: '2', chapters: '41|9-10', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|99',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '15',
      title: 'Le peuple du Royaume',
      subTitle: 'Romains - Jude',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Fpeople.png?alt=media&token=6dececee-b071-429c-8237-ba8a724b7567',
      readingSlices: [
        {
          id: '2',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Romans 1-4',
              description:
                'This video introduces Paul the Apostle and summarizes the historical context and main ideas of the first four chapters of his most epic work, The Letter to the Romans.',
              url: 'https://www.youtube.com/watch?v=ej_6dVdJSIU',
            },
            { id: '1', src: '50', type: 'Image' },
            { id: '2', chapters: '45|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|133',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '58',
          slices: [
            { id: '0', src: '50', type: 'Image' },
            { id: '1', chapters: '45|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|134',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '59',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 1 Corinthians',
              description:
                "Paul addresses a host of problems in the ancient church of Corinth. As he does so, he shows us what it means to see all of life's complexities through the lens of the Gospel about Jesus.",
              url: 'https://www.youtube.com/watch?v=veU6dB3996o',
            },
            { id: '1', src: '52', type: 'Image' },
            { id: '2', chapters: '46|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|141',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '60',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Galatians',
              description:
                "Paul confronts the Galatians Christians for thinking they could supplement God's grace by observing certain commands in the Torah. He reminds them that salvation is a total gift of God's love, and needs no completion through religious rituals. ",
              url: 'https://www.youtube.com/watch?v=vmx4UjRFp0M',
            },
            { id: '1', src: '54', type: 'Image' },
            { id: '2', chapters: '48|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|5',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '61',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Ephesians',
              description:
                'Paul offers a panoramic summary of his entire message and mission as an apostle of Jesus to the non-Jewish world. He also shows how the Gospel creates a diverse community that is unified by devotion to Jesus and to each other.',
              url: 'https://www.youtube.com/watch?v=Y71r-T98E2Q',
            },
            { id: '1', src: '55', type: 'Image' },
            { id: '2', chapters: '49|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|8',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '62',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Colossians',
              description:
                'Paul shows the Colossian Christians how Jesus is key to understanding all of reality. His death and resurrection as king of the world demand that every aspect of our lives be transformed by his love and grace.',
              url: 'https://www.youtube.com/watch?v=pXTXlDxQsvc',
            },
            { id: '1', src: '57', type: 'Image' },
            { id: '2', chapters: '51|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|13',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '63',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 1 Thessalonians',
              description:
                'Paul comforts the Thessalonian Christians in the midst of persecution and fear. He directs their hope to the future return of Jesus who will bring justice and make all things right.',
              url: 'https://www.youtube.com/watch?v=No7Nq6IX23c',
            },
            { id: '1', src: '59a', type: 'Image' },
            { id: '2', chapters: '52|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|15',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '64',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 2 Thessalonians',
              description:
                "Paul brings more comfort to the persecuted Thessalonian Christians. He also clarifies his teaching about Jesus' future return and challenges people whose selfish lifestyles are causing trouble in the church.",
              url: 'https://www.youtube.com/watch?v=kbPBDKOn1cc',
            },
            { id: '1', src: '59b', type: 'Image' },
            { id: '2', chapters: '53|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|18',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '65',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 1 Timothy',
              description:
                "Paul guides Timothy in how to restore order to the church in Ephesus. It's been disrupted by corrupt leaders who are leading the people astray. Here Paul offers a wholistic vision of the church's purpose and mission in the world.",
              url: 'https://www.youtube.com/watch?v=7RoqnGcEjcs',
            },
            { id: '1', src: '60', type: 'Image' },
            { id: '2', chapters: '54|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|19',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '66',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 2 Timothy',
              description:
                "Paul writes his final letter from prison, asking Timothy to come visit him before he's executed. Paul offers a personal challenge to Timothy and shows us that following Jesus requires sacrifice and risk.",
              url: 'https://www.youtube.com/watch?v=urlvnxCaL00',
            },
            { id: '1', src: '61', type: 'Image' },
            { id: '2', chapters: '55|1-4', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|22',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '67',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Hebrews',
              description:
                'Hebrew is a powerful and pastoral teaching showing how Jesus is the perfect representation and expression of the Creator God. We are challenged to follow him at all costs.',
              url: 'https://www.youtube.com/watch?v=z9wqN-nwSzE',
            },
            { id: '1', src: '63', type: 'Image' },
            { id: '2', chapters: '58|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|25',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '68',
          slices: [
            { id: '0', src: '67', type: 'Image' },
            { id: '1', chapters: '62|5', type: 'Chapter' },
            { id: '2', chapters: '63|1', type: 'Chapter' },
            { id: '3', chapters: '64|1', type: 'Chapter' },
            {
              id: '4',
              chapters: '19|38',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '74',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 2 Corinthians',
              description:
                'Paul repairs his relationship with the Corinthians, showing them how the scandalous message of the crucified Jesus opens up a totally new way of life.',
              url: 'https://www.youtube.com/watch?v=3lfPK2vfC54',
            },
            { id: '1', src: '53', type: 'Image' },
            { id: '2', chapters: '47|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|149',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '75',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Titus',
              description:
                "Paul comissions Titus to bring order to the house churches on the Island of Crete. He shows how the Gospel can transform Cretan culture from within as Jesus' followers depend on the Spirit to empower a totally new way of life.",
              url: 'https://www.youtube.com/watch?v=qgAZH5ExwrM',
            },
            { id: '1', src: '62', type: 'Image' },
            { id: '2', chapters: '56|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|23',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '76',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Philemon',
              description:
                'Paul mediates between Philemon and his escaped former slave Onesimus. He shows how the Gospel has made them brothers in the Messiah, and demands that their relationship be healed and transformed.',
              url: 'https://www.youtube.com/watch?v=aW9Q3Jt6Yvk',
            },
            { id: '1', src: '58', type: 'Image' },
            { id: '2', chapters: '57|1', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|24',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '77',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 2 Peter',
              description:
                "Peter confronts corrupt teachers who have distorted the message about Jesus and lead others astray. He points Christians to the hope of Jesus' return which can motivate faithfulness.",
              url: 'https://www.youtube.com/watch?v=wWLv_ITyKYc',
            },
            { id: '1', src: '66', type: 'Image' },
            { id: '2', chapters: '61|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|35',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '115',
          slices: [
            { id: '0', src: '51', type: 'Image' },
            { id: '1', chapters: '45|11-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|138',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '116',
          slices: [
            { id: '0', src: '56', type: 'Image' },
            { id: '1', chapters: '50|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|12',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '117',
          slices: [
            { id: '0', src: '64', type: 'Image' },
            { id: '1', chapters: '59|4-5', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|32',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '118',
          slices: [
            { id: '0', src: '65', type: 'Image' },
            { id: '1', chapters: '60|3-5', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|34',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '119',
          slices: [
            { id: '0', src: '67', type: 'Image' },
            { id: '1', chapters: '62|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|37',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '306',
          slices: [
            { id: '0', src: '51', type: 'Image' },
            { id: '1', chapters: '45|7-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|136',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '307',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Romans 5-16',
              description:
                'This video explores the main ideas and flow of thought in chapters 5-16 of The Letter to the Romans, Paul the Apostle’s most epic work.',
              url: 'https://www.youtube.com/watch?v=0SVTl4Xa5fY',
            },
            { id: '1', src: '51', type: 'Image' },
            { id: '2', chapters: '45|5-6', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|135',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '308',
          slices: [
            { id: '0', src: '51', type: 'Image' },
            { id: '1', chapters: '45|9-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|137',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '309',
          slices: [
            { id: '0', src: '51', type: 'Image' },
            { id: '1', chapters: '45|13-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|139',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '310',
          slices: [
            { id: '0', src: '51', type: 'Image' },
            { id: '1', chapters: '45|15-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|140',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '311',
          slices: [
            { id: '0', src: '52', type: 'Image' },
            { id: '1', chapters: '46|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|142',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '312',
          slices: [
            { id: '0', src: '52', type: 'Image' },
            { id: '1', chapters: '46|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|143',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '313',
          slices: [
            { id: '0', src: '52', type: 'Image' },
            { id: '1', chapters: '46|7-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|144',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '314',
          slices: [
            { id: '0', src: '52', type: 'Image' },
            { id: '1', chapters: '46|9-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|145',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '315',
          slices: [
            { id: '0', src: '52', type: 'Image' },
            { id: '1', chapters: '46|11-12', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|146',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '316',
          slices: [
            { id: '0', src: '52', type: 'Image' },
            { id: '1', chapters: '46|13-14', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|147',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '317',
          slices: [
            { id: '0', src: '52', type: 'Image' },
            { id: '1', chapters: '46|15-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|148',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '318',
          slices: [
            { id: '0', src: '53', type: 'Image' },
            { id: '1', chapters: '47|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|150',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '319',
          slices: [
            { id: '0', src: '53', type: 'Image' },
            { id: '1', chapters: '47|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|1',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '320',
          slices: [
            { id: '0', src: '53', type: 'Image' },
            { id: '1', chapters: '47|7-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|2',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '321',
          slices: [
            { id: '0', src: '53', type: 'Image' },
            { id: '1', chapters: '47|9-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|3',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '322',
          slices: [
            { id: '0', src: '53', type: 'Image' },
            { id: '1', chapters: '47|11-13', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|4',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '323',
          slices: [
            { id: '0', src: '54', type: 'Image' },
            { id: '1', chapters: '48|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|6',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '324',
          slices: [
            { id: '0', src: '54', type: 'Image' },
            { id: '1', chapters: '48|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|7',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '325',
          slices: [
            { id: '0', src: '55', type: 'Image' },
            { id: '1', chapters: '49|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|10',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '326',
          slices: [
            { id: '0', src: '55', type: 'Image' },
            { id: '1', chapters: '49|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|9',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '327',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Philippians',
              description:
                "Paul thanks the Christians in Philppi for their support, and he shows how Jesus' self-giving love is the model for the Christian way of life.",
              url: 'https://www.youtube.com/watch?v=oE9qqW1-BkU',
            },
            { id: '1', src: '56', type: 'Image' },
            { id: '2', chapters: '50|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|11',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '328',
          slices: [
            { id: '0', src: '57', type: 'Image' },
            { id: '1', chapters: '51|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|14',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '329',
          slices: [
            { id: '0', src: '59a', type: 'Image' },
            { id: '1', chapters: '52|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|16',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '330',
          slices: [
            { id: '0', src: '59a', type: 'Image' },
            { id: '1', chapters: '52|5', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|17',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '331',
          slices: [
            { id: '0', src: '60', type: 'Image' },
            { id: '1', chapters: '54|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|20',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '332',
          slices: [
            { id: '0', src: '60', type: 'Image' },
            { id: '1', chapters: '54|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|21',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '333',
          slices: [
            { id: '0', src: '63', type: 'Image' },
            { id: '1', chapters: '58|3-4', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|26',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '334',
          slices: [
            { id: '0', src: '63', type: 'Image' },
            { id: '1', chapters: '58|5-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|27',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '335',
          slices: [
            { id: '0', src: '63', type: 'Image' },
            { id: '1', chapters: '58|7-8', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|28',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '336',
          slices: [
            { id: '0', src: '63', type: 'Image' },
            { id: '1', chapters: '58|9-10', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|29',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '337',
          slices: [
            { id: '0', src: '63', type: 'Image' },
            { id: '1', chapters: '58|11-13', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|30',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '338',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: James',
              description:
                'James combines the wisdom of his brother Jesus and the book of Proverbs into his own challenging call to life of whole-hearted devotion to God.',
              url: 'https://www.youtube.com/watch?v=qn-hLHWwRYY',
            },
            { id: '1', src: '64', type: 'Image' },
            { id: '2', chapters: '59|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|31',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '339',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 1 Peter',
              description:
                'Peter offers hope to Christians suffering persecution and guides them with practical instruction about the way of life consistent with following Jesus.',
              url: 'https://www.youtube.com/watch?v=WhP7AZQlzCg',
            },
            { id: '1', src: '65', type: 'Image' },
            { id: '2', chapters: '60|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|33',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '340',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: 1-3 John',
              description:
                "John calls followers of Jesus to share in God's own life and love by devoting themselves to loving one another. ",
              url: 'https://www.youtube.com/watch?v=l3QkE6nKylM',
            },
            { id: '1', src: '67', type: 'Image' },
            { id: '2', chapters: '62|1-2', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|36',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '357',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Jude',
              description:
                'Jude confronts corrupt teachers who distort the message about Jesus his brother and lead others astray.',
              url: 'https://www.youtube.com/watch?v=6UoCmakZmys',
            },
            { id: '1', src: '68', type: 'Image' },
            { id: '2', chapters: '65|1', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|39',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
    {
      id: '16',
      title: "L'Apocalypse",
      subTitle: 'Apocalypse',
      image:
        'https://firebasestorage.googleapis.com/v0/b/bible-strong-app.appspot.com/o/images%2Flamb.png?alt=media&token=1499156d-77ae-4b54-9940-a5d8411df648',
      readingSlices: [
        {
          id: '69',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Revelation 1-11',
              description:
                'John addresses seven churches with a challenge to remain faithful to Jesus despite persecution and the temptation to apathy. His visions open up an alternate vision of human history, showing how Jesus is the true king of history.',
              url: 'https://www.youtube.com/watch?v=5nvVVcYD-0w',
            },
            { id: '1', src: '69', type: 'Image' },
            { id: '2', chapters: '66|1-3', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|40',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '70',
          slices: [
            { id: '0', src: '70', type: 'Image' },
            { id: '1', chapters: '66|21-22', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|48',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '78',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Revelation 12-22',
              description:
                "John recounts his visions about Jesus' exalted rule over the world and how he will in due time bring final justice on the world's evil and return to bring renewal to all creation.",
              url: 'https://www.youtube.com/watch?v=QpnIrbq2bKo',
            },
            { id: '1', src: '70', type: 'Image' },
            { id: '2', chapters: '66|12-13', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|44',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '341',
          slices: [
            { id: '0', src: '69', type: 'Image' },
            { id: '1', chapters: '66|4-6', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|41',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '342',
          slices: [
            { id: '0', src: '69', type: 'Image' },
            { id: '1', chapters: '66|7-9', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|42',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '343',
          slices: [
            { id: '0', src: '69', type: 'Image' },
            { id: '1', chapters: '66|10-11', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|43',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '344',
          slices: [
            { id: '0', src: '70', type: 'Image' },
            { id: '1', chapters: '66|14-16', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|45',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '345',
          slices: [
            { id: '0', src: '70', type: 'Image' },
            { id: '1', chapters: '66|17-18', type: 'Chapter' },
            {
              id: '2',
              chapters: '19|46',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
        {
          id: '346',
          slices: [
            {
              id: '0',
              type: 'Video',
              title: 'Video: Heaven and Earth',
              description:
                'Your journey through the Bible is nearly complete! Now is a great time to watch the Heaven and Earth theme video. The union of heaven and earth is what the story is all about. In Revelation we are about to get an idea of what this will look like. ',
              url: 'https://www.youtube.com/watch?v=Zy2AQlK6C5k',
            },
            { id: '1', src: '70', type: 'Image' },
            { id: '2', chapters: '66|19-20', type: 'Chapter' },
            {
              id: '3',
              chapters: '19|47',
              type: 'Chapter',
              subType: 'pray',
            },
          ],
        },
      ],
    },
  ],
}
