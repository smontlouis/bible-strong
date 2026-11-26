/**
 * Offline copies the catalog no longer publishes but installed applications still request.
 *
 * An application reads the catalog compiled in its binary until the remote one has loaded, and
 * its startup migration installs before that. Each archive stays served under its old name, from
 * its immutable key, for the SHA those binaries pinned (ADR-0079).
 */
export type RetiredOfflineArtifact = {
  readonly file: string
  readonly archiveSha256: string
  readonly encryptedArchive?: { readonly file: string; readonly sha256: string }
}

export const RETIRED_OFFLINE_ARTIFACTS: readonly RetiredOfflineArtifact[] = [
  // BHG text bhg-803c482ed06005693547 and its interlinear indexes, compiled in 27.2 and earlier.
  {
    file: 'bibles/bible-step.json.zip',
    archiveSha256: '5d7b283e3e20ec748844acfe46877bae7e4e6045d4e4455116f6218a54b18fd6',
    encryptedArchive: {
      file: 'bibles/bible-step.json.encrypted.zip',
      sha256: '4134a28abfe274a435a782ff6dc8a9f8ef294ca558e8746848249a3bb16305eb',
    },
  },
  {
    file: 'bibles/bible-step-interlinear-fr.sqlite.zip',
    archiveSha256: '01c757b213c0b467a6ae0d405f7e911ea516eed4159485b591f5b3196e9905ec',
    encryptedArchive: {
      file: 'bibles/bible-step-interlinear-fr.sqlite.encrypted.zip',
      sha256: 'b580dbed617e666923cbc6f4cf5da54d3fcf9b89b1ada02ff3b463a0e140b8ab',
    },
  },
  {
    file: 'bibles/bible-step-interlinear-en.sqlite.zip',
    archiveSha256: '5bcfee1b51c1a24222475f6bbdae0ea433a620102987a0448a883eed3dacf2eb',
    encryptedArchive: {
      file: 'bibles/bible-step-interlinear-en.sqlite.encrypted.zip',
      sha256: 'b504db86bca7a96b3753e775b5380078a8a217b20232bd5e9ac41f5ef9e5cf93',
    },
  },
  // Strong lexicon modules before the transliteration corrections of 2026-11-26, compiled in 28.2.8
  // and earlier.
  {
    file: 'databases/strong_lexicon.core.sqlite.zip',
    archiveSha256: '386c4801c520fc0688253d1db5fbfa21152bab323e54479dad03476e9b4e4fb4',
    encryptedArchive: {
      file: 'databases/strong_lexicon.core.sqlite.encrypted.zip',
      sha256: 'fc95b7e7ce04f1bcaab8422bd06ac85d1b24abeef04a22fce150e566b6799a20',
    },
  },
  {
    file: 'databases/strong_lexicon.resources.sqlite.zip',
    archiveSha256: '55a390e1a845138b4f397ae51a714d4825b409e587a8b91c3dd836b534814e28',
    encryptedArchive: {
      file: 'databases/strong_lexicon.resources.sqlite.encrypted.zip',
      sha256: 'dc75280924fb8a7903ed33a88764f704775e6659638ba3e51475e1798b958e43',
    },
  },
  {
    file: 'databases/bible_entities.production.sqlite.zip',
    archiveSha256: 'a5e45f1fcf91a6f6d70cdb31878354777076456263b40888cd4ef717c27e1f6f',
    encryptedArchive: {
      file: 'databases/bible_entities.production.sqlite.encrypted.zip',
      sha256: '66ce44dc2828163bb2fd0d07093d081aee959dc759af55a62504863f9ed4c208',
    },
  },
  {
    file: 'databases/strong_lexicon.simple-fr.sqlite.zip',
    archiveSha256: '0f0dd7545a43b732760ac49be7ca789a7787e3e9b02c39929b99cb102a84aaae',
    encryptedArchive: {
      file: 'databases/strong_lexicon.simple-fr.sqlite.encrypted.zip',
      sha256: '067afbe74c65b695bef34f7670859ad6f396058b073233cd3228d599872a3996',
    },
  },
  {
    file: 'databases/strong_lexicon.simple-en.sqlite.zip',
    archiveSha256: 'a3007c4054b1dc461dd5d2deb4e94a2859224e633ee3becb806329b263a9e0db',
    encryptedArchive: {
      file: 'databases/strong_lexicon.simple-en.sqlite.encrypted.zip',
      sha256: '88ac56a8782abbfc22d7e9a67c4b3819ede2e7ca6500853c84be04afd6497140',
    },
  },
]
