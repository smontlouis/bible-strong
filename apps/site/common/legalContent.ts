import type { Locale } from '../locales'

export type LegalDocumentContent = {
  title: string
  introduction: string
  sections: {
    id: string
    title: string
    paragraphs: string[]
    items?: string[]
    links?: { label: string; href: string }[]
  }[]
}

export const privacyContent: Record<Locale, LegalDocumentContent> = {
  fr: {
    title: 'Politique de confidentialité',
    introduction: 'Cette politique décrit les traitements liés au site Bible Strong, à l’application mobile et à l’application web. Le Studio 316 est le responsable du traitement. Les données utilisées dépendent des fonctionnalités que vous utilisez et de votre connexion à un compte.',
    sections: [
      {
        id: 'account', title: 'Compte et données d’étude',
        paragraphs: ['La création d’un compte permet de retrouver vos données synchronisées. Selon votre mode de connexion, nous traitons votre identifiant de compte, votre adresse e-mail, son statut de vérification, votre nom d’affichage, votre photo de profil et le fournisseur de connexion. L’authentification est assurée par Google Firebase.', 'Les notes, surlignages, annotations, favoris, étiquettes, liens, études et paramètres d’espace de travail associés au compte peuvent être enregistrés et synchronisés. Les données créées sans compte restent dans le stockage local ; elles peuvent être rattachées à un nouveau compte lors de sa création. Les ressources bibliques téléchargées sont également conservées sur votre appareil.'],
      },
      {
        id: 'sharing', title: 'Études publiées et partage',
        paragraphs: ['Lorsque vous publiez une étude, son contenu et les informations d’auteur associées deviennent accessibles sur une page publique. Toute personne disposant du lien peut les consulter et les partager. Évitez d’y inclure des informations privées concernant vous-même ou d’autres personnes.', 'Dépublier une étude retire son accès public dans Bible Strong. Cela ne supprime pas les copies ou exports déjà enregistrés par des tiers. La suppression du compte déclenche aussi la suppression de ses études, privées ou publiées, et de leurs aperçus hébergés par Bible Strong.'],
      },
      {
        id: 'search', title: 'Recherches et statistiques de recherche',
        paragraphs: ['Une recherche en ligne transmet sa formulation au service de recherche afin de trouver des ressources. La recherche sémantique peut faire traiter cette formulation par Cloudflare Workers AI pour en calculer une représentation numérique.', 'Un dispositif distinct mesure les recherches dans les ressources bibliques et le premier résultat ouvert. Il enregistre notamment la formulation recherchée, la langue, les sources interrogées et le nombre de résultats, sans identifiant de compte, d’installation, d’appareil ou de session dans ces événements. Les adresses e-mail, numéros de téléphone, URL et certains secrets reconnaissables sont masqués avant leur enregistrement ; ce filtrage ne garantit pas la suppression de toute information personnelle saisie librement.', 'Les recherches limitées aux notes, études et liens personnels sont exclues de ces statistiques. Les recherches hors ligne ne sont pas enregistrées dans ce dispositif. Évitez de saisir des informations personnelles dans une recherche de ressources.'],
      },
      {
        id: 'analytics', title: 'Mesure d’utilisation et diagnostic',
        paragraphs: ['L’application utilise Google Analytics pour Firebase pour mesurer des événements tels que la connexion, l’inscription, la création de notes, la progression de lecture et l’ouverture d’écrans. Ces événements peuvent être associés à l’identifiant de votre compte. Les événements de création de notes mesurent un nombre, pas leur texte. Cette mesure est distincte des statistiques de recherche décrites plus haut.', 'Sentry reçoit des rapports d’erreur et des informations techniques sur le fonctionnement de l’application. Ces rapports peuvent être associés à votre identifiant et à votre adresse e-mail ; sur le web, des informations de profil peuvent également être jointes. Les services d’hébergement et de sécurité traitent aussi les informations nécessaires aux connexions, telles que l’adresse IP, le navigateur, les horaires et les requêtes.', 'Le site de présentation ne charge pas Google Analytics. L’application web, les services de paiement et les contenus tiers ont leurs propres traitements décrits dans cette politique.'],
      },
      {
        id: 'assistant', title: 'Assistant d’étude IA',
        paragraphs: ['L’assistant utilise Gloo AI pour acheminer les requêtes vers les modèles d’intelligence artificielle utilisés par le service. Gloo et les fournisseurs des modèles sollicités reçoivent les éléments nécessaires à la génération des réponses.', 'Lorsque cette fonctionnalité est disponible et que vous envoyez une question, votre message, l’historique nécessaire à la conversation et le contexte de lecture joint sont transmis à un service distant authentifié pour produire une réponse. Le contexte peut contenir une référence biblique ou des extraits de la ressource éditoriale ouverte. Un historique long peut aussi être transmis pour en produire un résumé.', 'Dans l’application web, les conversations et leurs résumés sont conservés dans le navigateur, séparément pour chaque compte. Ils ne sont pas synchronisés entre vos appareils par cette fonction. Ce stockage local ne signifie pas que le traitement par l’IA s’effectue uniquement sur votre appareil.', 'N’incluez pas de mots de passe, de secrets ou de données personnelles concernant des tiers. La suppression d’une conversation dans le navigateur efface sa copie locale ; elle ne constitue pas une demande d’effacement auprès du service distant. Pour une demande portant sur les données transmises, contactez Le Studio 316.'],
      },
      {
        id: 'payments', title: 'Soutien financier et services externes',
        paragraphs: ['La page de soutien utilise Stripe pour les paiements. L’application propose également un lien vers PayPal. Le prestataire choisi traite les informations nécessaires à votre paiement selon ses propres conditions et sa politique de confidentialité. Ne nous envoyez jamais de numéro de carte bancaire par e-mail.', 'L’ouverture de liens, de vidéos ou de contenus hébergés par des tiers peut leur transmettre des informations de connexion. Leurs règles de confidentialité s’appliquent à leurs propres services.'],
      },
      {
        id: 'purposes', title: 'Pourquoi ces données sont utilisées',
        paragraphs: ['La gestion du compte, la synchronisation et l’exécution de vos demandes servent à fournir les fonctionnalités demandées. La sécurité, la prévention des abus et la résolution des incidents servent à maintenir le service. Les statistiques servent à comprendre son utilisation et à améliorer la recherche.', 'L’exécution du service demandé, les obligations légales, l’intérêt légitime à sécuriser le service et, pour les traitements qui l’exigent, le consentement constituent des fondements distincts. L’acceptation des conditions d’utilisation ou la lecture de cette politique ne vaut pas consentement à des traceurs non nécessaires.', 'Des notes, études ou messages peuvent révéler des convictions religieuses ou d’autres informations sensibles. Ne partagez que les informations nécessaires. Un traitement de données sensibles exige une condition supplémentaire prévue par le droit applicable ; la seule création d’un compte ne constitue pas un consentement explicite à tous les usages de ces données.'],
      },
      {
        id: 'providers', title: 'Qui peut recevoir les données',
        paragraphs: ['Le Studio 316 et les prestataires nécessaires aux fonctions utilisées peuvent recevoir les données correspondantes : Google Firebase pour le compte, la synchronisation, la mesure d’utilisation et la protection contre les abus ; Sentry pour les erreurs ; Cloudflare pour la distribution des ressources, les services de recherche et leurs statistiques ; Vercel pour l’hébergement du site public ; les prestataires de paiement et, lors de l’utilisation de l’assistant, Gloo et les fournisseurs de modèles sollicités pour le traitement IA.', 'Sur l’application web, Firebase App Check utilise reCAPTCHA Enterprise pour protéger les accès aux ressources contre les abus. Certains prestataires peuvent traiter des données hors de l’Espace économique européen. Vous pouvez nous demander des précisions sur les destinataires, lieux de traitement et garanties applicables à votre utilisation.'],
        links: [
          { label: 'Confidentialité et sécurité de Firebase', href: 'https://firebase.google.com/support/privacy' },
          { label: 'Confidentialité de Google', href: 'https://policies.google.com/privacy' },
          { label: 'Confidentialité de Sentry', href: 'https://sentry.io/privacy/' },
          { label: 'Confidentialité de Cloudflare', href: 'https://www.cloudflare.com/privacypolicy/' },
          { label: 'Confidentialité de Vercel', href: 'https://vercel.com/legal/privacy-notice' },
          { label: 'Conditions de Gloo AI Studio', href: 'https://gloo.com/legal/ai-studio-supplemental-terms-of-service' },
          { label: 'Protection des données chez Gloo', href: 'https://gloo.com/legal/data-processing-agreement' },
          { label: 'Confidentialité de Stripe', href: 'https://stripe.com/privacy' },
          { label: 'Confidentialité de PayPal', href: 'https://www.paypal.com/fr/legalhub/paypal/privacy-full' },
        ],
      },
      {
        id: 'storage', title: 'Stockage local, cookies et conservation',
        paragraphs: ['Le stockage de l’appareil ou du navigateur permet de conserver la connexion, les préférences, les données de travail, les ressources téléchargées et l’historique local de l’assistant. Vous pouvez effacer les données du site dans votre navigateur ou les données de l’application sur votre appareil. Cela peut supprimer des données non synchronisées et ne supprime pas votre compte distant.', 'Les données du compte sont conservées pour permettre son utilisation et sa synchronisation jusqu’à leur suppression. Les études privées et publiées sont également supprimées lors de la suppression du compte. Les historiques locaux restent dans le navigateur jusqu’à leur suppression. Les limites de stockage peuvent empêcher l’enregistrement de nouveaux échanges ; elles ne constituent pas une durée d’expiration.', 'Les journaux techniques, statistiques, sauvegardes et données détenues par les prestataires suivent des durées propres aux services et à leurs finalités. Les éléments nécessaires à une obligation légale ou à la gestion d’un litige peuvent devoir être conservés séparément. Contactez-nous pour connaître les durées applicables à une catégorie de données ou demander sa suppression.'],
      },
      {
        id: 'rights', title: 'Vos droits et vos demandes',
        paragraphs: ['Vous pouvez demander l’accès à vos données, leur rectification ou leur effacement, ainsi que, lorsque les conditions sont réunies, leur portabilité, la limitation du traitement ou vous opposer à celui-ci. Lorsqu’un traitement repose sur votre consentement, vous pouvez le retirer pour l’avenir.', 'Écrivez à stephane@lestudio316.com, de préférence depuis l’adresse de votre compte, en précisant votre demande. Une vérification proportionnée de votre identité peut être nécessaire. Ne transmettez pas votre mot de passe. Nous répondons en principe sous un mois ; une prolongation motivée de deux mois supplémentaires est possible dans les cas prévus par le RGPD, avec information dans le premier mois.', 'Vous pouvez également adresser une réclamation à la CNIL ou à votre autorité de protection des données compétente.'],
        links: [
          { label: 'Supprimer un compte, une étude ou des données locales', href: '/fr/data-deletion' },
          { label: 'Exercer vos droits auprès de la CNIL', href: 'https://www.cnil.fr/fr/plaintes' },
        ],
      },
      {
        id: 'changes', title: 'Évolution de cette politique',
        paragraphs: ['Cette page indique la date de révision du texte. Les évolutions des fonctionnalités ou des traitements peuvent nécessiter sa mise à jour. Une modification de cette politique ne remplace pas le recueil d’un consentement lorsqu’il est nécessaire.'],
      },
    ],
  },
  en: {
    title: 'Privacy policy',
    introduction: 'This policy describes processing associated with the Bible Strong website, mobile application and web application. Le Studio 316 is the data controller. The data used depends on the features you use and whether you sign in to an account.',
    sections: [
      {
        id: 'account', title: 'Account and study data',
        paragraphs: ['An account lets you access your synchronized data. Depending on your sign-in method, we process your account identifier, email address, verification status, display name, profile picture and sign-in provider. Google Firebase handles authentication.', 'Notes, highlights, annotations, bookmarks, tags, links, studies and workspace settings associated with your account may be stored and synchronized. Data created without an account stays in local storage; it may be associated with a new account when you create one. Downloaded Bible resources are also stored on your device.'],
      },
      {
        id: 'sharing', title: 'Published studies and sharing',
        paragraphs: ['When you publish a study, its content and associated author information become accessible on a public page. Anyone with the link can view and share them. Avoid including private information about yourself or others.', 'Unpublishing removes public access to the study within Bible Strong. It does not remove copies or exports already saved by others. Deleting your account also triggers deletion of its private and published studies and their previews hosted by Bible Strong.'],
      },
      {
        id: 'search', title: 'Searches and search statistics',
        paragraphs: ['Online search sends your query to the search service to find resources. Semantic search may send the query to Cloudflare Workers AI to compute a numerical text representation.', 'A separate system measures searches in Bible resources and the first result opened. It records information including the query, language, searched sources and result counts, without account, installation, device or session identifiers in those events. Recognizable email addresses, telephone numbers, URLs and some secrets are masked before storage; this filtering cannot guarantee removal of every piece of personal information entered as free text.', 'Searches limited to personal notes, studies and links are excluded from these statistics. Offline searches are not recorded in this system. Avoid entering personal information when searching resources.'],
      },
      {
        id: 'analytics', title: 'Usage measurement and diagnostics',
        paragraphs: ['The application uses Google Analytics for Firebase to measure events such as sign-in, registration, note creation, reading progress and screen views. These events may be associated with your account identifier. Note-creation events measure a count, not note text. This measurement is separate from the search statistics described above.', 'Sentry receives error reports and technical information about the application. Reports may be associated with your identifier and email address; on the web, profile information may also be included. Hosting and security services also process information needed for connections, such as IP addresses, browsers, request times and requests.', 'The presentation website does not load Google Analytics. The web application, payment services and third-party content have their own processing described in this policy.'],
      },
      {
        id: 'assistant', title: 'AI study assistant',
        paragraphs: ['The assistant uses Gloo AI to route requests to the artificial intelligence models used by the service. Gloo and the providers of the models invoked receive the information needed to generate responses.', 'When this feature is available and you send a question, your message, the conversation history needed for the exchange and the attached reading context are sent to an authenticated remote service to generate a response. The context may contain a Bible reference or excerpts from the editorial resource you have open. A long conversation history may also be sent for summarization.', 'In the web application, conversations and their summaries are stored in the browser, separately for each account. This feature does not synchronize them between devices. Local storage does not mean that AI processing happens only on your device.', 'Do not include passwords, secrets or personal information about others. Deleting a conversation in the browser removes its local copy; it does not submit an erasure request to the remote service. Contact Le Studio 316 for requests concerning data you have sent.'],
      },
      {
        id: 'payments', title: 'Financial support and external services',
        paragraphs: ['The support page uses Stripe for payments. The application also provides a PayPal link. Your chosen provider processes the information needed for payment under its own terms and privacy policy. Never send us a card number by email.', 'Opening links, videos or content hosted by third parties may send connection information to them. Their privacy rules apply to their own services.'],
      },
      {
        id: 'purposes', title: 'Why the data is used',
        paragraphs: ['Account management, synchronization and handling your requests provide the features you ask for. Security, abuse prevention and incident resolution keep the service operational. Statistics help us understand usage and improve search.', 'Performance of the requested service, legal obligations, legitimate interests in securing the service and consent where required are distinct grounds for processing. Accepting the terms of use or reading this policy does not constitute consent to non-essential trackers.', 'Notes, studies or messages may reveal religious beliefs or other sensitive information. Share only what is necessary. Processing sensitive data requires an additional condition under applicable law; creating an account alone does not constitute explicit consent to every use of that data.'],
      },
      {
        id: 'providers', title: 'Who may receive data',
        paragraphs: ['Le Studio 316 and the providers needed for the features you use may receive the corresponding data: Google Firebase for accounts, synchronization, usage measurement and abuse protection; Sentry for errors; Cloudflare for resource delivery, search services and their statistics; Vercel for hosting the public website; payment providers; and Gloo and the model providers invoked when you use the assistant.', 'In the web application, Firebase App Check uses reCAPTCHA Enterprise to protect resource access against abuse. Some providers may process data outside the European Economic Area. You can ask us about recipients, processing locations and safeguards applicable to your use.'],
        links: [
          { label: 'Firebase privacy and security', href: 'https://firebase.google.com/support/privacy' },
          { label: 'Google privacy policy', href: 'https://policies.google.com/privacy' },
          { label: 'Sentry privacy policy', href: 'https://sentry.io/privacy/' },
          { label: 'Cloudflare privacy policy', href: 'https://www.cloudflare.com/privacypolicy/' },
          { label: 'Vercel privacy notice', href: 'https://vercel.com/legal/privacy-notice' },
          { label: 'Gloo AI Studio terms', href: 'https://gloo.com/legal/ai-studio-supplemental-terms-of-service' },
          { label: 'Gloo data processing agreement', href: 'https://gloo.com/legal/data-processing-agreement' },
          { label: 'Stripe privacy policy', href: 'https://stripe.com/privacy' },
          { label: 'PayPal privacy policy', href: 'https://www.paypal.com/us/legalhub/paypal/privacy-full' },
        ],
      },
      {
        id: 'storage', title: 'Local storage, cookies and retention',
        paragraphs: ['Device or browser storage maintains your session, preferences, working data, downloaded resources and local assistant history. You can clear site data in your browser or application data on your device. This may delete unsynchronized data and does not delete your remote account.', 'Account data is retained to support account use and synchronization until deletion. Private and published studies are also deleted when the account is deleted. Local histories remain in the browser until deleted. Storage limits can prevent new exchanges from being saved; they are not an expiration period.', 'Technical logs, statistics, backups and data held by providers have retention periods specific to their services and purposes. Information needed for a legal obligation or dispute may need to be retained separately. Contact us for the retention period applicable to a category of data or to request its deletion.'],
      },
      {
        id: 'rights', title: 'Your rights and requests',
        paragraphs: ['You can request access, correction or erasure of your data and, where the conditions are met, portability, restriction of processing or object to processing. Where processing relies on consent, you can withdraw it for the future.', 'Write to stephane@lestudio316.com, preferably from your account email address, explaining your request. A proportionate identity check may be needed. Do not send your password. We normally respond within one month; the GDPR permits a justified extension of two further months in certain cases, with notice during the first month.', 'You may also complain to the CNIL or your competent data protection authority.'],
        links: [
          { label: 'Delete an account, study or local data', href: '/data-deletion' },
          { label: 'Contact the CNIL', href: 'https://www.cnil.fr/en' },
        ],
      },
      {
        id: 'changes', title: 'Policy updates',
        paragraphs: ['This page shows the text revision date. Changes to features or processing may require updates. Updating this policy does not replace obtaining consent where required.'],
      },
    ],
  },
}

