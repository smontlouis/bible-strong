import styled from '@emotion/styled'
import Head from 'next/head'

const TextContainer = styled.div(({ theme }) => ({
  marginTop: 100,
  maxWidth: 500,
  margin: '20px auto',

  h1: {
    margin: '40px 0',
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes['4xl'],
    fontWeight: 'bold',
  },

  h2: {
    margin: '20px 0',
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes['2xl'],
    fontWeight: 'bold',
  },

  hr: {
    margin: '20px 0',
  },

  ul: {
    padding: 20,
  },
}))

export default function Page() {
  return (
    <div
      style={{
        backgroundImage: `url(/images/background.jpg)`,
        backgroundSize: 'contain',
        backgroundPosition: 'right',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        marginBottom: '50px',
        padding: '0 20px',
      }}
    >
      <Head>
        <title>Politique de confidentialité - Bible Strong App</title>
      </Head>
      <TextContainer>
        <h1>Politique mod&egrave;le de confidentialit&eacute;.</h1>
        <p>
          <strong>Introduction</strong>
          <br />
          Devant le d&eacute;veloppement des nouveaux outils de communication,
          il est n&eacute;cessaire de porter une attention particuli&egrave;re
          &agrave; la protection de la vie priv&eacute;e. C'est pourquoi, Bible
          Strong App s'engage &agrave; respecter la confidentialit&eacute; des
          renseignements personnels collectés. Bible Strong App est une
          application développée par Stéphane Montlouis-Calixte.
        </p>
        <hr />
        <h2>Collecte des renseignements personnels</h2>
        <p>Bible Strong App collecte les renseignements suivants :</p>
        <ul>
          <li>Nom</li>
          <li>Pr&eacute;nom</li>
          <li>Adresse &eacute;lectronique</li>
        </ul>

        <p>
          Les renseignements personnels que Bible Strong App collecte sont
          recueillis au travers de formulaires et gr&acirc;ce &agrave;
          l'interactivit&eacute; &eacute;tablie entre vous et notre application.
          Bible Strong App utilise &eacute;galement, comme indiqu&eacute; dans
          la section suivante, des fichiers t&eacute;moins et/ou journaux pour
          r&eacute;unir des informations vous concernant.
        </p>
        <hr />
        <h2>Formulaires&nbsp; et interactivit&eacute;:</h2>
        <p>
          Vos renseignements personnels sont collect&eacute;s par le biais de
          formulaire, &agrave; savoir :
        </p>
        <ul>
          <li>Formulaire d'inscription à l'application</li>
        </ul>
        <p>
          Bible Strong App utilise les renseignements ainsi collect&eacute;s
          pour les finalit&eacute;s suivantes :
        </p>
        <ul>
          <li>Statistiques</li>
          <li>Gestion de l'application (pr&eacute;sentation, organisation)</li>
        </ul>
        <p>
          Vos renseignements sont &eacute;galement collect&eacute;s par le biais
          de l'interactivit&eacute; pouvant s'&eacute;tablir entre vous et notre
          application et ce, de la fa&ccedil;on suivante:
        </p>
        <ul></ul>
        <p>
          Bible Strong App utilise les renseignements ainsi collect&eacute;s
          pour les finalit&eacute;s suivantes :<br />
        </p>
        <ul></ul>
        <hr />
        <h2>Fichiers journaux et t&eacute;moins </h2>
        <p>
          Bible Strong App recueille certaines informations par le biais de
          fichiers journaux (log file) et de fichiers t&eacute;moins (cookies).
          Il s'agit principalement des informations suivantes :
        </p>
        <ul>
          <li>Adresse IP</li>
          <li>Syst&egrave;me d'exploitation</li>
          <li>Pages visit&eacute;es et requ&ecirc;tes</li>
          <li>Heure et jour de connexion</li>
        </ul>

        <br />
        <p>Le recours &agrave; de tels fichiers nous permet :</p>
        <ul>
          <li>Am&eacute;lioration du service et accueil personnalis&eacute;</li>
          <li>Statistique</li>
        </ul>
        <hr />
        <h2>Droit d'opposition et de retrait</h2>
        <p>
          Bible Strong App s'engage &agrave; vous offrir un droit d'opposition
          et de retrait quant &agrave; vos renseignements personnels.
          <br />
          Le droit d'opposition s'entend comme &eacute;tant la possiblit&eacute;
          offerte aux internautes de refuser que leurs renseignements personnels
          soient utilis&eacute;es &agrave; certaines fins mentionn&eacute;es
          lors de la collecte.
          <br />
        </p>
        <p>
          Le droit de retrait s'entend comme &eacute;tant la possiblit&eacute;
          offerte aux internautes de demander &agrave; ce que leurs
          renseignements personnels ne figurent plus, par exemple, dans une
          liste de diffusion.
          <br />
        </p>
        <p>
          Pour pouvoir exercer ces droits, vous pouvez : <br />
          Code postal : 105, hillcrest road, raumati beach 5032
          <br /> Courriel : s.montlouis.calixte@gmail.com
          <br /> T&eacute;l&eacute;phone : 0272539320
          <br />{' '}
        </p>
        <hr />
        <h2>Droit d'acc&egrave;s</h2>
        <p>
          Bible Strong App s'engage &agrave; reconna&icirc;tre un droit
          d'acc&egrave;s et de rectification aux personnes concern&eacute;es
          d&eacute;sireuses de consulter, modifier, voire radier les
          informations les concernant.
          <br />
          L'exercice de ce droit se fera :<br />
          Code postal : 105, hillcrest road, raumati beach 5032
          <br /> Courriel : s.montlouis.calixte@gmail.com
          <br /> T&eacute;l&eacute;phone : 0272539320
          <br />{' '}
        </p>
        <hr />
        <h2>S&eacute;curit&eacute;</h2>
        <p>
          Les renseignements personnels que Bible Strong App collecte sont
          conserv&eacute;s dans un environnement s&eacute;curis&eacute;. Les
          personnes travaillant pour Bible Strong App sont tenues de respecter
          la confidentialit&eacute; de vos informations.
          <br />
          Pour assurer la s&eacute;curit&eacute; de vos renseignements
          personnels, Bible Strong App a recours aux mesures suivantes :
        </p>
        <ul>
          <li>Gestion des acc&egrave;s - personne autoris&eacute;e</li>
          <li>Gestion des acc&egrave;s - personne concern&eacute;e</li>
          <li>Sauvegarde informatique</li>
          <li>Identifiant / mot de passe</li>
        </ul>

        <p>
          Bible Strong App s'engage &agrave; maintenir un haut degr&eacute; de
          confidentialit&eacute; en int&eacute;grant les derni&egrave;res
          innovations technologiques permettant d'assurer la
          confidentialit&eacute; de vos transactions. Toutefois, comme aucun
          m&eacute;canisme n'offre une s&eacute;curit&eacute; maximale, une part
          de risque est toujours pr&eacute;sente lorsque l'on utilise Internet
          pour transmettre des renseignements personnels.
        </p>
      </TextContainer>
    </div>
  )
}
