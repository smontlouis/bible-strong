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
]