export const termsContent: Record<Locale, LegalDocumentContent> = {
  fr: {
    title: 'Conditions d’utilisation',
    introduction: 'Ces conditions concernent le site, l’application mobile et l’application web Bible Strong, édités par Le Studio 316. Elles décrivent les règles d’accès aux outils de lecture, d’étude et de partage.',
    sections: [
      {
        id: 'service', title: 'Utilisation de Bible Strong',
        paragraphs: ['Bible Strong propose des ressources bibliques et des outils d’étude. Les fonctionnalités disponibles varient selon la plateforme, la connexion internet, les ressources installées et les éventuelles phases de test. Certaines fonctionnalités nécessitent un compte.', 'Utilisez le service conformément à la loi et aux droits des autres personnes. N’essayez pas d’accéder aux comptes d’autrui, de contourner les contrôles de sécurité ou de perturber les services. Les droits accordés par les licences libres et les exceptions légales restent applicables.'],
      },
      {
        id: 'account', title: 'Compte et données personnelles',
        paragraphs: ['Fournissez des informations de compte exactes, protégez vos moyens de connexion et signalez-nous un accès non autorisé. Vous pouvez demander la suppression de votre compte ou utiliser la commande prévue dans l’application.', 'La politique de confidentialité explique les données traitées. Accepter ces conditions ne vaut pas consentement à des traitements qui nécessitent un accord spécifique.'],
        links: [{ label: 'Politique de confidentialité', href: '/fr/politique-de-confidentialite' }, { label: 'Suppression des données', href: '/fr/data-deletion' }],
      },
      {
        id: 'resources', title: 'Droits sur les ressources et le logiciel',
        paragraphs: ['Les traductions bibliques, commentaires, dictionnaires, illustrations, contenus audio et autres ressources peuvent relever du domaine public ou de licences et autorisations propres à leurs ayants droit. Leur disponibilité dans Bible Strong n’accorde pas automatiquement le droit de les redistribuer ou de les exploiter commercialement.', 'Respectez les mentions de source et les conditions associées à chaque ressource. Les composants logiciels ouverts restent soumis à leurs licences respectives. Les présentes conditions ne retirent pas les droits accordés par ces licences.'],
      },
      {
        id: 'content', title: 'Vos notes et études partagées',
        paragraphs: ['Vous conservez vos droits sur les contenus que vous créez. Vous autorisez Le Studio 316 à les stocker et à les traiter dans la mesure nécessaire aux fonctionnalités que vous demandez, notamment la synchronisation. Si vous publiez une étude, cette autorisation comprend sa présentation et son partage sur une page publique.', 'Ne publiez que des contenus que vous êtes autorisé à partager. Respectez les droits d’auteur et la vie privée ; ne publiez pas de contenus illicites. Vous pouvez retirer une étude de la publication. Les copies déjà téléchargées ou réalisées par des tiers ne sont pas sous notre contrôle.', 'Pour signaler un contenu, écrivez à notre adresse de contact en indiquant son lien et les motifs du signalement. Un contenu contraire à la loi ou aux présentes conditions peut faire l’objet d’une restriction d’accès.'],
      },
      {
        id: 'assistant', title: 'Assistant d’étude IA',
        paragraphs: ['Lorsqu’il est proposé, l’assistant est un outil d’aide à l’étude. Ses réponses peuvent contenir des erreurs, des interprétations discutables ou des références inexactes. Vérifiez les citations et les sources avant de les réutiliser. Les réponses sont produites par un logiciel et ne constituent ni une parole divine ni une autorité doctrinale.', 'Vous choisissez les questions envoyées et pouvez vérifier le contexte de lecture joint. Évitez les informations personnelles sensibles et les informations concernant des tiers. La disponibilité, les quotas et les fonctions de l’assistant peuvent évoluer, notamment pendant une phase de test.'],
      },
      {
        id: 'support', title: 'Soutien financier et paiements',
        paragraphs: ['Les modalités d’un soutien financier, notamment son montant et son caractère ponctuel ou récurrent, sont présentées au moment du paiement. Les opérations effectuées auprès d’un prestataire ou d’une boutique d’applications sont également soumises à leurs conditions applicables.', 'Supprimer un compte Bible Strong ou désinstaller l’application ne résilie pas automatiquement un paiement récurrent. Gérez-le auprès du prestataire ou de la boutique utilisés. Aucun avantage fiscal ne doit être présumé du seul fait d’un soutien à Bible Strong.'],
      },
      {
        id: 'availability', title: 'Disponibilité et responsabilité',
        paragraphs: ['Nous pouvons faire évoluer le service, corriger des erreurs ou interrompre temporairement son accès pour maintenance ou sécurité. Une connexion internet est nécessaire aux fonctions en ligne ; les ressources installées localement dépendent du stockage de votre appareil.', 'Conservez une copie des contenus importants, notamment avant d’effacer les données locales. Nous ne garantissons pas l’absence de toute interruption ou erreur. Aucune disposition de ces conditions ne supprime les garanties légales ni ne limite une responsabilité qui ne peut pas être limitée par la loi.'],
      },
      {
        id: 'apple', title: 'Utilisation sur les appareils Apple',
        paragraphs: ['Pour l’application distribuée par Apple, l’accord est conclu avec Le Studio 316, non avec Apple. La licence d’utilisation est personnelle et non transférable, pour les appareils Apple que vous possédez ou contrôlez, selon les règles Apple, y compris leurs dispositions sur le partage familial et les achats en volume.', 'Le Studio 316 assure l’assistance et répond aux réclamations concernant le produit, les garanties applicables et les droits de propriété intellectuelle. Apple n’a pas d’obligation d’assistance. En cas de non-conformité à une garantie applicable, vous pouvez en informer Apple pour le remboursement du prix d’achat, selon les règles applicables ; les autres obligations de garantie relèvent de Le Studio 316.', 'Vous devez respecter les accords tiers applicables et les restrictions américaines relatives aux embargos et listes de personnes interdites. Apple et ses filiales sont tiers bénéficiaires et peuvent faire appliquer ces dispositions.'],
        links: [{ label: 'Conditions des services Apple', href: 'https://www.apple.com/legal/internet-services/itunes/' }],
      },
      {
        id: 'changes', title: 'Évolutions et contact',
        paragraphs: ['La date en haut de cette page indique sa dernière révision. Les conditions peuvent être adaptées aux évolutions du service ou du droit applicable. Pour une question ou une réclamation, contactez Le Studio 316 à stephane@lestudio316.com.', 'Les règles impératives protégeant les consommateurs restent applicables. Ces conditions n’imposent pas de renoncer à vos recours légaux.'],
      },
    ],
  },
  en: {
    title: 'Terms of use',
    introduction: 'These terms cover the Bible Strong website, mobile application and web application, published by Le Studio 316. They describe access to the reading, study and sharing tools.',
    sections: [
      {
        id: 'service', title: 'Using Bible Strong',
        paragraphs: ['Bible Strong provides Bible resources and study tools. Available features vary by platform, internet connection, installed resources and any testing phases. Some features require an account.', 'Use the service lawfully and respect other people’s rights. Do not access other people’s accounts, bypass security controls or disrupt services. Rights granted by open-source licences and statutory exceptions remain applicable.'],
      },
      {
        id: 'account', title: 'Accounts and personal data',
        paragraphs: ['Provide accurate account information, protect your sign-in credentials and notify us of unauthorized access. You can request account deletion or use the corresponding command in the application.', 'The privacy policy explains data processing. Accepting these terms does not constitute consent to processing that requires separate agreement.'],
        links: [{ label: 'Privacy policy', href: '/privacy-policy' }, { label: 'Data deletion', href: '/data-deletion' }],
      },
      {
        id: 'resources', title: 'Rights in resources and software',
        paragraphs: ['Bible translations, commentaries, dictionaries, illustrations, audio and other resources may be public domain or subject to licences and permissions from their rights holders. Availability in Bible Strong does not automatically grant permission to redistribute or commercially exploit them.', 'Respect source credits and the terms associated with each resource. Open-source software components remain subject to their respective licences. These terms do not remove rights granted by those licences.'],
      },
      {
        id: 'content', title: 'Your notes and shared studies',
        paragraphs: ['You retain your rights in content you create. You authorize Le Studio 316 to store and process it as needed for the features you request, including synchronization. If you publish a study, this authorization includes displaying and sharing it on a public page.', 'Only publish content you are authorized to share. Respect copyright and privacy; do not publish unlawful content. You can unpublish a study. Copies already downloaded or made by third parties are outside our control.', 'To report content, email our contact address with its link and the reasons for your report. Content that breaches the law or these terms may have its access restricted.'],
      },
      {
        id: 'assistant', title: 'AI study assistant',
        paragraphs: ['Where offered, the assistant is a study aid. Its responses may contain errors, disputed interpretations or incorrect references. Check quotations and sources before reusing them. Responses are produced by software and are neither divine speech nor doctrinal authority.', 'You choose the questions you send and can check the attached reading context. Avoid sensitive personal information and information about others. Assistant availability, quotas and features may change, especially during testing.'],
      },
      {
        id: 'support', title: 'Financial support and payments',
        paragraphs: ['The terms of financial support, including the amount and whether it is one-time or recurring, are presented at payment. Transactions through a payment provider or app store are also subject to its applicable terms.', 'Deleting a Bible Strong account or uninstalling the application does not automatically cancel recurring payments. Manage them with the provider or store you used. Supporting Bible Strong does not in itself imply eligibility for a tax benefit.'],
      },
      {
        id: 'availability', title: 'Availability and liability',
        paragraphs: ['We may update the service, fix errors or temporarily interrupt access for maintenance or security. Online features need an internet connection; locally installed resources depend on your device storage.', 'Keep a copy of important content, particularly before clearing local data. We do not guarantee the absence of every interruption or error. Nothing in these terms removes statutory warranties or limits liability that cannot lawfully be limited.'],
      },
      {
        id: 'apple', title: 'Use on Apple devices',
        paragraphs: ['For the application distributed by Apple, the agreement is with Le Studio 316, not Apple. The licence is personal and non-transferable, for Apple devices you own or control, under Apple’s usage rules, including Family Sharing and volume purchasing.', 'Le Studio 316 handles support and claims concerning the product, applicable warranties and intellectual property rights. Apple has no support obligation. If the application fails to meet an applicable warranty, you may notify Apple for a refund of the purchase price under the applicable rules; other warranty obligations rest with Le Studio 316.', 'You must comply with applicable third-party agreements and US restrictions on embargoed countries and prohibited parties. Apple and its subsidiaries are third-party beneficiaries entitled to enforce these provisions.'],
        links: [{ label: 'Apple Media Services terms', href: 'https://www.apple.com/legal/internet-services/itunes/' }],
      },
      {
        id: 'changes', title: 'Updates and contact',
        paragraphs: ['The date at the top of this page indicates its latest revision. Terms may be updated as the service or applicable law changes. For questions or complaints, contact Le Studio 316 at stephane@lestudio316.com.', 'Mandatory consumer protections remain applicable. These terms do not require you to waive legal remedies.'],
      },
    ],
  },
}

