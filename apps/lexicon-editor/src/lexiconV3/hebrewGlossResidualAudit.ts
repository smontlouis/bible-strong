/*
 * Sealed result of two independent semantic reviews plus final adjudication.
 * This registry is data, not a heuristic: every identity, input value, source
 * attestation and occurrence corpus is checked before publication.
 */

export const HEBREW_GLOSS_RESIDUAL_AUDIT_PASS_IDS = {
  sourceAudit: "hebrew-gloss-residual-source-audit@2026-07-13",
  counterAudit: "hebrew-gloss-residual-counteraudit@2026-07-13",
  finalAdjudication: "hebrew-gloss-residual-final-adjudication@2026-07-13"
} as const;

export const HEBREW_GLOSS_RESIDUAL_SOURCE_ARTIFACT = {
  fileDigest:
    "4c06669c61dd9d74b58f3e429c4f33b6dc6fef1e5d45fd04787ff7c0504bffd4",
  fullLogicalDigest:
    "eab7635ff33d5abc47656a024c951617d282782bd6d3c15ea00569e02737d263",
  retainedProjection:
    "identity,input,decision,exactSourceAttestations,occurrenceProof-count-and-corpus"
} as const;

export const HEBREW_GLOSS_RESIDUAL_AUDIT = {
  schema: "hebrew-gloss-counteraudit@1",
  reviewedCount: 65,
  classificationCounts: {
    keep_step: 31,
    replace_source_value: 30,
    editorial_reconstruction: 4
  },
  registryDigest:
    "880d82e587b4638bff4cfdb1ff58587ef8001dc2e30575b130697e542431cf0a",
  sourcePins: {
    tbesh: "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
    tahot: {
      "TAHOT Gen-Deu.txt":
        "e9b8546ee48fe0bfc57c3b70f5f40e98d96580e803526d19026224e31753368b",
      "TAHOT Isa-Mal.txt":
        "f3ded203d2a74d6368932c97ae550d1d0754b271af491dc0dedf36fe3ba0bcc5",
      "TAHOT Job-Sng.txt":
        "84e118a97e5725e3847cdfdd593873513021c790c63cc91a0d41fca2b5db2ed5",
      "TAHOT Jos-Est.txt":
        "195fee1dc3653bab33701f170734eb894ed647c10cd08cc61749375fe8b73775"
    },
    openScripturesCommit: "21c9add13bc727d3a951361778e97e3ff7afd1ce",
    openScriptures: {
      "AugIndex.xml":
        "e7217ca8ff8ff3f21f9cf1bbe87411adf55f6aa88bcf5ed9ddc886cc6b160c5d",
      "BrownDriverBriggs.xml":
        "2b52658a4323d91674cda4090ab8b3ebddfff640f4f18143c28300e80b2c38f8",
      "HebrewStrong.xml":
        "a628f4f89f8bdaf2483fd3faf1abc8653cc6717758dfc9f24beb7571d9bdd0c4",
      "LexicalIndex.xml":
        "8f7a605c58899d2f44430149c143c00903976e1e91232476677972a69e5bc85f"
    },
    tipnr: "1a3b7d7df5cfa1e96eefa07dec92900bea278370c6788fadb5d036f3223b637c"
  },
  specialProofs: {
    H0761I: {
      locator: "TAHOT:2Ki.16.6#14:Ketiv",
      exactLineDigest:
        "d1f922f09ba68f5ceb1e498af3f5629ea3e93552ee71c4a8798010ed531390fe",
      sourceFileDigest:
        "195fee1dc3653bab33701f170734eb894ed647c10cd08cc61749375fe8b73775",
      text: "Ketiv and/ Arameans; Qere and/ Edomites"
    },
    H8323B: {
      locator: "TAHOT:Jer.15.11#05:Ketiv",
      exactLineDigest:
        "c8e185822fa8b24c4f1716f8445f3e7b7f2e8f764a001c24d37b03aff89cf5f3",
      sourceFileDigest:
        "f3ded203d2a74d6368932c97ae550d1d0754b271af491dc0dedf36fe3ba0bcc5",
      text: "Ketiv I will strengthen you"
    },
    H1389J: {
      relationTarget: "H1390H",
      targetCandidateRecordDigest:
        "4d4e014581abff0ce56938b41ab1cff0bd57f6d72e7316f761a36c29c32f2db9",
      targetStepAnchorDigest:
        "70a3b7359e7b7f38ac7fa0c98f4421d633a90d2b5f0fa15951f0217a57b690c8",
      targetTipnrDigest:
        "79e8e4f446a430ecf679f40ec8c7514d5c3526dc1e48055a0b6f97995917e0a5",
      targetGloss: "Gibeah",
      targetGlossDigest:
        "52f5c990865f75bfea3e3000697c797a733ad9c2943292b68e29b30e4318b5af"
    }
  },
  records: [
    {
      key: "H0011",
      identity: {
        stepEntryId: 11048,
        eStrong: "H0011",
        dStrong: "H0011 =",
        uStrong: "H0011"
      },
      input: {
        stepGloss: "Abaddon",
        stepGlossDigest:
          "674e7be7af2d59b285f39a78c231b2c1b79ca21b9f26c3699d2520c6c3f55b50",
        candidateRecordDigest:
          "a3af5f5188a99251cc6b6657d7654c7d308206c07caee08aa998ce78b2dbecba",
        stepAnchorDigest:
          "6630b94071ec3d2f1704df7ac09cfb619d60b433aed7523a6bbb7d837f510696"
      },
      decision: {
        finalAction: "keep_step",
        value: "Abaddon",
        valueDigest:
          "674e7be7af2d59b285f39a78c231b2c1b79ca21b9f26c3699d2520c6c3f55b50",
        reason:
          "Exact lexical name and five TAHOT occurrences; TIPNR ambiguity concerns entity scope, not the gloss.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:11048":
          "6630b94071ec3d2f1704df7ac09cfb619d60b433aed7523a6bbb7d837f510696",
        "STEPBible-TIPNR:H0011:entity:4132":
          "4b6a8f8379447121fc77374295780ea070fc439de8a53bd85b2c94675cbe110a",
        "STEPBible-TIPNR:H0011:entity:4231":
          "2af69e1ca933ded6e3d7053211d7424fcb1940b757c83148c44bd6fc386a1f9c"
      },
      occurrenceProof: {
        count: 5,
        occurrenceCorpusDigest:
          "0764eda826ecfd3440c4ac38315fa27b45563521f6cec7c9634887d2b45a3bb1"
      }
    },
    {
      key: "H0122B",
      identity: {
        stepEntryId: 11192,
        eStrong: "H0122b",
        dStrong: "H0122B =",
        uStrong: "H0122B"
      },
      input: {
        stepGloss: "red stuff",
        stepGlossDigest:
          "42263d0e5f35f9562da30db8b1a503506bc4c0e7128d8797a5cadc6797a8fd25",
        candidateRecordDigest:
          "1bd646fca81e1a05d4c917d933ae56bb0de840ccb68c4242163dc3a51701b6c4",
        stepAnchorDigest:
          "59ffe2a2d39d50ff1587c36357654b1f75168d20e800013b2d3c9e97e4f205f7"
      },
      decision: {
        finalAction: "keep_step",
        value: "red stuff",
        valueDigest:
          "42263d0e5f35f9562da30db8b1a503506bc4c0e7128d8797a5cadc6797a8fd25",
        reason:
          "Exact subentry denotes the red stew; TAHOT has two red-stew occurrences.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H122b":
          "f8f05c99147b495444d79817edc12669d76bbf4b4c5915f1ce1f227bf69079d4",
        "OpenScriptures-BrownDriverBriggs:a.bd.ae":
          "230cd8195769419d1dc1ce50ef41252e5c788b1db74a7c1e6e436bc36466b70e",
        "OpenScriptures-HebrewStrong:H122":
          "cf26b7743bc10fcf1a6b45e46c003837b6293f66b84bbed08f8105dc73ef82f4",
        "OpenScriptures-LexicalIndex:aez":
          "2cc2ddf0a2659a75adc9e14aa0b8bed60ba47795f90c73eef67e93c4c3219cbe",
        "STEP-gloss-anchor:11192":
          "59ffe2a2d39d50ff1587c36357654b1f75168d20e800013b2d3c9e97e4f205f7"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "8b95951cb895522498beb6ca71e572c896a5cf3dd5353d154c739f184552588f"
      }
    },
    {
      key: "H0227A",
      identity: {
        stepEntryId: 11332,
        eStrong: "H0227a",
        dStrong: "H0227A =",
        uStrong: "H0227A"
      },
      input: {
        stepGloss: "then",
        stepGlossDigest:
          "21af6f1260f927f5b9b3ff5ca4a5d19493a1a47a5977240d8dca31bc47a63527",
        candidateRecordDigest:
          "df72dae7d1810e178e4bf4d02c58eb08565eefb06896a51c2566d2c9011cb26c",
        stepAnchorDigest:
          "48fb685ee5fa9a22d8349adb1c10ee6792d6d021969a44137e67f60193f1ac6b"
      },
      decision: {
        finalAction: "keep_step",
        value: "then",
        valueDigest:
          "21af6f1260f927f5b9b3ff5ca4a5d19493a1a47a5977240d8dca31bc47a63527",
        reason:
          "122 exact TAHOT occurrences support the STEP gloss; only the external POS label differs.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H227a":
          "6406a285e5c8cd68eafd9cbc1d84d6a2af0611737673c5d206f6ab8fed2735f2",
        "OpenScriptures-BrownDriverBriggs:a.ce.ac":
          "a82912f174467d828b01211def26987404c4f9249ec22e7d1a76cb9e70070db1",
        "OpenScriptures-HebrewStrong:H227":
          "f8dfe8574eb7811439178caf8a2affe501bbcd7540f9ddd87a90b0442f5b15fe",
        "OpenScriptures-LexicalIndex:ajp":
          "d4a11a08ad08b1c30ff8e2fa7cbc892f2aed76901e47a9aa9753c2acee5946d9",
        "STEP-gloss-anchor:11332":
          "48fb685ee5fa9a22d8349adb1c10ee6792d6d021969a44137e67f60193f1ac6b"
      },
      occurrenceProof: {
        count: 122,
        occurrenceCorpusDigest:
          "ac15a38e1c6514a56cd9f11ab0a5a4331acec577be9bce4b9ac6eaf8af3459c0"
      }
    },
    {
      key: "H0310A",
      identity: {
        stepEntryId: 11446,
        eStrong: "H0310a",
        dStrong: "H0310A =",
        uStrong: "H0310A"
      },
      input: {
        stepGloss: "after",
        stepGlossDigest:
          "f39592393ef0859cb196a52693d2cea00fb2df784b3c04ae54aa7cadb8e562f8",
        candidateRecordDigest:
          "f05334c600e3c11a8325bb61902a216eecd395b6d4f6d07426977867f74bacbe",
        stepAnchorDigest:
          "5045103ae13e46f95dfcd9952e345c2fd0242be7d60b1ec076d27f56d264f5b2"
      },
      decision: {
        finalAction: "keep_step",
        value: "after",
        valueDigest:
          "f39592393ef0859cb196a52693d2cea00fb2df784b3c04ae54aa7cadb8e562f8",
        reason: "715 exact TAHOT occurrences support the STEP gloss.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H310a":
          "20b851959afff86fb3fc2763a2b2cd983a0b9697e69df64f5f9f75c2a3c63479",
        "OpenScriptures-BrownDriverBriggs:a.cp.ac":
          "de4e48650f4a18a68e5b0555f79249dd18cdbb0ddb503d9487f466998973b268",
        "OpenScriptures-HebrewStrong:H310":
          "6f2041e0b5e2c5b729650ddd3af76f6e7c5122431dc0165791491f7eae92b011",
        "OpenScriptures-LexicalIndex:amu":
          "3f892a8f96f9250b0945457f1bd9059b0ade7564c90764dcb54926be707d376b",
        "STEP-gloss-anchor:11446":
          "5045103ae13e46f95dfcd9952e345c2fd0242be7d60b1ec076d27f56d264f5b2"
      },
      occurrenceProof: {
        count: 715,
        occurrenceCorpusDigest:
          "54cf94fc6793f9cab32587ee2ed1946fa0548a05485fcbde113e64897297448f"
      }
    },
    {
      key: "H0310B",
      identity: {
        stepEntryId: 11447,
        eStrong: "H0310b",
        dStrong: "H0310B =",
        uStrong: "H0310B"
      },
      input: {
        stepGloss: "backwards",
        stepGlossDigest:
          "90c332f4df1ce9743983052d3a9a32d14cfdbccb0139ec25562be4039d2d573a",
        candidateRecordDigest:
          "d4aa11cdacf89c8016a7111159561b393090967d2c0d309061ffb8348079f009",
        stepAnchorDigest:
          "278a5ce9a0cbb8744e6887dfaa40719b272cebfea1ef41f2620f09e882be9654"
      },
      decision: {
        finalAction: "keep_step",
        value: "backwards",
        valueDigest:
          "90c332f4df1ce9743983052d3a9a32d14cfdbccb0139ec25562be4039d2d573a",
        reason:
          "The rare subentry/BDB sense supports backwards; preserve the lone occurrence nuance in meaning.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H310b":
          "2827a1c65aa12cc182e85ba5795eb20a90a82bb02cd5e0c42dc19176cbbe08f6",
        "OpenScriptures-BrownDriverBriggs:a.cp.ad":
          "9f94560d4385a74e2cd35eee150455fe7039cf3b72e1f9b8bd3c0fbc49624241",
        "OpenScriptures-HebrewStrong:H310":
          "6f2041e0b5e2c5b729650ddd3af76f6e7c5122431dc0165791491f7eae92b011",
        "OpenScriptures-LexicalIndex:amz":
          "227fab3604d7317242c6fb1f98131a6dbcef95782100a80e7da8b9d6b6515e15",
        "STEP-gloss-anchor:11447":
          "278a5ce9a0cbb8744e6887dfaa40719b272cebfea1ef41f2620f09e882be9654"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "255ae92e489ece3a3f1622f8504f68744ba7e57eeb63b2954e4f27e85db4ba5f"
      }
    },
    {
      key: "H0432",
      identity: {
        stepEntryId: 11602,
        eStrong: "H0432",
        dStrong: "H0432 =",
        uStrong: "H0432"
      },
      input: {
        stepGloss: "except",
        stepGlossDigest:
          "b11279547bc49510a81a764a59dc2eaba8cd004d95878e3a284fd27427042553",
        candidateRecordDigest:
          "c273bfa528533a300878c29f891987f3f4a45d462f4b33fb23b1cb4dddbdd04c",
        stepAnchorDigest:
          "f88429a9a746743844a96055a077f216ff9a90395b826c3f5ef568b6f346a3a0"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "if",
        valueDigest:
          "935f68319d4f227e02bfd54a0ddf85b8a242e42a4277aa5ef5eaab691710924e",
        reason:
          "Both exact TAHOT occurrences and HebrewStrong support if; except is not supported.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H432":
          "7c4ff372d1995cd4ba4f0a9e8819e10c63fb42a7c38b06803b80e4306a59c5c3",
        "OpenScriptures-LexicalIndex:aro":
          "438895d6bcac13285fe483145c1395df3e7d0134cfc5db903283d3e6403018e9",
        "STEP-gloss-anchor:11602":
          "f88429a9a746743844a96055a077f216ff9a90395b826c3f5ef568b6f346a3a0"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "ac8508e087460bae3c2500bb61b260fa9235140a6f07fe7193bce468177f7ca9"
      }
    },
    {
      key: "H0576A",
      identity: {
        stepEntryId: 11864,
        eStrong: "H0576a",
        dStrong: "H0576A = in Aramaic of",
        uStrong: "H0589"
      },
      input: {
        stepGloss: "me",
        stepGlossDigest:
          "2744ccd10c7533bd736ad890f9dd5cab2adb27b07d500b9493f29cdc420cb2e0",
        candidateRecordDigest:
          "8cbe34811e4babeec539ff3121712efcea1f3b09a22dafbbd5a208f8a73b72b1",
        stepAnchorDigest:
          "00ecfba3d3a8c21aba18cc8cf33966da6831a4da86371407e437b7b63e2ce687"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "I",
        valueDigest:
          "a83dd0ccbffe39d071cc317ddf6e97f5c6b1c87af91919271f9fa140b0508c6c",
        reason:
          "Exact augmented lexical identity defines the first-person pronoun as I.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H576a":
          "de599d1d329d1bca35ba083468782ee4f9e23163b383cdf23d64d6d4eddaf0bf",
        "OpenScriptures-BrownDriverBriggs:xa.au.aa":
          "448e7272b218fd1ec30fe2eab6fcdd5b2d8ff036e4a883a4886ed4faf45a3b60",
        "OpenScriptures-HebrewStrong:H576":
          "4e4357c545c1f5c8c2023b99d13f5ecf3a6d12e0e01d52ea51b217eb69cdc378",
        "OpenScriptures-HebrewStrong:H589":
          "de63b8e7210faeb7518916596615c430c43b200c2b4d4019ae20e07bfe4cf18d",
        "OpenScriptures-LexicalIndex:oaq":
          "02fc235b3f324fa3ff254d3304ea51bd75edba33fa73e7cb4489a059dcce4d0b",
        "STEP-gloss-anchor:11864":
          "00ecfba3d3a8c21aba18cc8cf33966da6831a4da86371407e437b7b63e2ce687"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "7b54fb01f2202c9abb71577dc0fc165d0549210c72a9e6ec7cb39dd47abff522"
      }
    },
    {
      key: "H0576B",
      identity: {
        stepEntryId: 11865,
        eStrong: "H0576b",
        dStrong: "H0576B = in Aramaic of",
        uStrong: "H0589"
      },
      input: {
        stepGloss: "me",
        stepGlossDigest:
          "2744ccd10c7533bd736ad890f9dd5cab2adb27b07d500b9493f29cdc420cb2e0",
        candidateRecordDigest:
          "8679353a0dd6380a8abea8b7cf9edd273e70a5bec20f29c4333803bae8c4d9b1",
        stepAnchorDigest:
          "00ecfba3d3a8c21aba18cc8cf33966da6831a4da86371407e437b7b63e2ce687"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "I",
        valueDigest:
          "a83dd0ccbffe39d071cc317ddf6e97f5c6b1c87af91919271f9fa140b0508c6c",
        reason:
          "Exact augmented lexical identity and all 16 TAHOT occurrences support I.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H576b":
          "4256b2249704c96918e48712e5e39cb6b0834c5b1254ded7b65805eabd4d3887",
        "OpenScriptures-BrownDriverBriggs:xa.av.aa":
          "eee22c803e11f9f1871e529a0ff5be3f98d5ca69327ea31362862ada6beb5b0b",
        "OpenScriptures-HebrewStrong:H576":
          "4e4357c545c1f5c8c2023b99d13f5ecf3a6d12e0e01d52ea51b217eb69cdc378",
        "OpenScriptures-HebrewStrong:H589":
          "de63b8e7210faeb7518916596615c430c43b200c2b4d4019ae20e07bfe4cf18d",
        "OpenScriptures-LexicalIndex:oar":
          "49351eb8a0b9b9f3c5c76b2642f5613a089361e72051528a9638af9e80126753",
        "STEP-gloss-anchor:11865":
          "00ecfba3d3a8c21aba18cc8cf33966da6831a4da86371407e437b7b63e2ce687"
      },
      occurrenceProof: {
        count: 16,
        occurrenceCorpusDigest:
          "85770cb167d50bf993fd265159a9e79d303777d0229c6a19562193ab356f7a15"
      }
    },
    {
      key: "H0761I",
      identity: {
        stepEntryId: 12091,
        eStrong: "H0761",
        dStrong: "H0761I = a Spelling of",
        uStrong: "H0123G"
      },
      input: {
        stepGloss: "Edomite",
        stepGlossDigest:
          "cf2e29a331446872db24787d79811b5b694d2cc256494f31da55e3f033c1eada",
        candidateRecordDigest:
          "4f7886c6dab00ca81ab64513d6c747fca5b3ce39cda6ff3ae84e5a96ee1b85af",
        stepAnchorDigest:
          "9fe420e7b7fd01fb6653e6aa42810df95b4a3e189c7fee1cb92c5dc5cd202a15"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "Aramean",
        valueDigest:
          "04bfdf75787ceb1516c8274bedc361d719d3343f589e15227a31d65ce29360d1",
        reason:
          "The exact Ketiv is Arameans; Edomites is the Qere. Keep the Ketiv/Qere explanation in meaning.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12091":
          "9fe420e7b7fd01fb6653e6aa42810df95b4a3e189c7fee1cb92c5dc5cd202a15",
        "STEPBible-TIPNR:H0761I:entity:3416":
          "9f53717314136571c7c6250865c6317e1d413a8093cc500226490c876dc452a8"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "ec6d1d657e6750ee6b9c1a6bb78bb8533af938bb87ec91ea026c9e1f8e8b8702"
      }
    },
    {
      key: "H0924",
      identity: {
        stepEntryId: 12292,
        eStrong: "H0924",
        dStrong: "H0924 = in Aramaic of",
        uStrong: "H0926"
      },
      input: {
        stepGloss: "hastely",
        stepGlossDigest:
          "b23c9a336d71c9deda109c57369e0ad822d009b709c2a303ca456ac6e1946485",
        candidateRecordDigest:
          "0b28b93fbb8fab697b5f214fb44df1ee19ffc98c62abd1916cac6facbe7f62f6",
        stepAnchorDigest:
          "bb23eb780acdc9551834cc8d19ff09f8f9396e8143c94f774d3bce74479cae66"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "hastily",
        valueDigest:
          "0a65aa783428161c9121e0fee82fa7bd5bdf42d5b76f711dda47a687b46c5e40",
        reason:
          "HebrewStrong and the sole TAHOT occurrence support the adverb; fixes STEP hastely.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xb.ad.ab":
          "33c91e792a8719235cdcf034eb4726d179092fc8153a91795f56e311355c07b5",
        "OpenScriptures-HebrewStrong:H924":
          "12b4aa5dd628f52df16d9813b084ead5ffbe19ebd7d762be96a4622cbcdbb162",
        "OpenScriptures-HebrewStrong:H926":
          "9d175799f6581956e6feb3fc78aea17c26f1c9be77f79891657054dda1774119",
        "OpenScriptures-HebrewStrong:H927":
          "efa4627f15ddf175dc5f1e7b2cb4f0764cfce483e7a4eee5a036873acbbdf8ce",
        "OpenScriptures-LexicalIndex:ocu":
          "0b05cb23d68c9c9005ed3d8bc829d1a55df30ac9a2adde027ad99e4ba467809b",
        "STEP-gloss-anchor:12292":
          "bb23eb780acdc9551834cc8d19ff09f8f9396e8143c94f774d3bce74479cae66"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "5754941814d7a4d7efe6acb2dd6bd64de2bdde7e274ff09ea1c4279b3711d09f"
      }
    },
    {
      key: "H1004A",
      identity: {
        stepEntryId: 12390,
        eStrong: "H1004a",
        dStrong: "H1004A =",
        uStrong: "H1004A"
      },
      input: {
        stepGloss: "place",
        stepGlossDigest:
          "81df63580cc9ff1550c90d918ec234f1834013b800b5321201e88d96e785277c",
        candidateRecordDigest:
          "a6e1b3e76e78850135787f8e58ef1550bc657e59ca3682940034f148bd66eb58",
        stepAnchorDigest:
          "b0bc1723a0907388f226c26e20944c77c1796a4c4a77eb47f38c02039d5cc167"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "between",
        valueDigest:
          "fbb27fbdc4f4dd04e21693a3b56c311cd37f743174c1bad4fc27467605426c28",
        reason:
          "Exact augmented lexical identity and three of four TAHOT occurrences support between.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H1004a":
          "57e0b43d8a1402aa7b690d8d29385d5517b9f48f88d2f0cae5f90a22f0334846",
        "OpenScriptures-BrownDriverBriggs:b.bo.ad":
          "bde99841a9fe1dc0563a48bd6ef76dba81788110934e7dbe34f413bb4b04f712",
        "OpenScriptures-HebrewStrong:H1004":
          "5a655f91ed680d3cf2f994f2c81258bdbc46294b4ecd28f13042b26df1dd239e",
        "OpenScriptures-LexicalIndex:boe":
          "a0118084b21e7927b8bf8ef1bab9218b60113173cf66d35bb936713b1e916980",
        "STEP-gloss-anchor:12390":
          "b0bc1723a0907388f226c26e20944c77c1796a4c4a77eb47f38c02039d5cc167"
      },
      occurrenceProof: {
        count: 4,
        occurrenceCorpusDigest:
          "2f18e6896134d5b41b214fbf6977d9d0885b58dbe16ef7bf05d2b13eb6f7f9a3"
      }
    },
    {
      key: "H1276",
      identity: {
        stepEntryId: 12784,
        eStrong: "H1276",
        dStrong: "H1276 = a group of",
        uStrong: "H1075"
      },
      input: {
        stepGloss: "Bichrites",
        stepGlossDigest:
          "8a963845ce015a2c591ea98c62110adcce317c9772923e8b97d0c9c54f4ad0ec",
        candidateRecordDigest:
          "6b3dc8f60d2620362480483e36adb109a830a234ee9962239be3e9514c05cff2",
        stepAnchorDigest:
          "0d8eed342deedf200bfbd866e3ed545cc4bfe12152b2649341b6f8b31d901053"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "Berites",
        valueDigest:
          "6c16af44e65c1053acc8d22d062f126a08d07a8cff6115f814cb92963d9a5455",
        reason:
          "HebrewStrong and the sole exact TAHOT occurrence support Berites; TIPNR attached Bichri entity context.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12784":
          "0d8eed342deedf200bfbd866e3ed545cc4bfe12152b2649341b6f8b31d901053",
        "STEPBible-TIPNR:H1276:entity:542":
          "8253f4527ac8745be3bce096e33410747f8dddf762e70e67aa6705bf13f531d5"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "703bfcb1766b3eb5cfbcc0933c660f04c3fc62907ce3135c1bb01a0f8bb19087"
      }
    },
    {
      key: "H1389J",
      identity: {
        stepEntryId: 12925,
        eStrong: "H1389",
        dStrong: "H1389J = a Spelling of",
        uStrong: "H1390H"
      },
      input: {
        stepGloss: "Gibeat",
        stepGlossDigest:
          "ba7b18aeb63de7ebb1a88ca97a3894fe4781c87e1b64d02fe95131e85f433de0",
        candidateRecordDigest:
          "d37716f52b054110f32a6e99d4677bea27ffd9c2dddeb25458f83e119fc14fa5",
        stepAnchorDigest:
          "a98045eb13c43a2689cad677cb3af817826d4f818cf005e2dd5b1359ac344840"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        value: "Gibeah",
        valueDigest:
          "52f5c990865f75bfea3e3000697c797a733ad9c2943292b68e29b30e4318b5af",
        reason:
          "Exact STEP spelling relation targets H1390H, whose sealed gloss is Gibeah; Gibeat is truncated.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H1389":
          "aba12f3b928a9f08495d214367b8163c37a955d84c01a0396f9dce3f28c08b4a",
        "OpenScriptures-LexicalIndex:cdt":
          "4eb8118c002874cb1b77064be9b54ae4654e41883a7a6ea2c8b26bdab9f47e1a",
        "STEP-gloss-anchor:12925":
          "a98045eb13c43a2689cad677cb3af817826d4f818cf005e2dd5b1359ac344840"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "bcbaa1d195397c9d0f2f33dd6b2afd6afb4aa63cf887449e4e25c97e4040323c"
      }
    },
    {
      key: "H1524B",
      identity: {
        stepEntryId: 13098,
        eStrong: "H1524b",
        dStrong: "H1524B =",
        uStrong: "H1524B"
      },
      input: {
        stepGloss: "youth",
        stepGlossDigest:
          "b5bdafe95dec0c53112ce97abf0d737428142d686fa5a6252193a88dfad838ee",
        candidateRecordDigest:
          "64cbdee12e29e5f6b108dcc9d2a37690ec45ae6ebc49229ed9676451a95293e5",
        stepAnchorDigest:
          "1c8e46082d41acf4f7da97b2cfe9d36a88091e6cd1e21793f1f50c7bbbff7499"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "age",
        valueDigest:
          "013f54400c82da08037759ada907a8b864e97de81c088a182062c4b5622fd2ab",
        reason:
          "Exact BDB context says circle, age and the sole TAHOT occurrence is about your age; youth is too narrow.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H1524b":
          "6cac4d351773a7f68e3aa1df042147673c21ef3f303046f539afda32ce1ff2f1",
        "OpenScriptures-BrownDriverBriggs:c.bw.ac":
          "f89f722450251e1f929b78b9289816b6ba683a3868291eb29b2a6c185ea62903",
        "OpenScriptures-HebrewStrong:H1524":
          "3bf996f970e736f25cd501b034dadd37b9468eda75b384c69952d1110e9e4964",
        "OpenScriptures-LexicalIndex:cjj":
          "5760cf6de44b636f09b1ee5d5dafcc3f4914681668cc5e7954f888266173ab3e",
        "STEP-gloss-anchor:13098":
          "1c8e46082d41acf4f7da97b2cfe9d36a88091e6cd1e21793f1f50c7bbbff7499"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "3311e62b4a57f1cc0b69acefbb843a7c41703675f8ecf375c41d7ad7c997732c"
      }
    },
    {
      key: "H1761",
      identity: {
        stepEntryId: 13392,
        eStrong: "H1761",
        dStrong: "H1761 = in Aramaic of",
        uStrong: "H1760A"
      },
      input: {
        stepGloss: "diversion",
        stepGlossDigest:
          "cddf86d3bca49414da1a15fa6c7f7320c55572b975ad7d80033566cac6ec853a",
        candidateRecordDigest:
          "26bf58434823b819cac9bfd34391bb275a291e494b1f20ad3c43d2199a626e62",
        stepAnchorDigest:
          "94d09e010dc3aa5ed48c7d0203e26afcfc57f2c39058467cb4d557f35652eaef"
      },
      decision: {
        finalAction: "keep_step",
        value: "diversion",
        valueDigest:
          "cddf86d3bca49414da1a15fa6c7f7320c55572b975ad7d80033566cac6ec853a",
        reason:
          "Diversion is the safest short umbrella for an uncertain entertainment/instrument/attendant hapax.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xd.ae.ab":
          "77bce26515319beef2015c754cf790dd08e970d09cf4e0206c3f11975654e9ef",
        "OpenScriptures-HebrewStrong:H1761":
          "04ca5aff06e74eb62eae59a9e095684c629db136dd8dca20fda9906572d0b52d",
        "OpenScriptures-LexicalIndex:ofm":
          "2de55378fbe6e679f8fbc5eae92fa7627beff58f852b49ecd6cdcf4aba6f9c9b",
        "STEP-gloss-anchor:13392":
          "94d09e010dc3aa5ed48c7d0203e26afcfc57f2c39058467cb4d557f35652eaef"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "45207d2eaeb504746c8e275ef3108f58d15f92dadaa1e3b248927a5cc25b624f"
      }
    },
    {
      key: "H1772",
      identity: {
        stepEntryId: 13405,
        eStrong: "H1772",
        dStrong: "H1772 =",
        uStrong: "H1772"
      },
      input: {
        stepGloss: "hawk",
        stepGlossDigest:
          "0139bc5debaaa4b84e9341efb6ffa3e470f45a084742310e8f0b63ea83380168",
        candidateRecordDigest:
          "52730ea0bae43fc7c556d2ef470669dd45af45c0e3d7298b020e7db109111e44",
        stepAnchorDigest:
          "b8641ba7b4ccff5cb037c6814ab4814f9bd56d631afca00116a5194efe8de678"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        value: "bird of prey",
        valueDigest:
          "43e79a2d10ec786c81e3d757e61e1d6f942b11f857cfef2a3b216c3b34f6299b",
        reason:
          "Falcon, hawk, and black kite disagree at species level; bird of prey is the supported common denominator.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:d.ad.ac":
          "81cf3542856515e1b8246006090829d1f0346b6d377b6421f29996dbcf88c2cb",
        "OpenScriptures-HebrewStrong:H1772":
          "d5176a4efc9c098f7c8a1ef098602d13238114e253fc765e387fac0e70dc598c",
        "OpenScriptures-LexicalIndex:ctf":
          "7ec9ba5d51d12fdd040a87af30356cefe6b46853718a2ba569257785bbf093b4",
        "STEP-gloss-anchor:13405":
          "b8641ba7b4ccff5cb037c6814ab4814f9bd56d631afca00116a5194efe8de678"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "0645b8f3af56a1f1312d18e1072f48c75c8afc1888d0ed84a1813f3b08293983"
      }
    },
    {
      key: "H2006B",
      identity: {
        stepEntryId: 13702,
        eStrong: "H2006b",
        dStrong: "H2006B = in Aramaic of",
        uStrong: "H3860"
      },
      input: {
        stepGloss: "therefore",
        stepGlossDigest:
          "bae0db182974fd4655951483355ed85f4ea949b601bbb33524485915c124a5d1",
        candidateRecordDigest:
          "87697b1cf07787988dd0cf055533552037824264b6d893e8e775099a356bf6e6",
        stepAnchorDigest:
          "6e5e0d0d9815875696826354bd2514fc0c486e0ed59f9e7a4599ec70afd7fe41"
      },
      decision: {
        finalAction: "keep_step",
        value: "therefore",
        valueDigest:
          "bae0db182974fd4655951483355ed85f4ea949b601bbb33524485915c124a5d1",
        reason:
          "STEP sense and exact occurrences support this sub-sense despite external POS mismatch.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H2006b":
          "5987c5ba2677c6ee33c7ad64b14a97d755b53d51e4fbeb5334ef0870ac31e171",
        "OpenScriptures-BrownDriverBriggs:xl.af.aa":
          "0704017efbc0b4d8f82ef1878253f8e4b932adccf4a0329e3d08e096051a0efd",
        "OpenScriptures-HebrewStrong:H2006":
          "0b2c74c48eb235865342301602f802c1e61c9983f4576f2dee1901409ef917c7",
        "OpenScriptures-LexicalIndex:onm":
          "4ff29ea1ef5f1ebfd83952a116fec5a0e94534f659bef0b7bb65c98bf24b1974",
        "STEP-gloss-anchor:13702":
          "6e5e0d0d9815875696826354bd2514fc0c486e0ed59f9e7a4599ec70afd7fe41"
      },
      occurrenceProof: {
        count: 4,
        occurrenceCorpusDigest:
          "10de6abb48bbba5519d9d4c4012c2f184c11ba32f2b32460f87040aea328395f"
      }
    },
    {
      key: "H2050",
      identity: {
        stepEntryId: 13753,
        eStrong: "H2050",
        dStrong: "H2050 =",
        uStrong: "H2050"
      },
      input: {
        stepGloss: "to plot",
        stepGlossDigest:
          "b968e38c93373bd8ba144fc2438d3d8b22ea2ffcb566de394c8cac083346937a",
        candidateRecordDigest:
          "583e8114b2f68864239039ba48169b69fd35bfb06d8162a272dfc174eb707f64",
        stepAnchorDigest:
          "e8be73151a1e91a7ca9891ace514fe88e77c69ff744bf8c6d3f9b38cb4e12f84"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "to assail",
        valueDigest:
          "9bab15d89c83c718b9a70463fe21647654f036d0911bfd7eeb91de6898f9db00",
        reason:
          "HebrewStrong exact meaning is to assail and TAHOT renders the sole occurrence attack.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:e.bd.aa":
          "f8993d6aefa601e76ee2a5a5bf965614ffb1f228549a6d6889bb63a228558eac",
        "OpenScriptures-HebrewStrong:H2050":
          "8a64f2dd509464a8668abe6779afcf37250fe807fb45168f630d6d67f91dcebb",
        "OpenScriptures-LexicalIndex:daj":
          "04bf3aa29ef1aaa209d4b36a6d8f49231805b974fe394f1dc7a3e0a645135dff",
        "STEP-gloss-anchor:13753":
          "e8be73151a1e91a7ca9891ace514fe88e77c69ff744bf8c6d3f9b38cb4e12f84"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "88c9f85c3a9e9cc5841a4730a30d723c316085475cbf1e5683cc95bb07b3126c"
      }
    },
    {
      key: "H2215",
      identity: {
        stepEntryId: 14006,
        eStrong: "H2215",
        dStrong: "H2215 =",
        uStrong: "H2215"
      },
      input: {
        stepGloss: "to burn",
        stepGlossDigest:
          "ad1e789a40a5e8ff8d25b69712d445d4a3bc766d8e09d7141fd1dfca06dbd346",
        candidateRecordDigest:
          "c36795fc65e4298166c187fe6ad6dcd61ed8544d5c839f1977d3c9cbbddde92b",
        stepAnchorDigest:
          "644de6f701a07bb8a528f65de307617c91f0fac8cc2717271b18bca95abb7e27"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "to flow away",
        valueDigest:
          "89d0cec38336771c667b5944f737d4f7e25c2cac4d32ac4a59d030f0e23bfb4a",
        reason:
          "HebrewStrong exact meaning and the sole TAHOT occurrence support flow away.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:g.ch.aa":
          "ce512599a582d6b386da6597faca487388c60c55d6194eab08fc2c275d0632b3",
        "OpenScriptures-HebrewStrong:H2215":
          "9af96e54f13cc9b11a1e2e3ed66d6626a8c0f6a916314d09c41d6fe395c9497b",
        "OpenScriptures-LexicalIndex:dlf":
          "c4c6377d974cb1eca0605efb52708113c386b87f35130e644e48a7802cf56806",
        "STEP-gloss-anchor:14006":
          "644de6f701a07bb8a528f65de307617c91f0fac8cc2717271b18bca95abb7e27"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "6ebf853d6ad9871d133e1c872fd598bcbb0764a3d5f714a69ca86089987566a0"
      }
    },
    {
      key: "H2428A",
      identity: {
        stepEntryId: 14287,
        eStrong: "H2428a",
        dStrong: "H2428A = a Meaning of",
        uStrong: "H2428G"
      },
      input: {
        stepGloss: "strength: soldiers",
        stepGlossDigest:
          "baa4e24a7ba2c7abc8211544bdf270c183931e315217762e4a3cde32e4135618",
        candidateRecordDigest:
          "5c7b02eb06eed5ae3eee6ca36fd4a489bedba66b5356aba22fc76b74b34aa94f",
        stepAnchorDigest:
          "3d70eb0fdb66b930ac072bed020761752a23ea6372f14cc1541b4d2a6f015bb9"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "army",
        valueDigest:
          "b2fd5cdba2b1484db46c26a3426f70878d2b31f44f18f806fd262f34887a6320",
        reason:
          "The disambiguated subentry is overwhelmingly military across 110 TAHOT occurrences; army is clearer than strength: soldiers.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H2428":
          "987c893057a4717f4e843c1364b7f28d4d6eb3d6a3fccc970a0dbfe3436be9f9",
        "OpenScriptures-LexicalIndex:due":
          "4de6a4ad55b14b825bc87d3096d0ddc3bae10fd0af964429c91e8c04ba9cff08",
        "STEP-gloss-anchor:14287":
          "3d70eb0fdb66b930ac072bed020761752a23ea6372f14cc1541b4d2a6f015bb9"
      },
      occurrenceProof: {
        count: 110,
        occurrenceCorpusDigest:
          "ad8001c4d2ef70a6b473e5ee20237da08e11c417d3f9a11ed8b18fb9073e55df"
      }
    },
    {
      key: "H2428G",
      identity: {
        stepEntryId: 14289,
        eStrong: "H2428a",
        dStrong: "H2428G =",
        uStrong: "H2428G"
      },
      input: {
        stepGloss: "strength",
        stepGlossDigest:
          "e6b88623f7209b6c11fc49805c68752941074f4bc5eddd8c33bcdffc5419420d",
        candidateRecordDigest:
          "fbfd1a3296d3d1926ee3ce65c8a841c321e2015173ee7116dc9cc546f6555b75",
        stepAnchorDigest:
          "ba25aefb81d8c7e3b8d7d84703a8aec5ec1f35853a2d60500259e5c61c161bb9"
      },
      decision: {
        finalAction: "keep_step",
        value: "strength",
        valueDigest:
          "e6b88623f7209b6c11fc49805c68752941074f4bc5eddd8c33bcdffc5419420d",
        reason:
          "The base disambiguated sense and 91 TAHOT occurrences support strength.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H2428":
          "987c893057a4717f4e843c1364b7f28d4d6eb3d6a3fccc970a0dbfe3436be9f9",
        "OpenScriptures-LexicalIndex:due":
          "4de6a4ad55b14b825bc87d3096d0ddc3bae10fd0af964429c91e8c04ba9cff08",
        "STEP-gloss-anchor:14289":
          "ba25aefb81d8c7e3b8d7d84703a8aec5ec1f35853a2d60500259e5c61c161bb9"
      },
      occurrenceProof: {
        count: 91,
        occurrenceCorpusDigest:
          "a9c13658aa6c8caec48841e5c8ed43a0d0dd8c2484b99c2aeb626ebffe8a7f64"
      }
    },
    {
      key: "H2495",
      identity: {
        stepEntryId: 14375,
        eStrong: "H2495",
        dStrong: "H2495 =",
        uStrong: "H2495"
      },
      input: {
        stepGloss: "mallow",
        stepGlossDigest:
          "b3af2d2033225bb482d0acb0897ed7199d347be0921279dfbefc0fe9587b5582",
        candidateRecordDigest:
          "cefdf228c4300f59b4502d747c26c7de73aa40e66d5130b71c0ad4989c62b0e8",
        stepAnchorDigest:
          "e44a13840133efae2306b55c33d50c3da54946a12f9cb209e5fae974f370d98c"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "purslane",
        valueDigest:
          "10cf316c124d98cf35a58dda0d7c963db13937d4ce22e72e9b9606c3f3052017",
        reason:
          "Exact lexical/BDB identity and the sole TAHOT occurrence support purslane.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:h.cv.ac":
          "4dc745d5e09f2d7ed1053a2b5d307332b6b3600476230c4ac3dba818c60bc680",
        "OpenScriptures-HebrewStrong:H2495":
          "49f2480a2df7a8bbe1b62106eceedc0e8deeeb2415cc0a38f5cd4bb2cfc390b3",
        "OpenScriptures-LexicalIndex:dxe":
          "b225bd4eed03da5d68f1e9a75f5c56fdc5a8250e9e504c6a15ce9a1e9fb150ad",
        "STEP-gloss-anchor:14375":
          "e44a13840133efae2306b55c33d50c3da54946a12f9cb209e5fae974f370d98c"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "38a4f970f48cc2dbc359f765af3ecf199b250d794bd61a23b42620a4dea22213"
      }
    },
    {
      key: "H2654B",
      identity: {
        stepEntryId: 14600,
        eStrong: "H2654b",
        dStrong: "H2654B =",
        uStrong: "H2654B"
      },
      input: {
        stepGloss: "to sway",
        stepGlossDigest:
          "d562e45d712a54902c6151e720a92aebee57b52df7a81aaecead52e9beb58b88",
        candidateRecordDigest:
          "bcd86381d5c54aa27be8e73586597e6acf765b13830e985f9422c2309c4ac7f8",
        stepAnchorDigest:
          "6c4b7c2ac19182d50edad7c46a44005962ce16ad223be392213a26fe5e227406"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "to stiffen",
        valueDigest:
          "1a732a56155fea74f74852d2a61631209b809325cb0cc87e2133ed851126c98c",
        reason:
          "The only exact dStrong occurrence is rendered stiffens; keep bend/sway and hapax uncertainty in meaning.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H2654b":
          "780c1b7c1027f08c99b987dd5fc6ba08804d066d02564d7c3957c114833d149d",
        "OpenScriptures-BrownDriverBriggs:h.er.aa":
          "30484e01add948b1ea0a437ff97c1048532bd7b8481cd26dea10f319e76f91d2",
        "OpenScriptures-HebrewStrong:H2654":
          "6fbc30ad0bb115539d5560cb51df31dcf7aff3380f0a05d4f7a1ef246d5d177f",
        "OpenScriptures-LexicalIndex:eee":
          "270b4160fc928c488601e828c3349318d4d4d535c555601db7387a851f24e276",
        "STEP-gloss-anchor:14600":
          "6c4b7c2ac19182d50edad7c46a44005962ce16ad223be392213a26fe5e227406"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "89a8facd0a2d31a284903fb6efd5463bbdfe582ecfb4d7d9b24866c531b7800b"
      }
    },
    {
      key: "H2791B",
      identity: {
        stepEntryId: 14777,
        eStrong: "H2791b",
        dStrong: "H2791B =",
        uStrong: "H2791B"
      },
      input: {
        stepGloss: "craftily",
        stepGlossDigest:
          "61a382545d3f78c548882d3c4a54cc594f747e6b45d557fb2d12ca6124e26340",
        candidateRecordDigest:
          "6d232521aba9b4bd89fca1a012704833cfb51b9a82e1b352c273744940af31be",
        stepAnchorDigest:
          "08c3c225e6fced12ab3c02427b0c32ff4268fe42e79b54b6160709dd9864ce73"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "magic art",
        valueDigest:
          "2f30d5c2c5f72b634b5f8afb917b1eaeaca25e87cd328c7c2e011b90eb3bd5b2",
        reason:
          "Exact lexical definition and the sole TAHOT occurrence support magic art.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H2791b":
          "ab8a09cac13427630fc9eb6b0ac21eeb5d4008adbdcd768068673bd8c600b7fe",
        "OpenScriptures-BrownDriverBriggs:h.gn.ab":
          "ab1165f44a07b188df3f8af945476c78e2053da21a0a9792ecd52a0c81c7142f",
        "OpenScriptures-HebrewStrong:H2791":
          "c58860a8029377ae40f7190c7eba6a78e47cd244c88b66b862a8fabe57216b87",
        "OpenScriptures-LexicalIndex:ekr":
          "724de45b600074684ee8893e071141e37f5c33ece24adedab423ecccc8078224",
        "STEP-gloss-anchor:14777":
          "08c3c225e6fced12ab3c02427b0c32ff4268fe42e79b54b6160709dd9864ce73"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "e6f9485384440c82854e079e9649c91bafaa9db7f785d86d5902f593c43a393c"
      }
    },
    {
      key: "H2844B",
      identity: {
        stepEntryId: 14852,
        eStrong: "H2844b",
        dStrong: "H2844B =",
        uStrong: "H2844B"
      },
      input: {
        stepGloss: "shattered",
        stepGlossDigest:
          "9eb95674b4cc09f2f216d86e32990d78e1f6b622c43f84f7fc8ab815ebdca780",
        candidateRecordDigest:
          "5d7805e69a8031879ea6b3001bd2f735827a2f21d65444e0ef4716e2d740bfec",
        stepAnchorDigest:
          "5cfaeb5d5146c82a071b8face59ee44e4442e573d0b2dedccedb296f1b034fd3"
      },
      decision: {
        finalAction: "keep_step",
        value: "shattered",
        valueDigest:
          "9eb95674b4cc09f2f216d86e32990d78e1f6b622c43f84f7fc8ab815ebdca780",
        reason:
          "Exact TAHOT occurrences and HebrewStrong support shattered/dismayed; POS mismatch is external.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H2844b":
          "f2845c300987a439f2fb50cbe77ceaf0ea0abaf5ce802bcb6f6ba8339393793c",
        "OpenScriptures-BrownDriverBriggs:h.hf.ac":
          "7e17e23ab600064f3867dd0cd180a03ad34217894064b73d1079077d52002bcc",
        "OpenScriptures-HebrewStrong:H2844":
          "fe407a95093ee7884d02984750733210095c94180f1075295104130ce9788397",
        "OpenScriptures-LexicalIndex:ena":
          "796be8aaa7e30cf7dbab4b83c869567510a542805656e7cd609f54c5952d55bb",
        "STEP-gloss-anchor:14852":
          "5cfaeb5d5146c82a071b8face59ee44e4442e573d0b2dedccedb296f1b034fd3"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "936988d9e8dcf61b603af03e5cb2d275f529a1e01d1d9e8bd7977cefd645d7fe"
      }
    },
    {
      key: "H2933",
      identity: {
        stepEntryId: 14952,
        eStrong: "H2933",
        dStrong: "H2933 =",
        uStrong: "H2933"
      },
      input: {
        stepGloss: "to defile",
        stepGlossDigest:
          "a39cac3520b87a01791d5323bd39483d0f4959c8d5fd042f63d3f5313a3142a4",
        candidateRecordDigest:
          "d93619e28e046538744315d89374959752b0de71bc3b2a33ab6acee82eab50e9",
        stepAnchorDigest:
          "1a69b783974752456f6a4683e34914cf7c51505166a19d0b173dc985e5b8318f"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "to be considered stupid",
        valueDigest:
          "c54da6532a33404a4896b94dee8f96575e0fbe5a17ea1ad4af5350d4df4c772d",
        reason:
          "The sole exact TAHOT occurrence and exact BDB context support this Niphal sense; traditional unclean/defile belongs in meaning.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:i.az.aa":
          "68618422ecbf0756e47b5cacffd6ad4d7fcfe0370d0acd7884d9fa9b46df11ef",
        "OpenScriptures-HebrewStrong:H2933":
          "e23a88bad65ee04fcfa33cf29c24e83bc3467a83520a02d2f50bc67c2e80c8a6",
        "OpenScriptures-LexicalIndex:eqv":
          "b39ffe94b8a671d0198b149cf03c18024fc6114571254193ff3ffc972b21e197",
        "STEP-gloss-anchor:14952":
          "1a69b783974752456f6a4683e34914cf7c51505166a19d0b173dc985e5b8318f"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "607bfde7439ce7ebc134ac90e4e5ecc33d58707a14e467a14a4ff1d7f2fec21c"
      }
    },
    {
      key: "H3039B",
      identity: {
        stepEntryId: 15095,
        eStrong: "H3039b",
        dStrong: "H3039B =",
        uStrong: "H3039B"
      },
      input: {
        stepGloss: "love",
        stepGlossDigest:
          "686f746a95b6f836d7d70567c302c3f9ebb5ee0def3d1220ee9d4e9f34f5e131",
        candidateRecordDigest:
          "777e99798cdac31a8394f66dc3b0010d92110d4cd81da0271bbbebe760c9e29e",
        stepAnchorDigest:
          "a3b21d88ee5ddbc5324a247c4a0baa24f75bcb90e9b4bf696a1a6e89de0b5c64"
      },
      decision: {
        finalAction: "keep_step",
        value: "love",
        valueDigest:
          "686f746a95b6f836d7d70567c302c3f9ebb5ee0def3d1220ee9d4e9f34f5e131",
        reason:
          "The sole exact occurrence and STEP sense support love despite the external spelling mismatch.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H3039b":
          "2d5b37a4a97bd24717256dc28a26e9d1fef8e0227be0225bf9632b66fd6afe78",
        "OpenScriptures-BrownDriverBriggs:j.as.ab":
          "b4ceb670518f649f57c4cdc2f98cc5f4a73a08c6653f2e86ce5f5c8bf633517f",
        "OpenScriptures-HebrewStrong:H3039":
          "d8ee1f62ee108e84a8e716df661ebb7f233980da79869874d26986ecdf92bcc8",
        "OpenScriptures-LexicalIndex:eur":
          "d062488698ad2d4ee277ea23322df96e7d3a2e821751c598e8ca80067016012c",
        "STEP-gloss-anchor:15095":
          "a3b21d88ee5ddbc5324a247c4a0baa24f75bcb90e9b4bf696a1a6e89de0b5c64"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "35e116d49c94723d091922fe11b6eee06af8bed01a2a87a612bcf7a57f681c2b"
      }
    },
    {
      key: "H3066G",
      identity: {
        stepEntryId: 15146,
        eStrong: "H3066",
        dStrong: "H3066G = a Spelling of",
        uStrong: "H3063G"
      },
      input: {
        stepGloss: "Judahite",
        stepGlossDigest:
          "b588dc65e00f5352f536615d6807cf0f7156f5a414fb388d17e6b94b8d43be21",
        candidateRecordDigest:
          "f94133dc579b10b31e514dc234c8e98b2e7b91cc10bb65cefc0f46b056a62629",
        stepAnchorDigest:
          "7fe5f6e9c838c64005ca9a58939c9d5ef082e717d4500da2dd3ee33546c047c5"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "Jewish",
        valueDigest:
          "24c22477e62eebee20d0fe36e5b9d68f40908d3456ff90588cef4e399d995cf6",
        reason:
          "HebrewStrong defines the adjectival language sense as Jewish; Judahite is the wrong lexical category.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H3066":
          "dbfd0d06c16bf09a58f642988ea73669ca5688ad9cc4688ac9941753d6339891",
        "OpenScriptures-LexicalIndex:evq":
          "105830e8480f56b14b4d0b0f3cddf7ec315b347a7e21708a852725c687aab7b9",
        "STEP-gloss-anchor:15146":
          "7fe5f6e9c838c64005ca9a58939c9d5ef082e717d4500da2dd3ee33546c047c5"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "9d294d296dd7282a37c670ff6e3c8afb0a5977c7bf03dd86c3fb58f7bc344a92"
      }
    },
    {
      key: "H3491",
      identity: {
        stepEntryId: 15861,
        eStrong: "H3491",
        dStrong: "H3491 =",
        uStrong: "H3491"
      },
      input: {
        stepGloss: "remainder",
        stepGlossDigest:
          "9fad7c57062b0877f515b5c43c233a1f3489b3e2943dce0500059b9276039993",
        candidateRecordDigest:
          "7b532bfcd277017857793d93d053c728a4fcc29675881c10da717f86b7910148",
        stepAnchorDigest:
          "68ce450d66dac74fbf20b1454a40dbf6012b4143e17750108ce08cd02cae1fb0"
      },
      decision: {
        finalAction: "keep_step",
        value: "remainder",
        valueDigest:
          "9fad7c57062b0877f515b5c43c233a1f3489b3e2943dce0500059b9276039993",
        reason:
          "HebrewStrong supports what is left; the searching occurrence is primarily H8446 and remains an alternate in meaning.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:w.al.ac":
          "f6c5c5a167c3c17c990a88aaaac354b4a0ad620d55e8572da33145a104f293e9",
        "OpenScriptures-HebrewStrong:H3491":
          "52b0573a7dc5c46f568c5a1547e4a181c4b0f38bf2fe3ff4957f056ca123bce1",
        "OpenScriptures-LexicalIndex:fmr":
          "7c2134cc8361b9113419c2ae78bbb34fc611bdaa71857f0c7a09e2d25cade52c",
        "STEP-gloss-anchor:15861":
          "68ce450d66dac74fbf20b1454a40dbf6012b4143e17750108ce08cd02cae1fb0"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "57bd7795ffeb5bde84ba673707670b986d4971c19740415b422e8f9ddca76618"
      }
    },
    {
      key: "H3651A",
      identity: {
        stepEntryId: 16062,
        eStrong: "H3651a",
        dStrong: "H3651A = a Meaning of",
        uStrong: "H3651C"
      },
      input: {
        stepGloss: "right",
        stepGlossDigest:
          "27042f4e6eca7d0b2a7ee4026df2ecfa51d3339e6d122aa099118ecd8563bad9",
        candidateRecordDigest:
          "99f97943ba16ee0c4f37cb5caf7fe281a21913e83691d3490b2128e4f9976bd9",
        stepAnchorDigest:
          "99abfe62c7ba837fd1bcc475de3a2e94ed6470474a03965e86d395cb739bf9b8"
      },
      decision: {
        finalAction: "keep_step",
        value: "right",
        valueDigest:
          "27042f4e6eca7d0b2a7ee4026df2ecfa51d3339e6d122aa099118ecd8563bad9",
        reason:
          "Exact TAHOT occurrences and source meaning support the STEP sub-sense.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H3651a":
          "28330c008c3a597b3aab28fd0450dfbf46bea9d159956551733fbb6fc772ed77",
        "OpenScriptures-BrownDriverBriggs:k.aw.ab":
          "17782b6c0c222f53cc425fd815b2dda1de08daf171197189afc46c50cd81da87",
        "OpenScriptures-HebrewStrong:H3651":
          "8220fb7b796cddd1a8af2d8c1eed5cbc78c125d2ecc067f7dd8d803a3d391ae8",
        "OpenScriptures-LexicalIndex:fud":
          "dd09cbf936aea68f9b216cc4825af20f9c4b5d39991bba04f40613aef7600a37",
        "STEP-gloss-anchor:16062":
          "99abfe62c7ba837fd1bcc475de3a2e94ed6470474a03965e86d395cb739bf9b8"
      },
      occurrenceProof: {
        count: 22,
        occurrenceCorpusDigest:
          "f730904ed71f770cd2862f420dd1ccf400a0ec93539e48311f074481ee44bcd4"
      }
    },
    {
      key: "H3651B",
      identity: {
        stepEntryId: 16063,
        eStrong: "H3651b",
        dStrong: "H3651B = a Meaning of",
        uStrong: "H3588A"
      },
      input: {
        stepGloss: "as",
        stepGlossDigest:
          "f4bf9f7fcbedaba0392f108c59d8f4a38b3838efb64877380171b54475c2ade8",
        candidateRecordDigest:
          "22ded2b60d96dc69485425633bba11593e5edd2f49bafb52d9939f1790a88a10",
        stepAnchorDigest:
          "b55a6dcd66f63282cec428da52a88b6c44a510957135a4a31690171e14b7078f"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "since",
        valueDigest:
          "6b5a3ded016ab78269898c6e38d09f71e71e9311d53569f668e76378de0a798a",
        reason:
          "The exact phrase and all ten TAHOT occurrences support since/forasmuch as, not bare as.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H3651b":
          "ab83024e039a4e3f0323803430513ad7688a6c476d0af59dc79b00bfa2ca253b",
        "OpenScriptures-BrownDriverBriggs:k.bg.ac":
          "360e9e00b17a568a8173dba2e06c2223d6c7ad0edc864afa7b460cb6336d499e",
        "OpenScriptures-HebrewStrong:H3651":
          "8220fb7b796cddd1a8af2d8c1eed5cbc78c125d2ecc067f7dd8d803a3d391ae8",
        "OpenScriptures-LexicalIndex:fri":
          "a5164f0112bafa512229fef31e63fe43acc7534215cb6d1e75082b2ef99d19b4",
        "STEP-gloss-anchor:16063":
          "b55a6dcd66f63282cec428da52a88b6c44a510957135a4a31690171e14b7078f"
      },
      occurrenceProof: {
        count: 10,
        occurrenceCorpusDigest:
          "64be37ff7b8e8d23549402f4c8fcddc12348c4334f89a5887cc1c72abd18990f"
      }
    },
    {
      key: "H3651C",
      identity: {
        stepEntryId: 16064,
        eStrong: "H3651c",
        dStrong: "H3651C =",
        uStrong: "H3651C"
      },
      input: {
        stepGloss: "so",
        stepGlossDigest:
          "a1d9890884c1b4b960c279cfe7554a900d169422d6cec980beef67761487d3b9",
        candidateRecordDigest:
          "6147d118f1b46dc8eed0002a8be73ddd237fe443c804164177f736181099255d",
        stepAnchorDigest:
          "5ab11125f2755f056895f41dfeaf77583834bc50355f2d2dc597d6111a2f2541"
      },
      decision: {
        finalAction: "keep_step",
        value: "so",
        valueDigest:
          "a1d9890884c1b4b960c279cfe7554a900d169422d6cec980beef67761487d3b9",
        reason: "Hundreds of exact TAHOT occurrences support the STEP gloss.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H3651c":
          "a1b60b99e191348115bad854c1aa5beff4b95bdc5d1edab9a0a66ad119349ef4",
        "OpenScriptures-BrownDriverBriggs:k.by.aa":
          "d2a8fcb7e70ccc7f62236a33e9ba1272d6bf870bea2e992389a18934e0256b66",
        "OpenScriptures-HebrewStrong:H3651":
          "8220fb7b796cddd1a8af2d8c1eed5cbc78c125d2ecc067f7dd8d803a3d391ae8",
        "OpenScriptures-LexicalIndex:fug":
          "130bce9eaa728773f05322468a5d807aafea8fcf363c959261d130596f7ac6a9",
        "STEP-gloss-anchor:16064":
          "5ab11125f2755f056895f41dfeaf77583834bc50355f2d2dc597d6111a2f2541"
      },
      occurrenceProof: {
        count: 739,
        occurrenceCorpusDigest:
          "3a99b15a312f89aa7aa10cbaa7e5d8eb16323c857b88f2ca715849a764a71134"
      }
    },
    {
      key: "H4154",
      identity: {
        stepEntryId: 16665,
        eStrong: "H4154",
        dStrong: "H4154 =",
        uStrong: "H4154"
      },
      input: {
        stepGloss: "disjointed",
        stepGlossDigest:
          "57efa5da8fc0c2d70d1a68e3e1304a7762914a1caa4aa4a770d41e6125006dc7",
        candidateRecordDigest:
          "ce0c2ffa3d304934037fe8675bae03780c0458a80676654149f88bee5b0ee606",
        stepAnchorDigest:
          "eea718fb08b3bc57dc28007dd8ec0bfbf92fe108f361a5f1e6cd6a76f9258dba"
      },
      decision: {
        finalAction: "keep_step",
        value: "disjointed",
        valueDigest:
          "57efa5da8fc0c2d70d1a68e3e1304a7762914a1caa4aa4a770d41e6125006dc7",
        reason:
          "HebrewStrong exactly supports dislocated/out of joint; the BDB slip definition is compatible context.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:m.cu.aa":
          "fe1562c6b2649d1324ac1bb47239af3dce65151f30e17ab8acc39f90d5acf71f",
        "OpenScriptures-HebrewStrong:H4154":
          "993827fbcad50940e9e4d2605482776540e19479675a79236f809d3efe3794f4",
        "OpenScriptures-LexicalIndex:gph":
          "97ccf9dec62743551363967f4e4f6aea0c8015e776238bb62e8be3c41de15e85",
        "STEP-gloss-anchor:16665":
          "eea718fb08b3bc57dc28007dd8ec0bfbf92fe108f361a5f1e6cd6a76f9258dba"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "c37abf03353d7e5de2d30fbf8ae91e56788feadce9369dfa612f822b30e1cc18"
      }
    },
    {
      key: "H4360",
      identity: {
        stepEntryId: 16924,
        eStrong: "H4360",
        dStrong: "H4360 =",
        uStrong: "H4360"
      },
      input: {
        stepGloss: "perfection",
        stepGlossDigest:
          "0b1d44d9f5fdb42391db184c2dd83405a3a6881055a62a8a89e749ae7c5b4f8a",
        candidateRecordDigest:
          "803af3198408c367216276589056761a4c73dbaa8a7587182f9be007d6ffe374",
        stepAnchorDigest:
          "0019b211ee9a59d21f214bda9501ac2a6f0aa22c5e2bb0490f3612ea369b6067"
      },
      decision: {
        finalAction: "keep_step",
        value: "perfection",
        valueDigest:
          "0b1d44d9f5fdb42391db184c2dd83405a3a6881055a62a8a89e749ae7c5b4f8a",
        reason:
          "HebrewStrong supports something perfect; garment nuance remains in meaning.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:k.bn.ae":
          "94a99b8d3f2e97ffa8ef819b8dff0da299a0f904009154041d1a97c8b3bf20fa",
        "OpenScriptures-HebrewStrong:H4360":
          "d664eafcc13610857630924dc878221ceda6d763325411f77437fe9e5cc6ddce",
        "OpenScriptures-LexicalIndex:gxo":
          "6ce543777841876745b52f584de032a5a900dc442290149b529388f13f0fa85e",
        "STEP-gloss-anchor:16924":
          "0019b211ee9a59d21f214bda9501ac2a6f0aa22c5e2bb0490f3612ea369b6067"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "291f029911f5aa27b2a7b30a4e30ae16a4c9412f6cd6c30ef182a30396390e47"
      }
    },
    {
      key: "H4441J",
      identity: {
        stepEntryId: 17027,
        eStrong: "H4441",
        dStrong: "H4441J =",
        uStrong: "H4441J"
      },
      input: {
        stepGloss: "Hashabiah",
        stepGlossDigest:
          "f748793c68d0dd41b36ef0cde1bb70d972ee5cbb3730553784fbf7fea2363325",
        candidateRecordDigest:
          "805127bd97faf3f0870d508b5fbca2d2b0a522b427c504ce07cad1ee0b130de9",
        stepAnchorDigest:
          "38fad122e73c1d0905ad1084fe6c2365ca8fb94a2df96aafc5c5688553bccf4a"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "Malkijah",
        valueDigest:
          "bf2fcaca89f0a0d82ddcca42402986f7ca65d47d0ef45a9444e901c39a775bd5",
        reason:
          "HebrewStrong and the exact TAHOT occurrence support Malkijah; Hashabiah is a wrong-name attachment.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H4441":
          "825eec49e997696d1f6006cde3b82d4ce80bf07c29a3a77d103c281082787acd",
        "OpenScriptures-LexicalIndex:haq":
          "6c839572a9413190e6e40e5e2b129c87cd841f4233fc1adbfc43ebf8d18da1cb",
        "STEP-gloss-anchor:17027":
          "38fad122e73c1d0905ad1084fe6c2365ca8fb94a2df96aafc5c5688553bccf4a"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "8a31f5fc6a0b964a6809dd20f9221126dff70463f9523c3afc53841333dabcc1"
      }
    },
    {
      key: "H4473",
      identity: {
        stepEntryId: 17072,
        eStrong: "H4473",
        dStrong: "H4473 =",
        uStrong: "H4473"
      },
      input: {
        stepGloss: "expanded",
        stepGlossDigest:
          "691661b386fd34d08d9e14f20e3a4dffa5d74f03492e3a7ce8a6e648d25a28a3",
        candidateRecordDigest:
          "eb0e06b7c70618de963133c2fd2c36819af9af145c56d545296ea6216a18a121",
        stepAnchorDigest:
          "4aae5d09be7f2601627d733b89c6aaa34366ee3f3d8207c4c13fc5c51b4c609a"
      },
      decision: {
        finalAction: "keep_step",
        value: "expanded",
        valueDigest:
          "691661b386fd34d08d9e14f20e3a4dffa5d74f03492e3a7ce8a6e648d25a28a3",
        reason:
          "HebrewStrong expansion/outspread and the exact occurrence support the STEP gloss.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:m.dt.ae":
          "1ce727faadbb302b455c200bdf2fc8d216c98034aeca06918133a96bc899f054",
        "OpenScriptures-HebrewStrong:H4473":
          "d4344abddee25255fcb1de5f04e311fc0838ddb585da609d91a2ed5214391a8a",
        "OpenScriptures-LexicalIndex:hca":
          "14c1375b7854c310bf604d7acbacab803ba40894c731de58c3ca5714d273ee37",
        "STEP-gloss-anchor:17072":
          "4aae5d09be7f2601627d733b89c6aaa34366ee3f3d8207c4c13fc5c51b4c609a"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "b204dff7837c70f7ef400055b5fe50a249dc710a1b433b8e5932d9b1898754d0"
      }
    },
    {
      key: "H4478B",
      identity: {
        stepEntryId: 17078,
        eStrong: "H4478b",
        dStrong: "H4478B = a Spelling of",
        uStrong: "H4100"
      },
      input: {
        stepGloss: "What?",
        stepGlossDigest:
          "a4949e2c96de26681c9519749e57bfb362bbac2a8f40c89b24c35d1de111336d",
        candidateRecordDigest:
          "d6ba35d091da11c376d590a74a3789d39b112da8883cf9c8eb76e3b4fa438fa2",
        stepAnchorDigest:
          "9c9880e9fe4626a90277c9316cfb8eafb0d80e42203b2381f85eae0a4350f24a"
      },
      decision: {
        finalAction: "keep_step",
        value: "What?",
        valueDigest:
          "a4949e2c96de26681c9519749e57bfb362bbac2a8f40c89b24c35d1de111336d",
        reason:
          "The exact manna etymology and sole TAHOT occurrence support the interrogative gloss.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H4478b":
          "2c9c9ecb88c2428b82a1b8fb9481ec3b702c82642583ada7491c0763c5053f4f",
        "OpenScriptures-BrownDriverBriggs:m.ck.av":
          "da6f80f5ad58d0e373d55317e4bb441e8595a461292f81cf62c57cf41dd838a0",
        "OpenScriptures-HebrewStrong:H4100":
          "1a7e3de5e24139d55fb9be0484de3223cc22456e9a5a3fcc6f12a4a7b95c49da",
        "OpenScriptures-HebrewStrong:H4478":
          "d499d44c9d401255f06232f36aa7e2fffe608e57f416d0660ce48e4501e24b33",
        "OpenScriptures-LexicalIndex:hci":
          "5bf67ab4dbe3d93adc0228e7ea63242df72a00b800024434c374404a2571faee",
        "STEP-gloss-anchor:17078":
          "9c9880e9fe4626a90277c9316cfb8eafb0d80e42203b2381f85eae0a4350f24a"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "c22effe40cad4237b047aefd3c4c811d44b9a57f33800367e7e38d299fe25fff"
      }
    },
    {
      key: "H4535",
      identity: {
        stepEntryId: 17149,
        eStrong: "H4535",
        dStrong: "H4535 =",
        uStrong: "H4535"
      },
      input: {
        stepGloss: "defense",
        stepGlossDigest:
          "1b0b7e51ee5d8e25cc87c83d5b4fbe933d91e1a70f7ee27d98be29c348b04950",
        candidateRecordDigest:
          "1ba2eee415564995ba706bf42d3f6b3a95312ad54fe7736df1c8cef2fa140472",
        stepAnchorDigest:
          "9badb66ef5b0f8d40ee0878fc065aef848dec697e2ee04266d141a2cae6450ae"
      },
      decision: {
        finalAction: "keep_step",
        value: "defense",
        valueDigest:
          "1b0b7e51ee5d8e25cc87c83d5b4fbe933d91e1a70f7ee27d98be29c348b04950",
        reason:
          "BDB and HebrewStrong support defense/barrier; the hapax is uncertain and by-turns belongs in meaning.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:m.cq.ag":
          "142cfe6dad33077421e4112be28e75ce80f5a59d292ca43481cb61202ebe571b",
        "OpenScriptures-HebrewStrong:H4535":
          "1f31ad76eaeed96b66ee5eedad8c4df0371c1028d90095b28fa7e510b9de2bd5",
        "OpenScriptures-LexicalIndex:hei":
          "4d3de96a45f403f4f6bb614bb37663f99a47324d1aaa7266c8cbaa249e97c38a",
        "STEP-gloss-anchor:17149":
          "9badb66ef5b0f8d40ee0878fc065aef848dec697e2ee04266d141a2cae6450ae"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "9e1b11079d19fe4361de6e213f8ca89771986de5c3cf801604f1a30fb58e9eaa"
      }
    },
    {
      key: "H5289",
      identity: {
        stepEntryId: 18108,
        eStrong: "H5289",
        dStrong: "H5289 =",
        uStrong: "H5289"
      },
      input: {
        stepGloss: "newborn",
        stepGlossDigest:
          "5c546b1104f0330102ab0c2586737984b2b6ffcc7c99a2a4656411b0c15b347d",
        candidateRecordDigest:
          "6b4157d3ff33be1dd346a4cb232d2d71ffe55d78e583df2d01b66345ce5dea09",
        stepAnchorDigest:
          "a444fce58793e733ee734e84be6d1d7e130ce0b2fbfad84ee1a2519ce6e8bbfa"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "young one",
        valueDigest:
          "5af7ff88bce5c626034e449bfc9f5c34c96b85861c678422483fd104cc381240",
        reason:
          "HebrewStrong supports young one and TAHOT has young man; young one avoids falsely anthropomorphizing the flock context.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:n.eh.ab":
          "344ec2d64167c1061ce2dd6b1e215ba8cad530d39a3159ed75b003e55b5da8f5",
        "OpenScriptures-HebrewStrong:H5289":
          "cb57b11ccf7f0a116a8c11c6140c4c24decb51af58861636c4e520763069baa4",
        "OpenScriptures-LexicalIndex:ijm":
          "7568283ac0bec4930f29a2862f4d17475d3c21b338651144b780ad960269cfd9",
        "STEP-gloss-anchor:18108":
          "a444fce58793e733ee734e84be6d1d7e130ce0b2fbfad84ee1a2519ce6e8bbfa"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "65675d0d57b2a41c28326cda45b22d2219e288308f53cd12f5155567430602a9"
      }
    },
    {
      key: "H5531A",
      identity: {
        stepEntryId: 18456,
        eStrong: "H5531a",
        dStrong: "H5531A = a Spelling of",
        uStrong: "H5531B"
      },
      input: {
        stepGloss: "folly",
        stepGlossDigest:
          "73e8c05c078d7428e42e6a4bc3c8d0414000e279fdab8306eec7b95e53a9eb98",
        candidateRecordDigest:
          "d6420dc9c39b38c79ef25736ca0ae7e42cfb099b0decaa5ba5063d6b053a5c16",
        stepAnchorDigest:
          "860898f3e9dd0fa1b38f965a293dc385461d6756f30dfd8a7fbbabbc84cb0954"
      },
      decision: {
        finalAction: "keep_step",
        value: "folly",
        valueDigest:
          "73e8c05c078d7428e42e6a4bc3c8d0414000e279fdab8306eec7b95e53a9eb98",
        reason:
          "The exact occurrence and HebrewStrong support folly despite external spelling mismatch.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H5531a":
          "1c4fc83979981fd153c191bf16633cce844c33dd5fe421a144a6dc6134ee0be8",
        "OpenScriptures-BrownDriverBriggs:o.bc.ad":
          "8d5d35ebf7f5fd6273141089d51d597ed6ef56d89b19c879d7837530258a3b09",
        "OpenScriptures-HebrewStrong:H5531":
          "1eaf500ed5346645d6bb36ce3b94aa69b950543be92228ac04e58177f02b6d8c",
        "OpenScriptures-LexicalIndex:itw":
          "22aa4cfbb2ef67a6f17bd15af3bb60f4ad7f0bbec0e1a28db49ded379aefb51b",
        "STEP-gloss-anchor:18456":
          "860898f3e9dd0fa1b38f965a293dc385461d6756f30dfd8a7fbbabbc84cb0954"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "40d39e971e0553c5f369be0474d2261d0e98435c2240079fb393c93723547873"
      }
    },
    {
      key: "H5539",
      identity: {
        stepEntryId: 18466,
        eStrong: "H5539",
        dStrong: "H5539 =",
        uStrong: "H5539"
      },
      input: {
        stepGloss: "to rejoice",
        stepGlossDigest:
          "b540c5af782933ab507327edc7c6e62e92e2550fc5be7209d1e2463737707f45",
        candidateRecordDigest:
          "bf8a8eb34d210e5cc317402b8bf456c3fa99621c921e4ed9e690a238e94d6638",
        stepAnchorDigest:
          "b284466fc9dc6f49ce5b5a463987826316d57e5d82f0031b6b28d1ba8d6cd20c"
      },
      decision: {
        finalAction: "keep_step",
        value: "to rejoice",
        valueDigest:
          "b540c5af782933ab507327edc7c6e62e92e2550fc5be7209d1e2463737707f45",
        reason:
          "HebrewStrong supports leap with joy/exult; TAHOT jump and BDB spring are compatible occurrence nuances.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:o.bk.aa":
          "0d4174c528872eb5f773cca5387d6cc9cfb49cdf620d3f031de78c2baa0c660f",
        "OpenScriptures-HebrewStrong:H5539":
          "e69099b630f6e659773a645aeb40748e461abc526acfc877b04de4868b131543",
        "OpenScriptures-LexicalIndex:iuh":
          "59d283adcdf3893dfbb131db11db9261a0bdf4b411d8755e4977a409b56768c5",
        "STEP-gloss-anchor:18466":
          "b284466fc9dc6f49ce5b5a463987826316d57e5d82f0031b6b28d1ba8d6cd20c"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "78c70ecb8c36af38359e30670b5586b87a80b2b15298c513fc8db621fd381896"
      }
    },
    {
      key: "H5822",
      identity: {
        stepEntryId: 18889,
        eStrong: "H5822",
        dStrong: "H5822 =",
        uStrong: "H5822"
      },
      input: {
        stepGloss: "vulture",
        stepGlossDigest:
          "e98841308f569acde044b24df7f61a8749cb797dba6524227b669b9c3aae205d",
        candidateRecordDigest:
          "68eb67b18b7a06b4dd9622ed90ca51ef12c52fba553785887876b31115164077",
        stepAnchorDigest:
          "907567c3963406827d291d5149a81e78524d1604c88dccf427c13c881a80671c"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        value: "bird of prey",
        valueDigest:
          "43e79a2d10ec786c81e3d757e61e1d6f942b11f857cfef2a3b216c3b34f6299b",
        reason:
          "Vulture, osprey, sea-eagle, and black-vulture identifications vary; bird of prey is the exact common denominator.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:p.bx.aw":
          "4547a92798f255b2c5a593547bf1c0c12474adb9b7e18ae1b2301a097b519588",
        "OpenScriptures-HebrewStrong:H5822":
          "a96bb96606e99284e42d95093ed944d7e0f0f4dadee329697cc4b6414585ebc8",
        "OpenScriptures-LexicalIndex:jgj":
          "ad307651d7e95bdbf003e1edd836896f5bba9fe1a71d582f35b77157794646f2",
        "STEP-gloss-anchor:18889":
          "907567c3963406827d291d5149a81e78524d1604c88dccf427c13c881a80671c"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "314e99e0ab09b22e3862b63d940da682d8a48788185ac3a64b7cd982063c7d87"
      }
    },
    {
      key: "H5921B",
      identity: {
        stepEntryId: 19068,
        eStrong: "H5921b",
        dStrong: "H5921B = a Meaning of",
        uStrong: "H3588A"
      },
      input: {
        stepGloss: "as",
        stepGlossDigest:
          "f4bf9f7fcbedaba0392f108c59d8f4a38b3838efb64877380171b54475c2ade8",
        candidateRecordDigest:
          "096529c9e486f6dd22cf7ce533316d4caa2a5f9f6aab1b65af2328e2ee5c7b29",
        stepAnchorDigest:
          "8ae72b73e17d44a40bef26de500a2a192e818a6aab418baa3520a1dba6d9a811"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "since",
        valueDigest:
          "6b5a3ded016ab78269898c6e38d09f71e71e9311d53569f668e76378de0a798a",
        reason:
          "The exact phrase and all ten TAHOT occurrences support since/forasmuch as, not bare as.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H5921b":
          "a0a2124a592300c59aa63424b9225b05fcd0ff506b2f183861a117a76ffad13e",
        "OpenScriptures-BrownDriverBriggs:k.bg.ac":
          "360e9e00b17a568a8173dba2e06c2223d6c7ad0edc864afa7b460cb6336d499e",
        "OpenScriptures-HebrewStrong:H5921":
          "6c10c55a782202a07c1c1ac88ec743e0eab13b5cc1961767164df65962a3aab8",
        "OpenScriptures-LexicalIndex:frj":
          "bdf3ae77efd0a6aa0f33a5fe5f9de5a1f635f7c9edb00b2312b6955270de7651",
        "STEP-gloss-anchor:19068":
          "8ae72b73e17d44a40bef26de500a2a192e818a6aab418baa3520a1dba6d9a811"
      },
      occurrenceProof: {
        count: 10,
        occurrenceCorpusDigest:
          "b775c0f1147db3cedd79243e2143dc425330981a4d8daf379cc22d2eb1542b20"
      }
    },
    {
      key: "H6169",
      identity: {
        stepEntryId: 19426,
        eStrong: "H6169",
        dStrong: "H6169 =",
        uStrong: "H6169"
      },
      input: {
        stepGloss: "bulrush",
        stepGlossDigest:
          "aa4cb4535ff84584346e9b9ab3f0f5f6a8a3576805077874ef1fda67baa61500",
        candidateRecordDigest:
          "2c4f02588fca9fffa21632785c3c040c267b69a2f252782ba1d2d0e18c43b741",
        stepAnchorDigest:
          "bb898f836168086665accf1ead64a8c947970320fd0bc557068cfa7093f9cd84"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "reed",
        valueDigest:
          "d8252e5d78f9b929a157d4cd7e19ccf4a8adff7c4a7aa442fb84a3ecf8138ac9",
        reason:
          "HebrewStrong usage and the sole TAHOT occurrence support reed; bulrush is overly specific.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:p.fi.ab":
          "cb75f7ec7e6d2e969993c346d3a19e3aa04968f38ac04e9178bc02241c9008b2",
        "OpenScriptures-HebrewStrong:H6169":
          "36dabcaea88e91e25200606b3615fdd2bdc0dc36b8464629fdde32bc3d5af47e",
        "OpenScriptures-LexicalIndex:jvj":
          "4c3b4527f74e4b63d90a8f923aca23a416b4239db05b2c0df05af67833af9ce7",
        "STEP-gloss-anchor:19426":
          "bb898f836168086665accf1ead64a8c947970320fd0bc557068cfa7093f9cd84"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "c72bd61fc976e76922c720daa0fb597bddadd27ccb32c096d39da97453a1f8ad"
      }
    },
    {
      key: "H6289",
      identity: {
        stepEntryId: 19573,
        eStrong: "H6289",
        dStrong: "H6289 =",
        uStrong: "H6289"
      },
      input: {
        stepGloss: "pale",
        stepGlossDigest:
          "3e6805d9e6f7212aec46b462f2a6a6695ca11e5fe710ef2ea7e0fa36557e9c8e",
        candidateRecordDigest:
          "a8b8bfe9c8c32d20e3e577d0635cb4b8358be125f067524a42356e12aff9bf62",
        stepAnchorDigest:
          "8bf1462732efc81b175bb69777775e6fc594df1f4bd96ee4323db004b3e6fd76"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "glow",
        valueDigest:
          "d27608cca9b65f91aef225be8ce8d50de8474b36d5bdbae15ab3ff9c5dca7187",
        reason:
          "HebrewStrong exact meaning and both TAHOT occurrences support glow; pale is contradicted.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:q.ad.ae":
          "9ca661d66df2a217dae8e990c604b064489f0935ba9ecf4acd08163daa684040",
        "OpenScriptures-HebrewStrong:H6289":
          "801b871ea10db316d034ad7afeabc4e2411ccf9d156a71c530c9ee93bfbbb95c",
        "OpenScriptures-LexicalIndex:kam":
          "1e7b58460f5280b5b366e97b240006a8f44d2e147fd3550709abb7249fd48856",
        "STEP-gloss-anchor:19573":
          "8bf1462732efc81b175bb69777775e6fc594df1f4bd96ee4323db004b3e6fd76"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "62c8c61826e196c1e69ca719694ce2097c03a199fb708867547f7820580803b0"
      }
    },
    {
      key: "H6612A",
      identity: {
        stepEntryId: 19986,
        eStrong: "H6612a",
        dStrong: "H6612A =",
        uStrong: "H6612A"
      },
      input: {
        stepGloss: "simple",
        stepGlossDigest:
          "a7a39b72f29718e653e73503210fbb597057b7a1c77d1fe321a1afcff041d4e1",
        candidateRecordDigest:
          "4920d2a61b78e4e1a1c6304b5e285dda94c7572e342d53b606be34156dfc120c",
        stepAnchorDigest:
          "d25e5370d7abde5ef3f6ea1ed6a81eac0caca25bbd7ea779fddb47f2221bf0c7"
      },
      decision: {
        finalAction: "keep_step",
        value: "simple",
        valueDigest:
          "a7a39b72f29718e653e73503210fbb597057b7a1c77d1fe321a1afcff041d4e1",
        reason:
          "Eighteen TAHOT occurrences and HebrewStrong support simple/naive.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H6612a":
          "38d3967d04f5e7a1129d3baa2d7b32321830053fe74c989f501e0d00e9df24bc",
        "OpenScriptures-BrownDriverBriggs:q.dz.ab":
          "7ae8243921840d97eb1bdc35c157756e7302dbcd68fed5ce065d2fccadd59b97",
        "OpenScriptures-HebrewStrong:H6612":
          "089b284ce3cb5183f7e0e4042142c2309ce0d23eab8536803d27fbec3b7556ed",
        "OpenScriptures-LexicalIndex:knw":
          "c25c0e8d8a7b783bb9217a3193cedd16862932d24a9b44ff91b42f171d17f246",
        "STEP-gloss-anchor:19986":
          "d25e5370d7abde5ef3f6ea1ed6a81eac0caca25bbd7ea779fddb47f2221bf0c7"
      },
      occurrenceProof: {
        count: 18,
        occurrenceCorpusDigest:
          "4a9c1c87ba5e242ae19661fc2917e2c312fc6fb75d9ad40267a6d8c58132fc34"
      }
    },
    {
      key: "H6862C",
      identity: {
        stepEntryId: 20297,
        eStrong: "H6862c",
        dStrong: "H6862C =",
        uStrong: "H6862C"
      },
      input: {
        stepGloss: "enemy",
        stepGlossDigest:
          "6610cc55246908a68b83fd56d0b36411fc28559d85b90f7e30b9f0e21b86a730",
        candidateRecordDigest:
          "6bd746cf94965a4e02853ca7cb484fecd2e7a0d766f309c6f1be19f0ad121b75",
        stepAnchorDigest:
          "8bb855b81bc065ab921b844581e61c6f8e94ae3fe74d33afc6d753a673236b64"
      },
      decision: {
        finalAction: "keep_step",
        value: "enemy",
        valueDigest:
          "6610cc55246908a68b83fd56d0b36411fc28559d85b90f7e30b9f0e21b86a730",
        reason:
          "Sixty-nine exact TAHOT occurrences and HebrewStrong support enemy/adversary.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H6862c":
          "48f4822fb735d83e9113a76b265946b62cb6368356ab1e3ed455f504e72091d6",
        "OpenScriptures-BrownDriverBriggs:r.ea.ab":
          "aeb3118815546f79f35a9d0679b9714c19e4dcafd56772e8f5c683b4a0e4a523",
        "OpenScriptures-HebrewStrong:H6862":
          "d1e0539fc36d8ac561b4ed1e1797785758765d21bd99025b3d6fadb47b2979da",
        "OpenScriptures-LexicalIndex:lab":
          "d4b85a990f611ab1041b13d5c91e2a39bdb0727cfa3e4cad2e613e6f3119e847",
        "STEP-gloss-anchor:20297":
          "8bb855b81bc065ab921b844581e61c6f8e94ae3fe74d33afc6d753a673236b64"
      },
      occurrenceProof: {
        count: 69,
        occurrenceCorpusDigest:
          "d84eca5cc76d684e9db7da68cd57345ca6461bd02451dacf4527ee0ab5d40005"
      }
    },
    {
      key: "H6862D",
      identity: {
        stepEntryId: 20298,
        eStrong: "H6862d",
        dStrong: "H6862D =",
        uStrong: "H6862D"
      },
      input: {
        stepGloss: "hard",
        stepGlossDigest:
          "ed5465b9220df9ce176d0bf30d6a317729bd9d37e4ae1cc015cb24c99af1df49",
        candidateRecordDigest:
          "a92d47404e5a39fd264f0bc67072b7bb743e1cbfbfe011a6729cb19f12018176",
        stepAnchorDigest:
          "7972714e3847c7a69900e9c44c8f4e75ac2c334c5ad79a1bf1627450df5ebc59"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "flint",
        valueDigest:
          "06cca3daa6a7169f98b52c406ddbb2db655f7557597fe9fa8762a29d57da7826",
        reason:
          "The exact subentry occurrence and HebrewStrong support flint; hard is only adjectival context.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H6862d":
          "b933d30beb82f72f4a616aa8ae66de95bd6f90a61ae7f0b40a81693ac50dcbe0",
        "OpenScriptures-BrownDriverBriggs:r.eb.ab":
          "62f8c4c0fd4b3703bf0f3cf72e284289a9b9695f7d87113b113e47ad955c5ba1",
        "OpenScriptures-HebrewStrong:H6862":
          "d1e0539fc36d8ac561b4ed1e1797785758765d21bd99025b3d6fadb47b2979da",
        "OpenScriptures-LexicalIndex:kzz":
          "adcc166f8495444dac2a452d59b355e3346a5a42068af7bfd844c1a1aac5a638",
        "STEP-gloss-anchor:20298":
          "7972714e3847c7a69900e9c44c8f4e75ac2c334c5ad79a1bf1627450df5ebc59"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "cb50a32637c3f2cff26f0dee2c08b185ce88fe0116c9dc3dee5d6061cda0a2ab"
      }
    },
    {
      key: "H6887A",
      identity: {
        stepEntryId: 20329,
        eStrong: "H6887a",
        dStrong: "H6887A = a Spelling of",
        uStrong: "H6696A"
      },
      input: {
        stepGloss: "to confine",
        stepGlossDigest:
          "fea636305afb962663a7fd21667d03770d5fd78bf0e65ecf8d94a2cd361a981e",
        candidateRecordDigest:
          "9f10e755aa5cd5d9ea6efff15e0f5e79fef71a3fdd511bcc965c359b0b47a9df",
        stepAnchorDigest:
          "7dc1f3e713af838fbe909270a23d9b42324083ac5d6a86705ba81216eb42a246"
      },
      decision: {
        finalAction: "keep_step",
        value: "to confine",
        valueDigest:
          "fea636305afb962663a7fd21667d03770d5fd78bf0e65ecf8d94a2cd361a981e",
        reason:
          "STEP spelling relation and HebrewStrong support confine/bind despite external spelling mismatch.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H6887a":
          "484c2ca6d84ec3b2347fa76076be147bfcf8d240282d804e275797e0c18e4068",
        "OpenScriptures-BrownDriverBriggs:r.bk.aa":
          "e628d1a241d882e729e5167a91ce94b18a1163e56b3c080f9274d807a6f9d470",
        "OpenScriptures-HebrewStrong:H6887":
          "49ecb97be633c3809e421a14162f9870161bfd9c2b058dd7e23f955ae7787098",
        "OpenScriptures-LexicalIndex:krz":
          "539ec54637fa33f2c66c4545502ce1f5980e0d17e337029ac55d810328df435d",
        "STEP-gloss-anchor:20329":
          "7dc1f3e713af838fbe909270a23d9b42324083ac5d6a86705ba81216eb42a246"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "a4bd82a233353f5027704914d5bee50644ef304c3ec8f8ec2ac4bc85ac71f956"
      }
    },
    {
      key: "H7192",
      identity: {
        stepEntryId: 20733,
        eStrong: "H7192",
        dStrong: "H7192 =",
        uStrong: "H7192"
      },
      input: {
        stepGloss: "coin",
        stepGlossDigest:
          "b3a1984ba0b1d8ad7f9dc881dfd9c9dc78c76c647a7692fbbfd6fcdcb9d9a121",
        candidateRecordDigest:
          "c57f4448652eef16a1585d23ebeedc44e8283c95d2d3785f254814370ddb81d6",
        stepAnchorDigest:
          "23bbc17599f3839deaf1706872b4e80cba1532018a82a9fdbf84c9ca7174e4ae"
      },
      decision: {
        finalAction: "keep_step",
        value: "coin",
        valueDigest:
          "b3a1984ba0b1d8ad7f9dc881dfd9c9dc78c76c647a7692fbbfd6fcdcb9d9a121",
        reason:
          "Three TAHOT occurrences say piece of money and HebrewStrong explains the stamped ingot/coin sense.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:s.do.ab":
          "b57f8a6568be6a9d875b77a91a8878c00f6266462dccbe0dad81e791cd188ffa",
        "OpenScriptures-HebrewStrong:H7192":
          "e828db83ba3be42a53b69b94d92fe61c0add0448f3e8ffdee6f1085f48cbe788",
        "OpenScriptures-LexicalIndex:loq":
          "31a34e450afb2df971cd8568d326fbad909f4b7951857300a1416b6e69758d94",
        "STEP-gloss-anchor:20733":
          "23bbc17599f3839deaf1706872b4e80cba1532018a82a9fdbf84c9ca7174e4ae"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "4cc470e0e7919ab295a29b08a6a3e6c481f028a5f5134c5f108464735ab4ab83"
      }
    },
    {
      key: "H7227A",
      identity: {
        stepEntryId: 20789,
        eStrong: "H7227a",
        dStrong: "H7227A =",
        uStrong: "H7227A"
      },
      input: {
        stepGloss: "many",
        stepGlossDigest:
          "1137b15c7797aa84ec24e8dca5cb966dd016624374a09cb2ecaa9ac3229f5ccc",
        candidateRecordDigest:
          "ff15006721c7d1f23c7216a0944bcb894ed3eae4c103db76f07b7a93d9a41098",
        stepAnchorDigest:
          "04fa884b64f72713bc49ae342e31b7b6bac4de34ac4ad625a16464304411caf5"
      },
      decision: {
        finalAction: "keep_step",
        value: "many",
        valueDigest:
          "1137b15c7797aa84ec24e8dca5cb966dd016624374a09cb2ecaa9ac3229f5ccc",
        reason:
          "Hundreds of exact TAHOT occurrences and HebrewStrong support many.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H7227a":
          "c4bc45c107b03bb4ce3eb2b7d5d3de367c202b01e22c7bdfd526954aa9b2f82a",
        "OpenScriptures-BrownDriverBriggs:t.ae.ab":
          "72aa1febdaa6b7a7e78a9cf524513811e025ddab93baf6b33b979087d3fa8595",
        "OpenScriptures-HebrewStrong:H7227":
          "c1472a06ee436a74c3532cd857c7a3ec5db6f10849006125d41abde61729e25b",
        "OpenScriptures-LexicalIndex:lqg":
          "da4e181cd334949edc1ce6f70b8f842ab4be2fb203e39a4241f75101150da84a",
        "STEP-gloss-anchor:20789":
          "04fa884b64f72713bc49ae342e31b7b6bac4de34ac4ad625a16464304411caf5"
      },
      occurrenceProof: {
        count: 423,
        occurrenceCorpusDigest:
          "a4d485558d4b32ec79981910c7f38eaa54751da8e589e004fc3a8c8783a5207e"
      }
    },
    {
      key: "H7258",
      identity: {
        stepEntryId: 20825,
        eStrong: "H7258",
        dStrong: "H7258 =",
        uStrong: "H7258"
      },
      input: {
        stepGloss: "rest",
        stepGlossDigest:
          "2e09d5210db8417757b0f875c276d0cb877b22514e9a3583d2d8d7445368a027",
        candidateRecordDigest:
          "30fb4f66edf4d7d50b8bccbb4c931e9dd9b3d4b3a8cff1133c7c02f09a70f92f",
        stepAnchorDigest:
          "45139a95b5c2cd2ebff740eb125d3478d512cb4ac9bddfe8491dd480eccd88dd"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "resting place",
        valueDigest:
          "a02669fd587482487538aa9cd7a1c3293f174615f5806e0a74cbee8c1723eab5",
        reason:
          "HebrewStrong and all exact TAHOT occurrences support resting place.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:t.an.ab":
          "d41bbf0250edf69e8e0d6d92dc8d493c0804a0733b1a41d048da56418272e580",
        "OpenScriptures-HebrewStrong:H7258":
          "6f1c4230ae10ecdd0c0f629eda318e6e235f6bad4a7d0469aa19bdabd468ba79",
        "OpenScriptures-LexicalIndex:lri":
          "41acb9aaabe4ec79ba66030cede671d573c80eae54071088569cce18d266d6df",
        "STEP-gloss-anchor:20825":
          "45139a95b5c2cd2ebff740eb125d3478d512cb4ac9bddfe8491dd480eccd88dd"
      },
      occurrenceProof: {
        count: 4,
        occurrenceCorpusDigest:
          "535e342c6d60b69a485371445e47ebfb0e93a6aff1a71f86c408f78311a8a5b2"
      }
    },
    {
      key: "H7315",
      identity: {
        stepEntryId: 20891,
        eStrong: "H7315",
        dStrong: "H7315 =",
        uStrong: "H7315"
      },
      input: {
        stepGloss: "hight",
        stepGlossDigest:
          "91c04aa408c6090e49ec56d605a638b5c097f20c24d5c290b843f0cbfcbdd03a",
        candidateRecordDigest:
          "2a1793c5c20c9f48e1ee70f710150b24a7c9392a20afe6929468b71c7c07f639",
        stepAnchorDigest:
          "8cba4fda8f8764a502047effa7d93a9d2a03846411eaa6d49080f40ff3f5f205"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "height",
        valueDigest:
          "39e0f5efdc39ec10992833ad019f0ddf2b42b49b098313df991b8229a37aed21",
        reason:
          "The sole TAHOT occurrence supports height; fixes the STEP typo hight.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7315":
          "1b86be13887032fef52e4eff7ecaa964674a2f43e89581e419b387366ba8bbe5",
        "OpenScriptures-LexicalIndex:ltq":
          "5fa2893b0fdacb4d972e09c8c3d12b5d5ed615c7144285ebd70bc7eb98e40fab",
        "STEP-gloss-anchor:20891":
          "8cba4fda8f8764a502047effa7d93a9d2a03846411eaa6d49080f40ff3f5f205"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "b927c977986d28269eed8c655d8d90c76e9925b0c5c4a8d371ab0ff60c98e4c1"
      }
    },
    {
      key: "H7771A",
      identity: {
        stepEntryId: 21480,
        eStrong: "H7771a",
        dStrong: "H7771A =",
        uStrong: "H7771A"
      },
      input: {
        stepGloss: "rich",
        stepGlossDigest:
          "7baa68f2418ba82d2545a780c00d7a8778249bbcdaf7369114534874ea6d3bd6",
        candidateRecordDigest:
          "d3190db5b33786cf98e3626e88ae794fd6d3fce58e47ec4af76ed0406e38dbe3",
        stepAnchorDigest:
          "4422f8e09794ebfce6c3c8730efcbf468f7d9f76ffeecde3ab9897f9681ecf8a"
      },
      decision: {
        finalAction: "keep_step",
        value: "rich",
        valueDigest:
          "7baa68f2418ba82d2545a780c00d7a8778249bbcdaf7369114534874ea6d3bd6",
        reason:
          "Both exact TAHOT occurrences and HebrewStrong support rich/opulent.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H7771a":
          "c5fe326215580a6b47480d63b3f786bc0c43a34c66b359d05294b540c6c51c7a",
        "OpenScriptures-BrownDriverBriggs:j.dy.ad":
          "cdca4e3f23668e1f3606218412f05a013e3f400349f163b5c30f636d6fdcdd50",
        "OpenScriptures-HebrewStrong:H7771":
          "e8be989482eb4c6213ab227e8063e110aa41ececc8e339f37f174220a4988f88",
        "OpenScriptures-LexicalIndex:mnl":
          "7c873f92d8406aa68e167a31afe882990d14561c08dc7d5a960e21619d8bb48c",
        "STEP-gloss-anchor:21480":
          "4422f8e09794ebfce6c3c8730efcbf468f7d9f76ffeecde3ab9897f9681ecf8a"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "bf90f4e3921b3f879471e73b78efc72967ead37525e6da2938d82b8b18d03300"
      }
    },
    {
      key: "H7846",
      identity: {
        stepEntryId: 21563,
        eStrong: "H7846",
        dStrong: "H7846 =",
        uStrong: "H7846"
      },
      input: {
        stepGloss: "rebellion",
        stepGlossDigest:
          "f1f718f462fbc4fc8c043700f01b63e861086635bcd05e850780dc218c191e8f",
        candidateRecordDigest:
          "36943b665c2d6f371392880a52953b6f6e22f3b4e891184cee83c5885ea9edb2",
        stepAnchorDigest:
          "92ed3cea225221d17a16c9537b4868d4222ba012270ce29644432089b1fe7608"
      },
      decision: {
        finalAction: "keep_step",
        value: "rebellion",
        valueDigest:
          "f1f718f462fbc4fc8c043700f01b63e861086635bcd05e850780dc218c191e8f",
        reason:
          "TAHOT rebels/swerving deeds and HebrewStrong departure from right support the abstract gloss.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:u.am.ab":
          "f7a91a1725e1b9a6d11480225acb152c12a9aeeedf7b943796dff6e72fbaf586",
        "OpenScriptures-HebrewStrong:H7846":
          "a90bb08efb49c60f0583ad1c61d4cdb097094e1231efd65a08a8c317be5f5632",
        "OpenScriptures-LexicalIndex:mqm":
          "356ff2ff102d1960ba4100b588b4956fb3fbd467d4423d23cca3ae379e84a2b4",
        "STEP-gloss-anchor:21563":
          "92ed3cea225221d17a16c9537b4868d4222ba012270ce29644432089b1fe7608"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "c53ab01933b9eae1d54d3a6477b73b3e7cbf277b41ef2cf1d46f335e8cc5270a"
      }
    },
    {
      key: "H7934",
      identity: {
        stepEntryId: 21666,
        eStrong: "H7934",
        dStrong: "H7934 =",
        uStrong: "H7934"
      },
      input: {
        stepGloss: "neighboring",
        stepGlossDigest:
          "62e9117b7a4790b35e099846f23e73ddcd901f5a83f1f68c4b8c69d59840d986",
        candidateRecordDigest:
          "919b926b087ef1d421f349e748f3506232a82ff8de25335836d02e2658aa38f7",
        stepAnchorDigest:
          "de9dbef7f632387a4433a3eca36d02b33810de8c580a225ff0620c262c135aa7"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "neighbor",
        valueDigest:
          "c65f1ed1c4f4bf1bc265e62b6cff6963111633a18b8fd798ee2a467150171750",
        reason:
          "Twenty exact TAHOT occurrences and HebrewStrong support the noun neighbor/resident.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7934":
          "5ed26e48f6bb459a52d6809e0bce5138e0993401ef1a607f7e8cc3b96bf886c4",
        "OpenScriptures-LexicalIndex:mue":
          "9633e0c40a17735903edc0433cf1d1721827acd2e09d5f315c039405370bb2fa",
        "STEP-gloss-anchor:21666":
          "de9dbef7f632387a4433a3eca36d02b33810de8c580a225ff0620c262c135aa7"
      },
      occurrenceProof: {
        count: 20,
        occurrenceCorpusDigest:
          "1a53f535dd8c1ff52eda088c10d9f87ac929c2c9130635212ce42d1416c4a8a0"
      }
    },
    {
      key: "H7944",
      identity: {
        stepEntryId: 21685,
        eStrong: "H7944",
        dStrong: "H7944 =",
        uStrong: "H7944"
      },
      input: {
        stepGloss: "irreverence",
        stepGlossDigest:
          "5c474af51a93d17fb8eec474ed7281adbdd67e868191e079fe776b49f0d89ad8",
        candidateRecordDigest:
          "cdb3ea35545e9aa063ce10d10d64b2df0a8078f3c1e6921391729739cb39eb7a",
        stepAnchorDigest:
          "9c72fd581417af2e30a589f071a9396e60b3010d1eb6c1cc7f4b18317b509a9e"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "fault",
        valueDigest:
          "f1c562eae32f9cc2a97dc9d768b89d1b3f937a2a95e812e94bdc033a075d7a1f",
        reason:
          "HebrewStrong exact meaning is fault; TAHOT presumption supports the error sense.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:v.dg.ac":
          "82a8d2dcf8ded22e67efba5cb76fdf94fd10c309c65683b8c445716e103ff6a7",
        "OpenScriptures-HebrewStrong:H7944":
          "09dc76c3e6011e6695a0c650b3e7331ada2431d4df02fdd2f65b88f0801d1f56",
        "OpenScriptures-LexicalIndex:mus":
          "14f7e6ff01510292ed1798e2dd9cd351789fbe2386f3bce8ab32765abd81139d",
        "STEP-gloss-anchor:21685":
          "9c72fd581417af2e30a589f071a9396e60b3010d1eb6c1cc7f4b18317b509a9e"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "31d33f4d2705a459e6c120e7084e5d26571cdd2f006cb131bd31aa9ded405846"
      }
    },
    {
      key: "H8323A",
      identity: {
        stepEntryId: 22258,
        eStrong: "H8323a",
        dStrong: "H8323A =",
        uStrong: "H8323A"
      },
      input: {
        stepGloss: "to rule",
        stepGlossDigest:
          "0dde7e5bbdaf33350ffae58b51c76c13e4e1592af58e9d47c30782fc1edc4a22",
        candidateRecordDigest:
          "902299d5840c8146af824f4613e026d5b774d4d3745b90eac62130815dc3e62b",
        stepAnchorDigest:
          "1c9af236dced203d4b5052cbb5b3af9a68094209dde128c8441fcd9f3cae8497"
      },
      decision: {
        finalAction: "keep_step",
        value: "to rule",
        valueDigest:
          "0dde7e5bbdaf33350ffae58b51c76c13e4e1592af58e9d47c30782fc1edc4a22",
        reason: "Exact occurrences and HebrewStrong support rule.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H8323":
          "6df1abff20ca32a3f4e018f18bcec0e9b578f0b62206c6946f1e1bf4201fc9bb",
        "OpenScriptures-LexicalIndex:nld":
          "6f54a80a7909c9b492733334466fabf85bf04bdf7c6e472e0bb89a8e8a128298",
        "STEP-gloss-anchor:22258":
          "1c9af236dced203d4b5052cbb5b3af9a68094209dde128c8441fcd9f3cae8497"
      },
      occurrenceProof: {
        count: 5,
        occurrenceCorpusDigest:
          "c74ba51ce303891af2b81f46ed0413dc87a6415a1fb46ff3235171f7483043ce"
      }
    },
    {
      key: "H8323B",
      identity: {
        stepEntryId: 22259,
        eStrong: "H8323b",
        dStrong: "H8323B =",
        uStrong: "H8323B"
      },
      input: {
        stepGloss: "to strengthen",
        stepGlossDigest:
          "6258e0ec68f299647ede4c9fa1d2422e2f19ec69d5af7fda5d5581cb9da738c4",
        candidateRecordDigest:
          "6b57bd5466ed25de9e5dc8cc5efd29f5c4645cefd72e224f1625592796c73029",
        stepAnchorDigest:
          "8890343b5a10f729ac43a76eb9f6d2d7d0ca48d10d451abef69a963d7ce80fb2"
      },
      decision: {
        finalAction: "keep_step",
        value: "to strengthen",
        valueDigest:
          "6258e0ec68f299647ede4c9fa1d2422e2f19ec69d5af7fda5d5581cb9da738c4",
        reason:
          "The exact Jer.15.11 Ketiv explicitly glosses I will strengthen you; no normal-form occurrence exists.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H8323":
          "6df1abff20ca32a3f4e018f18bcec0e9b578f0b62206c6946f1e1bf4201fc9bb",
        "OpenScriptures-LexicalIndex:nld":
          "6f54a80a7909c9b492733334466fabf85bf04bdf7c6e472e0bb89a8e8a128298",
        "STEP-gloss-anchor:22259":
          "8890343b5a10f729ac43a76eb9f6d2d7d0ca48d10d451abef69a963d7ce80fb2"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "71efe6e511f68940152c949b45b4ad9266f17d977ae81aadf11f63db4e8bf808"
      }
    },
    {
      key: "H8385A",
      identity: {
        stepEntryId: 22322,
        eStrong: "H8385a",
        dStrong: "H8385A =",
        uStrong: "H8385A"
      },
      input: {
        stepGloss: "estrous",
        stepGlossDigest:
          "82c491086adf89737b154ce6c6fbe5d92e8b071a5112fadfd0ec9dc556e4352b",
        candidateRecordDigest:
          "711d7a8a1493da560b0e5d76941449a50eb0d072fd353e513eb8ae5f014d6f9a",
        stepAnchorDigest:
          "53f8de8383d4d8f0c40ae235224369e83fdc70167b95dec92951dd6e6f65e474"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "heat",
        valueDigest:
          "5a2a0ed9aa3ab7d82b53e8209b13bf598377870fd38f8e1063bfbe0c4d7d7f96",
        reason:
          "The exact Jer.2.24 occurrence supports heat in the copulation/estrus sub-sense.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H8385a":
          "8cfa2f7911ac9955085b00b5ca03177b434d8633b7b0674cac984e1d0fa45476",
        "OpenScriptures-BrownDriverBriggs:a.ee.ab":
          "32bd0a26156886375b81ae91093cccea78b438f79b99040d475c8df667cc3880",
        "OpenScriptures-HebrewStrong:H8385":
          "6663fecc805c23c79b3cdb0f1bfb892d941c1cbb0280f28d787fcfc5b9ac58fd",
        "OpenScriptures-LexicalIndex:nnk":
          "48aac9c18648e1fafbf53e188e99744d37209b2478684e35cee3e4be994c43d7",
        "STEP-gloss-anchor:22322":
          "53f8de8383d4d8f0c40ae235224369e83fdc70167b95dec92951dd6e6f65e474"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "7af08a493419bb4648e90dce9b2308ee0d414dc5c93c211263ef9672d536c1c5"
      }
    },
    {
      key: "H8448",
      identity: {
        stepEntryId: 22397,
        eStrong: "H8448",
        dStrong: "H8448 =",
        uStrong: "H8448"
      },
      input: {
        stepGloss: "border",
        stepGlossDigest:
          "4f1a55de40bce9010e814d9bea3d3f20b0c9d12b48dd61bcaf7e0b50f39792b9",
        candidateRecordDigest:
          "899243d0eaf71b1dd63d2401888ec32acba233b22d30749c1be3d50d4284b45f",
        stepAnchorDigest:
          "82d3064caf886e39348abc10a9b048eba623d298f05bb2d59dbdb2218d3c270d"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "manner",
        valueDigest:
          "0425843ebda6f84d5ecf80a7a93779d3b3c252381b5c74b36f017edc011b908b",
        reason:
          "HebrewStrong exact meaning is a manner and TAHOT renders the sole occurrence order.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:w.al.ab":
          "688bacd0a5c909a25fb3190e7b94c3f52a7f3b609ea9c2e71f685a382ed5fcde",
        "OpenScriptures-HebrewStrong:H8448":
          "4ef547a9e54dd01fbc4f009ec10ffe2f17d421a994dc82e5926cc97ebae4af7a",
        "OpenScriptures-LexicalIndex:npz":
          "46c872a96090cf010e36da4e8cc2101ecf0cff561d1641936668882b19e88d36",
        "STEP-gloss-anchor:22397":
          "82d3064caf886e39348abc10a9b048eba623d298f05bb2d59dbdb2218d3c270d"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "1f3644437f0078c3e26a6fcf586ea59965a54e9791fa99fe9ca183e84b87db86"
      }
    },
    {
      key: "H8497",
      identity: {
        stepEntryId: 22459,
        eStrong: "H8497",
        dStrong: "H8497 =",
        uStrong: "H8497"
      },
      input: {
        stepGloss: "to follow",
        stepGlossDigest:
          "87ca1109cc97a2288f34c787f8aa100c8ced96336531f9b8eee0ab439c31bbbf",
        candidateRecordDigest:
          "55ef43734665d0fca6e1004559d42839e88828eb31d433e9bcde9382c47c2d26",
        stepAnchorDigest:
          "e76e5bc013da17d57d0dc003c07b987c3cacd8f8aa09384e8078b43de08d59d0"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        value: "to be led",
        valueDigest:
          "55f7cfeff4f91b470495527ec87d11a437eb3e98ccf64fcea1445992caec71a8",
        reason:
          "The passive form and sole TAHOT occurrence support be led; sources explicitly mark the root meaning uncertain.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:w.ao.aa":
          "295ab9c22866026df6cbb7c0c0a5a1d1650bdcf0ec0eece798bc622d5d688d00",
        "OpenScriptures-HebrewStrong:H8497":
          "188251b790a10b5249465c5f569fb8261875ba0f9ff4ae57e99dc2f63631d11d",
        "OpenScriptures-LexicalIndex:nru":
          "b281c840be5def0e69b00dc0ff3548a5f017fb09f14e33ee5d3940f6ebd53717",
        "STEP-gloss-anchor:22459":
          "e76e5bc013da17d57d0dc003c07b987c3cacd8f8aa09384e8078b43de08d59d0"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "c1b8e9c9a159461ae0262fa04cd8669b0d612f46991b0f8f50e74a4129561e8c"
      }
    },
    {
      key: "H8530",
      identity: {
        stepEntryId: 22494,
        eStrong: "H8530",
        dStrong: "H8530 =",
        uStrong: "H8530"
      },
      input: {
        stepGloss: "weapon",
        stepGlossDigest:
          "c68fef1abac63a8353831df2718519fee1c4c16d63ff13bc473a65be02fb60bf",
        candidateRecordDigest:
          "52eaa01ed759d1c15f726ec190bcaf58a9a025886f0bfec74715d821910ad8e5",
        stepAnchorDigest:
          "22f114f30581381c323b840c3b506eba5171064f3bae77d0a6f427a4c1bae110"
      },
      decision: {
        finalAction: "keep_step",
        value: "weapon",
        valueDigest:
          "c68fef1abac63a8353831df2718519fee1c4c16d63ff13bc473a65be02fb60bf",
        reason:
          "STEP raw meaning gives weapons/armoury and marks doubt; competing layers/fatal-thing readings stay in meaning.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:w.aw.ah":
          "c9068779ff4745381e31cb11aa7632a171f7b721e30c0bb62e931e740a492efb",
        "OpenScriptures-HebrewStrong:H8530":
          "109260a32f482b096d5bdd97779399d949ce3dd473376e7cfd29815290b7665a",
        "OpenScriptures-LexicalIndex:nte":
          "6c6fa0ad4886ac07b35bca8ce2bb493f36d08aa6edeabe362291f8d5fba5a804",
        "STEP-gloss-anchor:22494":
          "22f114f30581381c323b840c3b506eba5171064f3bae77d0a6f427a4c1bae110"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "3f8cb53c19e368be90cf4950a889212f6fad335f47b5db09ed3546bf9fd346dd"
      }
    },
    {
      key: "H8602B",
      identity: {
        stepEntryId: 22585,
        eStrong: "H8602b",
        dStrong: "H8602B =",
        uStrong: "H8602B"
      },
      input: {
        stepGloss: "whitewash",
        stepGlossDigest:
          "39cfc2eea39ecaedd4186bab8c0d5b883500f8e06503d2cee08313cb035f691a",
        candidateRecordDigest:
          "a59d390cd3fa69112621f86091109f59d855b56b76f0ba85d08024a5c35b2155",
        stepAnchorDigest:
          "79d2d58d62f2931342fa2ba347bc05318296c85ee1ec9198e458dc6bf125fdb7"
      },
      decision: {
        finalAction: "keep_step",
        value: "whitewash",
        valueDigest:
          "39cfc2eea39ecaedd4186bab8c0d5b883500f8e06503d2cee08313cb035f691a",
        reason:
          "All five exact TAHOT occurrences support whitewash despite external POS mismatch.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H8602b":
          "ff2a6ff4459cba7ec5bbfc4da1390f921b3932d0dddc3b98dad72fbd35039a18",
        "OpenScriptures-BrownDriverBriggs:w.bk.ab":
          "99f53bce28d2169e9de7f15db6f36616e2db0d4c97f6b4fd4de1764b63e17eb3",
        "OpenScriptures-HebrewStrong:H8602":
          "6e6dd79cd18d8fa6bab4e1956757cf880465d075547430daffda2c9e922c0c26",
        "OpenScriptures-LexicalIndex:nwc":
          "96f55529f3b9e751809aac097dfc1d09dfb62be0ec871224aa29347daa732afa",
        "STEP-gloss-anchor:22585":
          "79d2d58d62f2931342fa2ba347bc05318296c85ee1ec9198e458dc6bf125fdb7"
      },
      occurrenceProof: {
        count: 5,
        occurrenceCorpusDigest:
          "f3db2369aca02e8245552435bff131c0a9d69a46aaafed86d39b4f0ec4095bb4"
      }
    },
    {
      key: "H8618",
      identity: {
        stepEntryId: 22604,
        eStrong: "H8618",
        dStrong: "H8618 =",
        uStrong: "H8618"
      },
      input: {
        stepGloss: "to confront",
        stepGlossDigest:
          "02e896f870ab65d27a0c26674ddb600edb3c6c6e66dc528dcc3e2448e0f397d7",
        candidateRecordDigest:
          "9ccc85a294d61fb7df572c44ebfd530889ab40a0aefc5bb24dcc1222b57138f9",
        stepAnchorDigest:
          "177e4c8a8d70fd5306438e93f4d9c4cc31ed417bdea86ea453db2a90988b45e7"
      },
      decision: {
        finalAction: "replace_source_value",
        value: "to rise up against",
        valueDigest:
          "bb388e48affac53b7a83b8a8840ce28cca6c8fc34721f7b7b73b21a2f2c31041",
        reason:
          "HebrewStrong usage and the sole TAHOT occurrence support rise up against/rebel.",
        briefGlossPolicy:
          "Uncertainty and alternate senses belong in meaning/proof, not in the brief gloss."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:s.av.al":
          "9559a26905d2ec7de9176ed608cf5f9124fe9f49987913ba0e53aa353665e756",
        "OpenScriptures-HebrewStrong:H8618":
          "a6a1f47eb89a24e44f18e8fa44712c87804cb350126a387f16bc12b754828265",
        "OpenScriptures-LexicalIndex:nwv":
          "7cfb3a21a6f92b945c947f2c7c8e4a733b93523136a323afbc1969efcd810d1c",
        "STEP-gloss-anchor:22604":
          "177e4c8a8d70fd5306438e93f4d9c4cc31ed417bdea86ea453db2a90988b45e7"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "aa0caf72808b3d56f5330dd7f9f173659dbba1e219f569df75bd7732dba19593"
      }
    }
  ]
} as const;
