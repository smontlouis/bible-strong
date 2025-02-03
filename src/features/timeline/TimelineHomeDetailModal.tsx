import React from 'react'

import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Trans, useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import InlineLink from '~common/InlineLink'
import Accordion from '~common/ui/Accordion'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'

interface Props {
  modalRef: React.RefObject<BottomSheet>
  HeaderComponent?: React.ReactNode
  FooterComponent?: React.ReactNode
}

const TimelineHomeDetailModal = ({ modalRef }: Props) => {
  const { t } = useTranslation()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  return (
    <BottomSheet
      ref={modalRef}
      index={-1}
      topInset={useSafeAreaInsets().top}
      snapPoints={['100%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      key={key}
      {...bottomSheetStyles}
    >
      <BottomSheetScrollView>
        <Box mt={20} p={20}>
          <Paragraph>
            <Trans>
              Traduction de la Chronologie biblique{' '}
              <InlineLink href="http://timeline.biblehistory.com/home">
                "The Bible Timeline"
              </InlineLink>
              , avec l'autorisation d'
              <InlineLink href="https://www.bibleuniverse.com/study-tools/storacles/c/3/l/french">
                Amazing Facts
              </InlineLink>
            </Trans>
          </Paragraph>
          <Text mt={20} fontSize={24} title>
            {t('Questions fréquentes')}
          </Text>
        </Box>
        <Box px={20}>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t("Qu'est-ce que la chronologie biblique ?")}
              </Text>
            }
          >
            <Paragraph m={20} scale={-1}>
              {`Avec plus de 850 entrées interconnectées, la chronologie des prophéties de la Bible est un outil d'étude complet qui vous permet d'explorer chaque personnage et événement majeur de la Bible, de la création du monde aux prophéties des derniers jours. Chaque entrée de la Chronologie contient un article bref mais perspicace avec des faits intéressants sur la personne ou l'événement, ainsi que des illustrations et des références bibliques complètes et des passages pour vous aider à le trouver dans la Bible.

Dans la mesure du possible, les entrées comprennent également des liens vers des personnages et des événements connexes et une présentation vidéo pour vous aider à approfondir votre compréhension de leur place dans l'histoire de la Bible.

La chronologie est divisée en trois grandes sections :

* ÂGE DES PATRIARCHES-CRÉATION VERS 1660 AVANT J.-C.

La chronologie commence avec Adam en Eden, puis avec Noé et le déluge et la naissance d'Israël par Abraham, Isaac et Jacob.

* AGE OF ISRAEL-C. 1660 AVANT J.-C. À 457 AVANT J.-C.

Couvre l'histoire de la nation juive, de Moïse et de l'Exode au roi David et aux prophètes Daniel et Isaïe.

* ÂGE DE CHRIST-C. 4 AV. J.-C. À 1840
Couvre la vie, la mort et la résurrection de Jésus, les apôtres, la Réforme et les derniers événements de l'histoire de la terre.

Chacune de ces sections est divisée en périodes plus spécifiques pour faciliter l'étude.`}
            </Paragraph>
          </Accordion>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t(
                  'Comment avez-vous déterminé les dates, en particulier la date de création ?'
                )}
              </Text>
            }
          >
            <Paragraph m={20} scale={-1}>
              {`Nous croyons que la Bible est la Parole inspirée de Dieu, et que notre principale source pour la datation des événements et des personnes dans la chronologie de la prophétie biblique sont les généalogies de la Bible et les comparaisons d'événement à événement que l'on trouve dans d'autres sources non bibliques traditionnellement acceptées, telles que les archives historiques anciennes de Josèphe et les études modernes des théologiens et des éducateurs professionnels. Pour cette chronologie, nous nous sommes appuyés sur le texte masorétique, sur lequel sont basées les Bibles anglaises.

Nous pensons que la chronologie de la prophétie biblique fournit la datation la plus précise disponible, mais de nombreuses dates sont encore sujettes à interprétation et à quelques suppositions éclairées en raison de quelques zones vagues dans l'histoire de la Bible. Comme pour tout arbre généalogique, plus on remonte dans le temps, plus les choses peuvent devenir floues.

Dans la Bible, les durées sont généralement enregistrées en fonction de l'âge des gens, des événements et des règnes des rois. En supposant qu'Adam a été créé en l'an 0, nous supposerons que son fils Seth est né en l'an 130 après la création - ou 130 après JC.

(Cette présomption fait qu'il est imprudent d'être dogmatique quant à l'année exacte de la création. En outre, comme la Bible ne nous indique pas le mois et le jour de chaque naissance, il y a un risque d'erreur pouvant aller jusqu'à 364 jours dans ces calculs chaque fois qu'une nouvelle naissance est mentionnée).

Le chapitre 5 de la Genèse se termine par l'affirmation suivante : "après que Noé eut eu 500 ans, il devint le père de Sem, de Cham et de Japhet". Genèse 9:24 nous dit que Cham était le plus jeune fils de Noé. Genèse 11:10 nous dit que Sem avait 100 ans deux ans après le Déluge, ce qui signifie qu'il a dû naître quand Noé avait 502 ans. Nous concluons que Japhet était le fils né lorsque Noé avait 500 ans, Sem deux ans plus tard, et Cham une période non précisée après cela.


Le prochain point d'intérêt est la date de la mort de Sem. À l'exception d'Eber, aucun des descendants de Shem ne lui a survécu.

Avec Jacob, la progression ordonnée des pères et des fils prend fin. On ne nous dit pas quel âge il avait lorsqu'il s'est enfui à Haran, ni quel âge il avait à la naissance de ses enfants. Il est cependant possible de savoir quand Joseph est né.

On nous dit que Joseph avait 30 ans lorsqu'il a été nommé sur le pays d'Égypte (Genèse 41:46). Il s'ensuivit sept années d'abondance et, la deuxième année de la famine, Joseph se révéla à ses frères (Genèse 45:6), ce qui lui fera environ 39 ans. Jacob descendit en Égypte à l'âge de 130 ans (Genèse 47:9), ce qui signifie que Joseph naquit à l'âge de 91 ans, c'est-à-dire en 2199 AC.

Comme la plupart des membres de la famille de Jacob semblent être nés pendant les 20 années où il était à Haran, il semble que les jumeaux Jacob et Esaü avaient environ 70 ans lorsque la tromperie sur le droit de naissance s'est produite. Nous supposons donc que Jacob avait 71 ans lorsqu'il s'est enfui à Haran. Il a servi Laban pendant sept ans avant de se marier, et Levi était le troisième fils à naître de Léa. Si nous supposons que Leah était enceinte une fois par an, alors Jacob avait 81 ans lorsque Levi est né. Si Joseph est né vers 2199 AC, son frère aîné Levi doit être né vers 2189 AC.

Ensuite, Dieu a dit à Abraham que ses descendants seraient asservis pendant 400 ans ou quatre générations (Genèse 15:13). Cela semble être confirmé par la déclaration dans Exode 12:40, 41 que les enfants d'Israël ont été en Egypte pendant 430 ans. Si Jacob est allé en Égypte en l'an 2238 de notre ère, cela situerait l'Exode en l'an 2668 de notre ère.

Il y a cependant un problème. Comme indiqué dans le chapitre 6 de l'Exode, Lévi, qui a vécu 137 ans, avait un fils appelé Kohath, qui a vécu 133 ans, et une fille, Jochebed. Amram, fils de Kohath, a épousé sa tante Jochebed, et a vécu pendant 137 ans. Leur fils s'appelait Moïse. Cela fait un total de 407 ans, et si l'on ajoute l'âge de 80 ans de Moïse au moment de l'Exode, il semble que nous ayons largement le temps de nous adapter aux 430 ans d'oppression.

Le problème, c'est que les années ne s'additionnent pas comme ça. L'âge moyen des quatre générations précédentes à la naissance de leur premier fils était de 75 ans. Si Levi, Kohath et Amram avaient également 75 ans à la naissance de leurs fils - et Moïse en avait 80 au moment de l'Exode - cela fait une période de 305 ans pour l'oppression juive, moins l'âge de Levi lorsqu'il est descendu en Égypte, qui était de 49 ans. L'oppression ne peut avoir duré que 256 ans.

La solution habituelle adoptée par la plupart des commentateurs est de conclure que les 430 ans ne se réfèrent pas à l'oppression mais au temps qu'Abraham et ses descendants auraient dû attendre jusqu'à ce que la terre de Canaan leur appartienne. Les 430 ans sont le temps qui s'écoule entre la visite d'Abraham en Égypte et l'Exode. Cela correspond à environ 215 ans d'errance en Canaan et 215 ans d'oppression en Égypte.

Il y a des preuves que c'est ainsi que les Juifs ont compris ce passage. Josèphe, l'historien juif du 1er siècle après J.-C., a écrit : "Ils ont quitté l'Égypte au mois de Xanthique, le quinzième jour du mois lunaire ; quatre cent trente ans après que notre ancêtre Abraham soit venu en Canaan, mais deux cent quinze ans seulement après que Jacob se soit retiré en Égypte" (Antiquités des Juifs II:xv:2). Un fragment de rouleau de la mer Morte (4Q559) confirme Traduit avec www.DeepL.com/Translator (version gratuite)`}
            </Paragraph>
          </Accordion>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t(
                  'Quelles sont vos principales sources pour la chronologie ?'
                )}
              </Text>
            }
          >
            <Paragraph m={20} scale={-1}>
              {`${t(
                'Voici une liste des sources utilisées, entre autres, pour créer la chronologie'
              )} :

* Adam Clarke’s Commentary on the Whole Bible, 1826.
* Bainton, Roland H. _Here I Stand: A Life of Martin Luther._ New York: Abingdon Press, 1950.
* Bokenkotter, Thomas. _A Concise History of the Catholic Church._ New York: Double Day, 2005.
* Cannon, William R. _History of Christianity in the Middle Ages: From the Fall of Rome to the Fall of Constantinople._ New York: Abingdon Press, 1960.
* Courvoisier, Jaques. Zwingli: _A Reformed Theologian_. Richmond: John Knox Press, 1963.
* Easton’s Bible Dictionary, 1897.
* González, Justo L. _The Story of Christianity, Vol. 1: The Early Church to the Dawn of the Reformation._ New York: HarperOne, 2010.
* González, Justo L. _The Story of Christianity, Vol. 2: The Reformation to the Present Day._ New York: HarperOne, 2010.
* Heinze, Rudolph, W. _Reform and Conflict: From the Medieval World to the Wars of Religion, A.D. 1350-1648_, consulting editors John D. Woodbridge and David F. Wright, series editor Tim Dowley. Grand Rapids: Baker, 2005.
* House, H. Wayne, _Chronological and Background Charts of the New Testament,_ Zondervan 2009.
* Kelly, J.N.D. _The Oxford Dictionary of Popes. New York: Oxford University Press_, 1986.
* Keith Stokes _Bible Timeline Database_, www.brainsanctuary.com
* Lane, Tony. _A Concise History of Christian Thought: Completely Revised and Expanded Edition_. Grand Rapids: Baker Academic, 2006.
* Lindsay, Thomas M. _A History of the Reformation, Vol. 2: In Lands Beyond Germany._ Edinburgh: T & T Clark, 1959.
* Logan, Donald F. _A History of the Church in the Middle Ages._ Oxford: Routledge, 2002.
* Matthew Henry’s Concise Commentary on the Bible, 1706.
* Price, Ira Maurice. _The Ancestry of Our English Bible._ New York: Harper & Row, 1956.
* Schwiebert, _E. G. Luther and His Times: The Reformation from a New Perspective,_ Saint Louis: Concordia, 1950.
* SDA Bible Commentary Reference Series. Review and Herald Publishing Association: Hagerstown, Maryland, 1979.
* Tenney, Merril C., _New Testament Times_, Hendrickson Publishers 2001.
* Andrews University Study Bible, Andrews University Press: Berrien Springs, Michigan, 2007.
* Walton, John H. _Chronological and Background Charts of the Old Testament,_ Zondervan, 1994.
         
          `}
            </Paragraph>
          </Accordion>
          <Accordion
            title={
              <Text title fontSize={18}>
                {t('Prévoyez-vous la date du retour du Christ ?')}
              </Text>
            }
          >
            <Paragraph m={20} scale={-1}>
              {t(
                "Non. La Bible dit que quant au jour et à l'heure du retour du Christ, personne ne le sait. Voir Matthieu 24;50. De plus, le retour du Christ ne viendra qu'après que d'autres accomplissements prophétiques se soient produits - et nous ne savons pas non plus quand ils se produiront. L'objectif de la ligne du temps n'est pas de prédire quand exactement les événements futurs se produiront, mais plutôt de montrer la fiabilité de la Bible en tant que document historique, sa fiabilité en matière de prophétie et en tant qu'outil d'étude approfondie de la Bible."
              )}
            </Paragraph>
          </Accordion>
        </Box>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default TimelineHomeDetailModal