export const deletionContent: Record<Locale, LegalDocumentContent> = {
  fr: {
    title: 'Supprimer mon compte et mes données',
    introduction: 'La suppression de votre compte supprime aussi vos études privées et publiées ainsi que leurs aperçus hébergés par Bible Strong. Les copies locales et les exports sur vos appareils se gèrent séparément.',
    sections: [
      {
        id: 'before', title: 'Avant de supprimer votre compte',
        paragraphs: ['Exportez ou sauvegardez les contenus que vous souhaitez conserver avant de supprimer votre compte. La suppression de vos études ne nécessite aucune action séparée.', 'La suppression est irréversible. Elle concerne aussi vos études publiées, qui ne seront plus accessibles sur leurs pages publiques une fois le traitement terminé.'],
      },
      {
        id: 'account', title: 'Depuis l’application',
        paragraphs: ['Connectez-vous au compte concerné. Ouvrez votre profil, ou le menu « Plus » selon votre version, puis choisissez « Supprimer mon compte ». Saisissez le texte de confirmation demandé et validez. Une reconnexion récente peut être nécessaire pour autoriser cette opération.', 'Cette action supprime le compte d’authentification et déclenche la suppression du profil, des données synchronisées associées, de toutes ses études privées et publiées et de leurs aperçus. Le traitement serveur peut ne pas être immédiat ; les erreurs temporaires font l’objet de nouvelles tentatives.'],
      },
      {
        id: 'request', title: 'Par e-mail, même sans accès à l’application',
        paragraphs: ['Écrivez à stephane@lestudio316.com avec l’objet « Suppression de données », de préférence depuis l’adresse associée à votre compte. Indiquez si vous demandez la suppression du compte, de certaines données ou d’une étude publiée. Vous pouvez demander l’effacement de données sans supprimer tout votre compte.', 'Nous pouvons demander les informations nécessaires pour vérifier votre identité et retrouver les données. N’envoyez ni mot de passe ni données bancaires. Nous répondons en principe sous un mois. Si une prolongation est nécessaire dans les conditions du RGPD, nous vous en expliquons la raison dans ce premier mois ; le délai peut alors être prolongé de deux mois.'],
        links: [{ label: 'Envoyer une demande de suppression', href: 'mailto:stephane@lestudio316.com?subject=Suppression%20de%20donn%C3%A9es' }],
      },
      {
        id: 'local', title: 'Données sur vos appareils et conversations IA',
        paragraphs: ['L’historique de l’assistant web est conservé dans votre navigateur. Supprimez les conversations depuis son historique ou effacez les données du site dans les réglages du navigateur. Effectuez cette opération sur chaque navigateur utilisé : se déconnecter ou supprimer le compte n’efface pas automatiquement toutes les copies locales.', 'Sur mobile, les réglages du système permettent de supprimer les données de l’application ou de la désinstaller selon la plateforme. Les exports et sauvegardes que vous avez créés ailleurs doivent être supprimés séparément. Effacer des données locales ne supprime pas votre compte distant.', 'La suppression locale d’une conversation IA ne demande pas son effacement au service distant. Précisez dans votre e-mail si votre demande porte aussi sur les messages transmis à l’assistant.'],
      },
      {
        id: 'limits', title: 'Autres données et paiements',
        paragraphs: ['Les copies détenues par d’autres personnes ne peuvent pas être effacées à distance par Bible Strong. Certains journaux, sauvegardes ou justificatifs peuvent avoir une durée de conservation distincte, notamment en raison d’obligations légales. Une demande concernant ces données est examinée selon leur nature et les obligations applicables. Si une conservation reste nécessaire, nous vous en expliquons le motif.', 'La suppression du compte ne résilie pas un soutien récurrent ou un abonnement souscrit auprès d’un prestataire. Résiliez-le auprès de la boutique ou du service de paiement concerné.'],
        links: [{ label: 'Politique de confidentialité et droits', href: '/fr/politique-de-confidentialite' }],
      },
    ],
  },
  en: {
    title: 'Delete my account and data',
    introduction: 'Deleting your account also deletes your private and published studies and their previews hosted by Bible Strong. Local copies and exports on your devices are managed separately.',
    sections: [
      {
        id: 'before', title: 'Before deleting your account',
        paragraphs: ['Export or back up content you wish to keep before deleting your account. No separate action is needed to delete your studies.', 'Deletion is irreversible. It also covers your published studies, which will no longer be accessible on their public pages once processing is complete.'],
      },
      {
        id: 'account', title: 'From the application',
        paragraphs: ['Sign in to the account concerned. Open your profile, or the “More” menu depending on your version, then choose “Delete account”. Enter the requested confirmation text and confirm. You may need to sign in again recently to authorize this action.', 'This deletes the authentication account and triggers deletion of the profile, associated synchronized data, all its private and published studies and their previews. Server processing may not be immediate; temporary failures are retried.'],
      },
      {
        id: 'request', title: 'By email, including without application access',
        paragraphs: ['Email stephane@lestudio316.com with the subject “Data deletion”, preferably from the email address associated with your account. Specify whether you want to delete the account, particular data or a published study. You may request deletion of data without deleting your entire account.', 'We may ask for information needed to verify your identity and locate the data. Do not send passwords or payment details. We normally respond within one month. If an extension is necessary under the GDPR, we explain why during that first month; the deadline may then be extended by two months.'],
        links: [{ label: 'Send a deletion request', href: 'mailto:stephane@lestudio316.com?subject=Data%20deletion' }],
      },
      {
        id: 'local', title: 'Data on your devices and AI conversations',
        paragraphs: ['Web assistant history is stored in your browser. Delete conversations from its history or clear site data in browser settings. Do this in each browser you used: signing out or deleting the account does not automatically erase every local copy.', 'On mobile, system settings let you clear application data or uninstall the application, depending on the platform. Exports and backups you created elsewhere must be deleted separately. Clearing local data does not delete your remote account.', 'Deleting an AI conversation locally does not request erasure from the remote service. Specify in your email if your request also covers messages sent to the assistant.'],
      },
      {
        id: 'limits', title: 'Other data and payments',
        paragraphs: ['Bible Strong cannot remotely erase copies held by other people. Some logs, backups or records may have separate retention periods, including for legal obligations. Requests concerning these records are assessed according to their nature and applicable obligations. If retention remains necessary, we explain the reason.', 'Deleting your account does not cancel recurring support payments or subscriptions with a provider. Cancel these through the relevant store or payment service.'],
        links: [{ label: 'Privacy policy and rights', href: '/privacy-policy' }],
      },
    ],
  },
}
