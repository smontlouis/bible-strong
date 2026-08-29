/*
 * Sealed projection of one complete semantic audit, two independent bounded
 * counter-audits, and final adjudication of the 208 residual Hebrew meanings.
 * Source-backed selections are stored as digests; only the 43 minimal editorial
 * reconstructions carry publishable HTML in this registry.
 */

export const HEBREW_MEANING_RESIDUAL_AUDIT_PASS_IDS = {
  sourceAudit: "lexicon-v3-hebrew-meaning-first-audit-208@1",
  rawCounterAudit: "lexicon-v3-hebrew-meaning-raw-counteraudit@2026-07-13",
  nonrawCounterAudit: "lexicon-v3-hebrew-meaning-nonraw-counteraudit@1",
  finalAdjudication: "lexicon-v3-hebrew-meaning-final-adjudication@2026-07-13"
} as const;

export const HEBREW_MEANING_RESIDUAL_AUDIT = {
  schema: "lexicon-v3-hebrew-meaning-residual-audit@1",
  reviewedCount: 208,
  classificationCounts: {
    keep_raw: 132,
    publish_step_specific: 18,
    publish_legacy_general: 1,
    replace_exact_companion: 14,
    editorial_reconstruction: 43
  },
  sourcePins: {
    firstAuditArtifact: {
      fileDigest:
        "1b8e2e38f141c2e0a480d89fbcd0f15d9bb393063373cf160301e9aa6bfa0345",
      logicalDigest:
        "2c217e36457e01c5b9890c853701a48e2a43548fe0ad7a74d5d2d0ca0ac2a6ea"
    },
    rawCounterAudit: {
      partitionDigest:
        "bb5ac91a9c3a313ffcaff62d052ab0756707ce6063585d6e838ad7a01260defb",
      rawHtmlMapDigest:
        "30cb0b50916bd3e33ab2b5156d8f7b78d7b78dbba5d9b1f487cabbcd8c94a0bb",
      auditRecordMapDigest:
        "e58630070f573d76e1319399e4c10da7ec94f4e304cab6ab3213c1406564bcca"
    },
    nonrawCounterAudit: {
      fileDigest:
        "603dd4b51196b602122616e17162acebfa3cad118090e198241325f44124014a",
      canonicalDigest:
        "a83ce86de0b51c5f23b522a87f0b185d3a14171be28de27e6aeb914dec7649fb"
    },
    englishAuditArtifact:
      "9216a44d1ceb6ea28d2871bc7be9eafe2338106febd7358d8c9b6ced67f079f6",
    candidateCorpus:
      "abe674425fd0f65c69b8c3df043037c8707dca4ffde07a495e0139e8b79b6def",
    tbesh: "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
    tipnr: "1a3b7d7df5cfa1e96eefa07dec92900bea278370c6788fadb5d036f3223b637c",
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
    tahot: {
      "TAHOT Gen-Deu.txt":
        "e9b8546ee48fe0bfc57c3b70f5f40e98d96580e803526d19026224e31753368b",
      "TAHOT Isa-Mal.txt":
        "f3ded203d2a74d6368932c97ae550d1d0754b271af491dc0dedf36fe3ba0bcc5",
      "TAHOT Job-Sng.txt":
        "84e118a97e5725e3847cdfdd593873513021c790c63cc91a0d41fca2b5db2ed5",
      "TAHOT Jos-Est.txt":
        "195fee1dc3653bab33701f170734eb894ed647c10cd08cc61749375fe8b73775"
    }
  },
  records: [
    {
      key: "H0010",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11047,
        eStrong: "H0010",
        dStrong: "H0010 =",
        uStrong: "H0010"
      },
      input: {
        rawHtmlDigest:
          "7fabec2ba3be52daecf40da36ce1205a902af7f3bb5d23b4110f7dd052e1d3f3",
        rawAssertionDigest:
          "b226520d9883d0e6efe40c9ec279b6619902a8612f3ae0fc7d31f8ea2be815d4",
        auditRecordDigest:
          "5f29131c7254fbb3f443dc0095dc6fa25a21cd9ef9d7ac3c80fff5bcfc1a94ff",
        candidateRecordDigest:
          "748f43617d524999a4cb22dde7e67c5d4561a6b5e1210e248a571980a8a72dab",
        stepAnchorDigest:
          "f88e36cc8b8441fb74984abd3d2f5be8a3133d0836e2c15f2f939bdc9d3ab0a1",
        firstAuditRecordDigest:
          "9860f9f6018836cb1664569209c09aba3e7e674ebf209696505850a2a1974864"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "7fabec2ba3be52daecf40da36ce1205a902af7f3bb5d23b4110f7dd052e1d3f3",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H10":
          "640c822c623c68d7eadfc703b1b0c3ee868fc71c0a8d95e0bae949e3194d2678",
        "OpenScriptures-LexicalIndex:aai":
          "cc398a607faa069feec9ea55c20fc78a87ee48bedae01a774b54b476c679d4cc",
        "STEP-gloss-anchor:11047":
          "f88e36cc8b8441fb74984abd3d2f5be8a3133d0836e2c15f2f939bdc9d3ab0a1"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "82c26b8b98783ab25bd82be9219263d32f0ee854a5f583217696d3415a975a7f"
      }
    },
    {
      key: "H0011",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11048,
        eStrong: "H0011",
        dStrong: "H0011 =",
        uStrong: "H0011"
      },
      input: {
        rawHtmlDigest:
          "efbfa2018a2b3b39c4fa7aea5311d121e0ea5dc2e00399000b20fa29a4e25bcd",
        rawAssertionDigest:
          "a27bf78e9073378c9c272f38a76336153018f7c5501669ee704b425b7511998a",
        auditRecordDigest:
          "9b44a07408977c88e0a6736edcd5bcf88c79c9119aeee7cf70b75899df30bce9",
        candidateRecordDigest:
          "a3af5f5188a99251cc6b6657d7654c7d308206c07caee08aa998ce78b2dbecba",
        stepAnchorDigest:
          "6630b94071ec3d2f1704df7ac09cfb619d60b433aed7523a6bbb7d837f510696",
        firstAuditRecordDigest:
          "d3ccfb4673193680f4f706783b7f524b4a246787240ad00851a028a9b486d0ae"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "efbfa2018a2b3b39c4fa7aea5311d121e0ea5dc2e00399000b20fa29a4e25bcd",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      key: "H0025",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 11063,
        eStrong: "H0025",
        dStrong: "H0025 = combination of",
        uStrong: "H0022G (H0001I+H1391)"
      },
      input: {
        rawHtmlDigest:
          "cb86a76ddf47c84c2811304f5e80ac3a23d733911820313436eb148871fc927c",
        rawAssertionDigest:
          "ea01fa24736a2c2fbd944c78fc7009c874b939ac5f8769416f470b1ca36c7ba1",
        auditRecordDigest:
          "5cc8b355b29ee762fecf5ab7f3845265819b79ed1dc6e54d2f73b2a726b8fcd2",
        candidateRecordDigest:
          "77c9193b588817c6a7ce724c428cd59bc63a8a3c427bf5d5e386ca9ac254fe3a",
        stepAnchorDigest:
          "f917a59e7f58c693180307d4c147e9a31ab65db8cb60d84496ee67bcf4c83561",
        firstAuditRecordDigest:
          "bf009271aa11f7a3b64f0b5bb3fecf860a47c339dc97601033e79d1059836c66"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "add28ac7d39b14e5109d732fef6281af1b2687ff5db425c86f7086ff51e7faaf",
        reconstructionHtml:
          "<p><strong>Father of Gibeon:</strong> a title for Jeiel in 1 Chronicles 8:29 and 9:35, formed from H0001I (“father of”) and H1391 (“Gibeon”).</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:c.al.aj":
          "213971bf761c1461a982699b9e3145415c7d45f559c8006e7373c55ed927f357",
        "OpenScriptures-HebrewStrong:H25":
          "5139d7a68bc136226f1181af4c2b9bc8b8fe7c08ec2bc330c953a3130b86c64b",
        "OpenScriptures-LexicalIndex:aav":
          "3d3149e565c5f447e2d2139cf37774b499be1039ad91823bc25e5e4f6651a3aa",
        "STEP-gloss-anchor:11063":
          "f917a59e7f58c693180307d4c147e9a31ab65db8cb60d84496ee67bcf4c83561"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "e9072e75e83ccd21fc8929ace60808250d9d651ea0fe8829b69f3458edc8244c"
      }
    },
    {
      key: "H0041J",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 11097,
        eStrong: "H0041",
        dStrong: "H0041J =",
        uStrong: "H0041J"
      },
      input: {
        rawHtmlDigest:
          "b3cedebc6730b87ca7f024bc6afd783b093dfaf173048107bcb1f66858def14b",
        rawAssertionDigest:
          "3e8217e3c3a051829a8d0dd235c301817672a974e328cd6f49c7de597c2ce22c",
        auditRecordDigest:
          "b039a9ce815cf20dc513556d03b3e1cb6ce4ce80e4229c1891a306fef9ba6d6b",
        candidateRecordDigest:
          "f7bf3c7a52d29da7b05853c8cc6a4d2e8cf610f6bd655742c49420c7b0edcdca",
        stepAnchorDigest:
          "4f96991902f53771cc29f67b0981615cdf55bafb50836dcd99eb7594b36b3123",
        firstAuditRecordDigest:
          "f99784ff7e13005362a4c4ca4ed042fb8542934b9af2318359ee86c065e5da20"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "574b04f55052a63af60bab4459c097a1d319008b9cbc283846a26eaa17673ce7",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:11097":
          "4f96991902f53771cc29f67b0981615cdf55bafb50836dcd99eb7594b36b3123",
        "STEPBible-TIPNR:H0041J:entity:41":
          "a78e4ac8fc43f23caccd2670d264bd76fc6a88bb278211ae28a1971ac0be8238"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "56d5cf15636322a80801e8c109df4fef117b7041ed069acde5b8e5cc3483897e"
      }
    },
    {
      key: "H0071",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11137,
        eStrong: "H0071",
        dStrong: "H0071 =",
        uStrong: "H0071"
      },
      input: {
        rawHtmlDigest:
          "5f28d362ca1607abd480db5cde7f2be63f447c23f8a8e08b432b03d37af449ac",
        rawAssertionDigest:
          "9bdddee42067d8b2e58c40d7caa213bd8a6a8aecbfe7c953b29a9f4eeeb83693",
        auditRecordDigest:
          "accc801e8b1510d8295e319e8f598e778a2d84a9268bd146ea8d48bb803a344e",
        candidateRecordDigest:
          "28f9c0d237b53b241e04648fb349f3dd47e412b6a18356b69941594cd95050b6",
        stepAnchorDigest:
          "e37adfe0ed44075ce612eef15cecb40b69d4553072a42cf7da5ea7cf91cb51e3",
        firstAuditRecordDigest:
          "fe120f23ab29b1c2fcfac85b7a1efecdc87fa33b86dbdec4d9cc3c94d24cdbe9"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "5f28d362ca1607abd480db5cde7f2be63f447c23f8a8e08b432b03d37af449ac",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:11137":
          "e37adfe0ed44075ce612eef15cecb40b69d4553072a42cf7da5ea7cf91cb51e3",
        "STEPBible-TIPNR:H0071:entity:3118":
          "63265682f36c58e6cbcf9b05f87ca1b7c40c2f18554af85a0a33843b477fd48c"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "802d5f4eb1ec5dbf462636509496a3adb8d674914510812c6889b48e8d79c930"
      }
    },
    {
      key: "H0123G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11193,
        eStrong: "H0123",
        dStrong: "H0123G =",
        uStrong: "H0123G"
      },
      input: {
        rawHtmlDigest:
          "a74619cc05649f6ab2edc36629b75e27f0bcc434e68799051aa573aa1badbe9e",
        rawAssertionDigest:
          "e1f6a732cbb867e5c8fc11e899a288bc6562fbd4d605012dda434545639d554c",
        auditRecordDigest:
          "dd2623c7a504a86c6b625001df25de8b6cc43b5d36f97b5d1b28b63994c7d81c",
        candidateRecordDigest:
          "389717ed4bea668596a4716d7111d20d1b9546222c0478c100bde38b6fc8d0d4",
        stepAnchorDigest:
          "c1d83895ab1af36287e19de159a924982cfe400d1a598d1f0071aa11d5e10bd8",
        firstAuditRecordDigest:
          "f203c3cd9dcae43d95c8c65b28f8dcc812d1d45032877de22da0a832ab4ccd9f"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a74619cc05649f6ab2edc36629b75e27f0bcc434e68799051aa573aa1badbe9e",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:11193":
          "c1d83895ab1af36287e19de159a924982cfe400d1a598d1f0071aa11d5e10bd8",
        "STEPBible-TIPNR:H0123G:entity:3416":
          "8497a34cc978e980c42a7f4052e86f3533a3b41c466b782fcbcb97ddc7d48de1"
      },
      occurrenceProof: {
        count: 93,
        occurrenceCorpusDigest:
          "dae773abc2f350eeb1b4fb244ce990a6760fc81f70ab53ea451f01657085ded6"
      }
    },
    {
      key: "H0130",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11203,
        eStrong: "H0130",
        dStrong: "H0130 = a group of",
        uStrong: "H0123G"
      },
      input: {
        rawHtmlDigest:
          "2aa495258790bd829780a575355bb6ea29f35adf7eeb7ed5ed5b88d169b3085c",
        rawAssertionDigest:
          "7219038881278f40225338bdccb4cfe1c7e5b559961c84800b63c5e8236ba254",
        auditRecordDigest:
          "266efdfa7dd42c54ea2c4d8d032e6fe0b351dc984d128b59aef3568d5072ba88",
        candidateRecordDigest:
          "740bf3d739575ede090ecfc798017da70b83817427bb64256933ff6515838933",
        stepAnchorDigest:
          "9fe420e7b7fd01fb6653e6aa42810df95b4a3e189c7fee1cb92c5dc5cd202a15",
        firstAuditRecordDigest:
          "d2f1be3a0d7b77bf96ee5b4c6391c9bdc6e04158144c86086934b1e0a56c978c"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "2aa495258790bd829780a575355bb6ea29f35adf7eeb7ed5ed5b88d169b3085c",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:11203":
          "9fe420e7b7fd01fb6653e6aa42810df95b4a3e189c7fee1cb92c5dc5cd202a15",
        "STEPBible-TIPNR:H0130:entity:3416":
          "35c6132025c5e487db2252533cf8b966597484ccb465354925986efad4e610df"
      },
      occurrenceProof: {
        count: 12,
        occurrenceCorpusDigest:
          "bbbb19d1e58962ddd3ce1286c9bea3ad58359d2df9e3d5bdd8f936f90aa08f07"
      }
    },
    {
      key: "H0173G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 11253,
        eStrong: "H0173",
        dStrong: "H0173G =",
        uStrong: "H0173G"
      },
      input: {
        rawHtmlDigest:
          "a4dc6a3db9533f4269959b880c414631f3ce9b663d4a487fded8c75af8b86b33",
        rawAssertionDigest:
          "992c42012d5ab2295a844e95a8d5a274f8a868763a722f9d2f550220f340439a",
        auditRecordDigest:
          "f746cd40ad795a4f446e96f4bd9358811971c421d584509a1ad529d5b6ea93d6",
        candidateRecordDigest:
          "c9870b1b07924d414d76ee7bc9b08fd0792b0abc6f2337fe5a313b94ade39a89",
        stepAnchorDigest:
          "c57faa7a4ee26468e81b850e7e01297ad93213bb6f265daf718991601ef6fdee",
        firstAuditRecordDigest:
          "97b13456f8049fb5f2f226ced597231f3ea808a670e4b20d911cf27c9e5f624f"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "44b9b613f4ef84f558fa7bd943a5b726a443d29b27385ab37759decf3e7f9e9d",
        reconstructionHtml:
          "<p><strong>Oholibamah:</strong> Esau’s wife, named in Genesis 36:2 and 14 as a daughter of Anah and granddaughter of Zibeon; she bore Jeush, Jalam, and Korah. Current STEP merges this legacy sub-entry into H0173.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H173":
          "3755612ffc8b639323024090ce1be16b4bc22b05d8cf17ff4423d672abfaf8e8",
        "OpenScriptures-LexicalIndex:ahc":
          "81b3a4fad8dfd2f5ae0bab19d868806520353ba7ce504e555fef0d008f663020",
        "STEP-gloss-anchor:11253":
          "c57faa7a4ee26468e81b850e7e01297ad93213bb6f265daf718991601ef6fdee"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "c8a1a538855e886f957ca1f104c05a600e336a7d288008e3eada401cde77a83b"
      }
    },
    {
      key: "H0173H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 11254,
        eStrong: "H0173",
        dStrong: "H0173H =",
        uStrong: "H0173H"
      },
      input: {
        rawHtmlDigest:
          "da23cb133c00c2d9ee2feaaee6135de3e2d1319dcd90e0bfc03b5b2f9d4dd3a4",
        rawAssertionDigest:
          "e2e508e12ac1c265b004c96c4029744e218650353bf7b99a591284b0c2505b0b",
        auditRecordDigest:
          "d50daadf40c870923be49c605bdfc841aac7cbb4130048c650571cd4dc69e1fa",
        candidateRecordDigest:
          "fd03b36a99c4166140e25eb5fd3f001ba06510ebd47c68029e99d874af699ff6",
        stepAnchorDigest:
          "c57faa7a4ee26468e81b850e7e01297ad93213bb6f265daf718991601ef6fdee",
        firstAuditRecordDigest:
          "765e2926df95d7aa0e4aaa8fb85dc3dd4f7d7cf9b7d0b8346207a0294db320c7"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "2855193d0cb713e3791ec931945cfe826f69bc2aa5cc04990b6a25341613e46d",
        reconstructionHtml:
          "<p><strong>Oholibamah:</strong> the daughter of Anah and sister of Dishon in Genesis 36:25. Current STEP merges this legacy sub-entry into H0173.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H173":
          "3755612ffc8b639323024090ce1be16b4bc22b05d8cf17ff4423d672abfaf8e8",
        "OpenScriptures-LexicalIndex:ahc":
          "81b3a4fad8dfd2f5ae0bab19d868806520353ba7ce504e555fef0d008f663020",
        "STEP-gloss-anchor:11254":
          "c57faa7a4ee26468e81b850e7e01297ad93213bb6f265daf718991601ef6fdee"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "361d3c6e4db2d785b3b238f0c9c32b3cccfd22e3ae2d6e324c04a483261152f4"
      }
    },
    {
      key: "H0173I",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 11255,
        eStrong: "H0173",
        dStrong: "H0173I =",
        uStrong: "H0173I"
      },
      input: {
        rawHtmlDigest:
          "5aaf2cdedbcc8ce625b2e8009cd5634391b6e6520a73bb8a5efed05f2fdbc320",
        rawAssertionDigest:
          "0e508dc965546ff9d0909f3202af74346c39389958c1ea7044f988e6c3a3022b",
        auditRecordDigest:
          "cd0676703675ab41f8d730215768a752b70fb624035615b5e8cd82a2bfbf03d4",
        candidateRecordDigest:
          "1189478aa11214cd14b53bd8a8224def910721e8377f180a97851fbdcad37c95",
        stepAnchorDigest:
          "c57faa7a4ee26468e81b850e7e01297ad93213bb6f265daf718991601ef6fdee",
        firstAuditRecordDigest:
          "90d44dd1de96072edd0bc5b21b5d50205c6e3affda22f04a9fd9bdaea01a6fb2"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "c1846311fb4bf91240b57dc58708687919aac0d8020eed3b17396d5f3452a572",
        reconstructionHtml:
          "<p><strong>Oholibamah:</strong> a name in the list of Edomite chiefs or clans in Genesis 36:41 and 1 Chronicles 1:52. Current STEP merges this legacy sub-entry into H0173.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H173":
          "3755612ffc8b639323024090ce1be16b4bc22b05d8cf17ff4423d672abfaf8e8",
        "OpenScriptures-LexicalIndex:ahc":
          "81b3a4fad8dfd2f5ae0bab19d868806520353ba7ce504e555fef0d008f663020",
        "STEP-gloss-anchor:11255":
          "c57faa7a4ee26468e81b850e7e01297ad93213bb6f265daf718991601ef6fdee"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "3f410d0a61f6dc3a3251eef846c7771f29287218e9a113ba01bec47916568444"
      }
    },
    {
      key: "H0197J",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11285,
        eStrong: "H0197",
        dStrong: "H0197J =",
        uStrong: "H0197J"
      },
      input: {
        rawHtmlDigest:
          "0126ecb326f1a2147b2c515cdbc8b9f04f83cea29d39bdc68ea266e4d6bd971d",
        rawAssertionDigest:
          "b114b0a9f6fa2fa8e9820a9ee54d202b269b42c1ec35e03e628bfb26d1d2232d",
        auditRecordDigest:
          "ee927e3c78cdce9407a773e210c7be7a0c1ef326368c4b2dd1af5219883f9c13",
        candidateRecordDigest:
          "7aed13cc04991929ecb3f9dd29d245bebe864b1ef5c4d2a58391e335af8317f8",
        stepAnchorDigest:
          "f010c9c8b577da9c916dc69c6dc5696a842bb6762dd342721666e4dc65fa4f90",
        firstAuditRecordDigest:
          "42bd947c30695ddba27149bb2e18c66614fdfa7a6f99046a04029de0980ddc64"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "0126ecb326f1a2147b2c515cdbc8b9f04f83cea29d39bdc68ea266e4d6bd971d",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H197":
          "c2fc757183b7cab18c7a2a538f03d00a14aba1d68a87e6e5f57e6bf9da233eaa",
        "OpenScriptures-LexicalIndex:aij":
          "17204c92c0f239c6c76edfedaf8d960560dd5f048bc373c06a2e98a8ce64433d",
        "STEP-gloss-anchor:11285":
          "f010c9c8b577da9c916dc69c6dc5696a842bb6762dd342721666e4dc65fa4f90"
      },
      occurrenceProof: {
        count: 27,
        occurrenceCorpusDigest:
          "3139971068f551cb530dc049830596a3ee4b6bb3988ec7991227c74307e297bc"
      }
    },
    {
      key: "H0363",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 11514,
        eStrong: "H0363",
        dStrong: "H0363 = in Aramaic of",
        uStrong: "H0352D"
      },
      input: {
        rawHtmlDigest:
          "7f5a3f6df36c6c518636b748023e53eaac0f79e6e5bf44c55c65ae77e2e08036",
        rawAssertionDigest:
          "25911ae75c3ad827777c010d0d0c2e9da6e6c822937c4a50d6bb6c9fc982950a",
        auditRecordDigest:
          "3440cbb372708ef16d7b498f9d26b1585d0fe56f42e6f3194f800bfdea513796",
        candidateRecordDigest:
          "f98f5576b2b3c71788f0a134ceadd9a5685da006957c5306b8c4762941dc744c",
        stepAnchorDigest:
          "065a5d6ffa3035b6a541b98b20b765f62e17554f483b591f93561e39ad1136cf",
        firstAuditRecordDigest:
          "e55335750d684806a895842b7f97e092cfe51b146b1369a515723bbea3f86d66"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "a8b530eafc30115c89208ae0a5ec910722767d89af486ce53a66193d109f3c28",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xa.ae.ab":
          "0715af3a72dee3649a85f3fc3f03867534be49a09a7327bca5bc80e9cde92330",
        "OpenScriptures-HebrewStrong:H363":
          "3198deaf8655dc4c6910f7df760a30f6c2f5c43e4c742107b8e212574e1a6bec",
        "OpenScriptures-LexicalIndex:nzz":
          "ba76280068f9facf46c70c63f546b9de1002acb2426059564d99b4bdd58aaba7",
        "STEP-gloss-anchor:11514":
          "065a5d6ffa3035b6a541b98b20b765f62e17554f483b591f93561e39ad1136cf"
      },
      occurrenceProof: {
        count: 6,
        occurrenceCorpusDigest:
          "e18e33a70c3bc6b44599afab05eda9871515d48ee5b3ccb2bbf6853ca9ccdd8e"
      }
    },
    {
      key: "H0381",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11534,
        eStrong: "H0381",
        dStrong: "H0381 = combination of",
        uStrong: "H2428G (H0376G+H2428G)"
      },
      input: {
        rawHtmlDigest:
          "5e31022fb6963beb51d302b13ad6c6578fd60e168aaa7d8a2c4e3a8ba6f93500",
        rawAssertionDigest:
          "50618db56ffeb2ed98ab58d1763a50492c43009693efe59563aae8ff15ec1cd3",
        auditRecordDigest:
          "012508c3261988341abf4ed48204de8e92744ed98aa26e9b6813b8427b6de100",
        candidateRecordDigest:
          "bf91156aef93ead658d57692c53cc6afaba7523f1cf57b28693e425736e05f14",
        stepAnchorDigest:
          "f4e64122e6dc5fa77dee5f72374520a611aa50ff13b7bf7a14326b917ee8272a",
        firstAuditRecordDigest:
          "19947a2e8775833a79ec9d8ce9dca284fc9d7bdbdd6322b486cd9112165fbf8a"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "5e31022fb6963beb51d302b13ad6c6578fd60e168aaa7d8a2c4e3a8ba6f93500",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:a.da.ab":
          "83bfc6fae4077a6eb7935a768bb1996498af29a6a787368dbf7dcc89fb8e414d",
        "OpenScriptures-HebrewStrong:H381":
          "965b06b0d0029e6addcd1955555d8f8f7037910bb10096b334fd0f5c0ec423c1",
        "OpenScriptures-LexicalIndex:app":
          "83eff1bd7ffcea8191b0f56439eedd9a240ec1725d757739982257e3d730a31a",
        "STEP-gloss-anchor:11534":
          "f4e64122e6dc5fa77dee5f72374520a611aa50ff13b7bf7a14326b917ee8272a"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "1a487e8fc851151c7a6808f06aab8c1f6fb51e82ba44be3505c9f6e5ad70c1a0"
      }
    },
    {
      key: "H0382",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11535,
        eStrong: "H0382",
        dStrong: "H0382 = a group of",
        uStrong: "H2897 (H0376G+H2897)"
      },
      input: {
        rawHtmlDigest:
          "a05127ced83bf68bcfad2416f952589da6317ad64aaacc9edcebfbe6df3b5dcd",
        rawAssertionDigest:
          "27a38a543a95e4cafbfe354ddf2280ef07bce4b52422f6674bc6279ec764ed8e",
        auditRecordDigest:
          "4df62d852beb625e1a623bb5acff84cc111785e740fd73d744377aba7b442c9f",
        candidateRecordDigest:
          "d3a81611bfff1aac5dba445faa2e7b89d89e58463a3b2d0dabe9a5ddf21a7ca4",
        stepAnchorDigest:
          "6edf77a47b222060a510a680c843ea4e1cee0d8654d6e42b9bde6e44280c4fe0",
        firstAuditRecordDigest:
          "018267f4363faf699f685e307ee03371f8cffecad45480cd1394d0f9396c03ab"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a05127ced83bf68bcfad2416f952589da6317ad64aaacc9edcebfbe6df3b5dcd",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:11535":
          "6edf77a47b222060a510a680c843ea4e1cee0d8654d6e42b9bde6e44280c4fe0",
        "STEPBible-TIPNR:H0382:entity:4063":
          "5d29a8d0c4692232a48f88ac1305d4ebac24cee5387eca05ded9994ec96e95e7"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "1c617e3f55bbe33b002298c92c4ff0efa56d1a1dc69417d30aaf74e1fa60476c"
      }
    },
    {
      key: "H0410I",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11570,
        eStrong: "H0410",
        dStrong: "H0410I = combination of",
        uStrong: "H3068G (H0410I+H0430G)"
      },
      input: {
        rawHtmlDigest:
          "eabbd73b85d8fddc955698a43f1682f538d3fa560c3af74ace3a03f0c113ab09",
        rawAssertionDigest:
          "9d8e77302a943932ace08fda90660942edd76996be8dd2f9983da3cda5126500",
        auditRecordDigest:
          "94dd808d538178a8053f1bb29d7dbe1ef6783e7b2e0aa1de4427de8c547982ec",
        candidateRecordDigest:
          "3b54c93d3ba26888f20578806fa8ceb208dc66c62c0f83e6fbb8eafe45c03991",
        stepAnchorDigest:
          "5e7aa5aeeb6950d9a7c11453007bb0b0c45182d3de40cd5edec65ce228007c03",
        firstAuditRecordDigest:
          "2aae33bf1872562decf255b2c64a0631f98f57eb4c65b4df9dbc3b806dc0af36"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "eabbd73b85d8fddc955698a43f1682f538d3fa560c3af74ace3a03f0c113ab09",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:11570":
          "5e7aa5aeeb6950d9a7c11453007bb0b0c45182d3de40cd5edec65ce228007c03",
        "STEPBible-TIPNR:H0410I:entity:4174":
          "ad3164d16c81ece2a18f015547768289976903d38eb90601a35587648e7ca6de"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "056e90b8e05639a6fa72a41f61898a3968f355fa15b3999ddfb86baeda714e49"
      }
    },
    {
      key: "H0415",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11578,
        eStrong: "H0415",
        dStrong: "H0415 =",
        uStrong: "H0415"
      },
      input: {
        rawHtmlDigest:
          "9c5c23304066243d2c99ca4562e537b0f0f389681b079fde44db37f1ec134231",
        rawAssertionDigest:
          "035426ad4256d49c76eec35f51677da52a95fa2b2b6b315655dc58c033033e17",
        auditRecordDigest:
          "cd0cec05f54fbbfc0425f61268d68a0da0005f087d37731cd312f63f4372ec3b",
        candidateRecordDigest:
          "a5abfcf27f05e0b17e67e158b46956ad32fc342db68e61335824062110b4ac20",
        stepAnchorDigest:
          "af3ea337d817aa5a1c4ae8a83fedc8aab1196e7142e1984f7ebf7a458c0531b4",
        firstAuditRecordDigest:
          "f5684553641f447710559eb9a9c4600022a613862281cb3c2dace93e4e5ec081"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "9c5c23304066243d2c99ca4562e537b0f0f389681b079fde44db37f1ec134231",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:11578":
          "af3ea337d817aa5a1c4ae8a83fedc8aab1196e7142e1984f7ebf7a458c0531b4",
        "STEPBible-TIPNR:H0415:entity:4174":
          "13388ec7033521830043c59f4d11ec792b80383bd44224a8ff3cbdba7ad6b6c9"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "38690a137d718f03b9625024cb3b03033aa6d8bad0485f63482475abfda7b412"
      }
    },
    {
      key: "H0595",
      counterAudit: "raw",
      identity: {
        stepEntryId: 11885,
        eStrong: "H0595",
        dStrong: "H0595 = a Spelling of",
        uStrong: "H0589"
      },
      input: {
        rawHtmlDigest:
          "dbb4b1b042eefa84e00fbe2269a04d4994e77f4cd52c7673b6619fa9366c0f6b",
        rawAssertionDigest:
          "57090b3f9d44f41bd8aacafb3f2205752ff68d19339d70c9875cd3775b9eba9d",
        auditRecordDigest:
          "dfc3cfe25dcf9778ff648dae78a74942638f9901e78cba72f591b71ad4b7c74e",
        candidateRecordDigest:
          "5b3edb4ca9e839a26c35ecf3de8895b851a58f29ced6767c7a25194a5f62591a",
        stepAnchorDigest:
          "229b15eb0cf217f17b8e0131f8c912c54d14d25b472b53e28e8e04dc7fc71e4b",
        firstAuditRecordDigest:
          "11a2e3d6ac976c73b8a9595a00784fd542202d9f3920ba7fa26edcc844461904"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "dbb4b1b042eefa84e00fbe2269a04d4994e77f4cd52c7673b6619fa9366c0f6b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:a.ei.aa":
          "33fadd46eefc6d6c7faa7d92d59fd681c2662b5dbab58ec5671b40745f6a2efd",
        "OpenScriptures-HebrewStrong:H595":
          "8439304f68655f3bf6c68fc1a3d614c896c86cd963baa0cfdab7b1028184f603",
        "OpenScriptures-LexicalIndex:axt":
          "4085a353f517eec1684a8d1ef62e675365c48c92ee6f95c6f81afa3e9ffb5f24",
        "STEP-gloss-anchor:11885":
          "229b15eb0cf217f17b8e0131f8c912c54d14d25b472b53e28e8e04dc7fc71e4b"
      },
      occurrenceProof: {
        count: 359,
        occurrenceCorpusDigest:
          "4778c0f6bbfff79ecd4c12ae834f4d167cc6dbb66fcd83660bef904131b7ffe7"
      }
    },
    {
      key: "H0726",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12040,
        eStrong: "H0726",
        dStrong: "H0726 = a group of",
        uStrong: "H0123G"
      },
      input: {
        rawHtmlDigest:
          "747b24428dfb0cb37fc3ad7d98f96811e3fe4352631a0e18cac335cc44987aa2",
        rawAssertionDigest:
          "29055a2122cba073ee706e25f0a3c183b314e0505fae2a0462e4e5d8efd792f6",
        auditRecordDigest:
          "e0a32ec168e47d004cae93656c75b125cf49b2670b039409c8f1a404336ad62b",
        candidateRecordDigest:
          "cc9281ffb695b18c5d36887bdde218b6d2fd6797e39d416f1ab860ee05b70694",
        stepAnchorDigest:
          "50de00b7c6f9fe5b615419a7037b6b47f017d5c9a24f8f9c517e554542fd2165",
        firstAuditRecordDigest:
          "f54f1dc663cc18de71fba2670df90f2ebd80d2a144ebbe6c21cd49d9e05feef9"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "9024d24e7bf603c392f0d1e6de80e84450891694c39fd8bcd1144b1db6a9c54f",
        reason:
          "The raw notice conflates Aram/Syria with Edom; the audited companion preserves Strong H0726's scribal-error note and traditional usage."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H130":
          "267afc44e9505b6fd6d58e1ca4d1687891526c8561b5452026489d219bba874d",
        "OpenScriptures-HebrewStrong:H726":
          "0c994066fbe653ddf024273e6a5697e0e7350a90e44ec7a52d2779230871f50c",
        "OpenScriptures-LexicalIndex:bcu":
          "9c16c786ec4d504bf26cef353f090536cb6cefd6bdf1dd325386ac43b7730587",
        "STEP-gloss-anchor:12040":
          "50de00b7c6f9fe5b615419a7037b6b47f017d5c9a24f8f9c517e554542fd2165",
        "STEP-relation-graph:11203":
          "3102b21c6d0e05c15482cad160b4f494061c428130d5450bb0e5806c29e7a416"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "29419e7bee9ef7c48bf6f0c33ba5a4a7e73866b571903296bf72af7358764fa7"
      }
    },
    {
      key: "H0760",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12088,
        eStrong: "H0760",
        dStrong: "H0760 =",
        uStrong: "H0760"
      },
      input: {
        rawHtmlDigest:
          "ea005379d9f7ae1ab6fb6cad6f331bffcaba2e408aad1046eb4fdd75e87092e3",
        rawAssertionDigest:
          "f80ae60b265dde149439929cf7df269d15f06f9734fa513cb41cbddfa96664f1",
        auditRecordDigest:
          "5d907849ec958d0093805d2745086b3f138058f507a77c24188f8f608964679f",
        candidateRecordDigest:
          "8f3cd3ade0bba43da9c025516da3ca42f0787a29e8ddb24ad403393bdec85628",
        stepAnchorDigest:
          "e7df283422bb7e7dbdc84a0552ae5b5d208c26e35d84b86d06c382b7e9e613d7",
        firstAuditRecordDigest:
          "f6bc7837bc2b966bfb36af036f038318d852db1d8b8e597e529a36c35c889657"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "ea005379d9f7ae1ab6fb6cad6f331bffcaba2e408aad1046eb4fdd75e87092e3",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12088":
          "e7df283422bb7e7dbdc84a0552ae5b5d208c26e35d84b86d06c382b7e9e613d7",
        "STEPBible-TIPNR:H0760:entity:3190":
          "593e3995dd93df0a2db397b7994e427278fb877efafa13c124cd878cb3c99ede"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "a95dbe1301f35630bd07eb60e1827bafae3bfafd3ea459e5810e3c4fc7873635"
      }
    },
    {
      key: "H0761I",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12091,
        eStrong: "H0761",
        dStrong: "H0761I = a Spelling of",
        uStrong: "H0123G"
      },
      input: {
        rawHtmlDigest:
          "f093aef48e93259c22d60a49915bca256fb5c641885c13451b7528df043c32fb",
        rawAssertionDigest:
          "a4589e4acc35c10c7cafe1f49c13ada95d95f5736559fb32c84e42195b538ab9",
        auditRecordDigest:
          "30064aa51d888d48b973b067cd5adc19364a19e13f8809ba517d4abf519916cf",
        candidateRecordDigest:
          "4f7886c6dab00ca81ab64513d6c747fca5b3ce39cda6ff3ae84e5a96ee1b85af",
        stepAnchorDigest:
          "9fe420e7b7fd01fb6653e6aa42810df95b4a3e189c7fee1cb92c5dc5cd202a15",
        firstAuditRecordDigest:
          "9aefff049a63ce4c9fb9ff3a2ff712d1cef601e747173d207aa768316d80efcf"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "823529df03d095d602e36ab0733850ee7152c59da593758b91f75daf108e95a6",
        reconstructionHtml:
          "<p><strong>Aramean:</strong> the Ketiv (written reading) in 2 Kings 16:6 has “Arameans,” while the Qere (read reading) has “Edomites.” This entry denotes the Aramean Ketiv, not an Edomite identity.</p>",
        reason:
          "The reconstruction keeps the exact Aramean Ketiv distinct from the Edomite Qere."
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
      key: "H0763H",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12095,
        eStrong: "H0763",
        dStrong: "H0763H =",
        uStrong: "H0763H"
      },
      input: {
        rawHtmlDigest:
          "2d8de639d5fb6978b3041f3c1f2311f474525cec71856adff8040e7bde969905",
        rawAssertionDigest:
          "7c166526d61d87f7117adae0be5cbd7e79eba4713e0c38b74e34b849c6d06b8d",
        auditRecordDigest:
          "4c08cd6cd58fad5ac2155a1ec4053756acce050e51effc5056401ea08eb0ad38",
        candidateRecordDigest:
          "a48e8d388f0f487f5c41ff5913c3ca9bf30cb0a3b996525ee5f5461398d75e93",
        stepAnchorDigest:
          "65682b76edd3cdb132ea65b62c30dc314304ca5235d15fd98d7884965fa89d8a",
        firstAuditRecordDigest:
          "e074d3ba168c43847fc4a5d764a1b3981b6ab40b462d4c54e8655e7e23f349b8"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "2d8de639d5fb6978b3041f3c1f2311f474525cec71856adff8040e7bde969905",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12095":
          "65682b76edd3cdb132ea65b62c30dc314304ca5235d15fd98d7884965fa89d8a",
        "STEPBible-TIPNR:H0763H:entity:3189":
          "a98f7b832f57fa9a8f11f37dbc5422c13d50ae86d0a6cdf9b0fd29ebbe97b36e"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "3f408e4e7383c604b853a84ca1d697762e8a8d65e40f40da2311eebe5bce1409"
      }
    },
    {
      key: "H0783G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 12120,
        eStrong: "H0783b",
        dStrong: "H0783G = in Aramaic of",
        uStrong: "H0783A"
      },
      input: {
        rawHtmlDigest:
          "7c5ad8b04e7968d688721091c4fbbb8d57e868ca03a6eeebd8fa5c2b7c7909e2",
        rawAssertionDigest:
          "dde8720348b6a40671346601ebdf5ccdf9404c8a9602379b1af4ee93ebc67b64",
        auditRecordDigest:
          "d31242c96439bbed7e15e0fb9529f69ec7edcba54d961207750ad72dcca8a432",
        candidateRecordDigest:
          "d8d4706c732feb3e0a5259ed788a2632517f53472502fb52dc3f508b66eb84a3",
        stepAnchorDigest:
          "9affa89ffa5880148a83e9e95cf97564fbf2e890fafe4e568218bfb7e27a98b3",
        firstAuditRecordDigest:
          "37fc4a48bca34ee29ef6b86e7a8df4e3f802751c09db9efcf3d58df324dd38a0"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "7f7743ca924c34c46345eb055bb54d9b53e4d7a04d0b2a845ec0704d6cb88087",
        reconstructionHtml:
          "<p><strong>Artaxerxes:</strong> the Aramaic form used in Ezra 4:8, 11, 23; 6:14; and 7:12, 21. Current STEP identifies this form as H0783B.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H783b":
          "2f6d6057dbc10b0476efc1acaf5e4feb451a0c23d65d7cc8512a294ec454cff9",
        "OpenScriptures-BrownDriverBriggs:xa.bi.ah":
          "5ff05585e817261c253d68f39db5e3b16f949e652696cf36ef8153bdcf67c07b",
        "OpenScriptures-HebrewStrong:H783":
          "21ad4dc3db83c274f0a2fc2ae48d5631178bce2b16970bbd0cebfb00e1d77d9d",
        "OpenScriptures-LexicalIndex:oce":
          "1b75b60532207553083aeca86b5f048dec13b108d3520bcde90f3e558b461379",
        "STEP-gloss-anchor:12120":
          "9affa89ffa5880148a83e9e95cf97564fbf2e890fafe4e568218bfb7e27a98b3"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "fc05b78bfec5268532f0bc1a180b9822d8604cd3f586d3817ea453e0ee52f9e7"
      }
    },
    {
      key: "H0783H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 12121,
        eStrong: "H0783a",
        dStrong: "H0783H =",
        uStrong: "H0783H"
      },
      input: {
        rawHtmlDigest:
          "116f146051db5b05ad086cf0d631b59b9d0dd31767c9d48598a6c373587964c9",
        rawAssertionDigest:
          "d0d3201ab6033ded904f4234a3e10663c951a303ff508ecc0558d69611bb073d",
        auditRecordDigest:
          "d1fb52d889e8f0a7d78a89b9ed7e67da381f3be7f40f9276efa9b1c3708053fb",
        candidateRecordDigest:
          "9f1f4b8a6a67e419359dbd02b22b996edafe6f6dc6f4f0771ea939ac3f29be8c",
        stepAnchorDigest:
          "9affa89ffa5880148a83e9e95cf97564fbf2e890fafe4e568218bfb7e27a98b3",
        firstAuditRecordDigest:
          "cc388c84f81a3049c37cc857b55ec316ed1f8323a0879e625978a3acb6c5a31b"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "1c377e121b1af031fccf7c76edcd857d282c5264ed03dd415bf3d58afa4b6b68",
        reconstructionHtml:
          "<p><strong>Artaxerxes:</strong> the Hebrew form beginning in Ezra 4:7 and used elsewhere in Ezra and Nehemiah. Current STEP identifies this form as H0783A.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H783a":
          "f14d2d1077f55f2e774956848c9e83b44a1add3b1d9ac04d3347087c36a2a533",
        "OpenScriptures-BrownDriverBriggs:a.ga.ad":
          "8d65ccf7925589443a23eb80722467175ec210a46e2392f68165b6791604d581",
        "OpenScriptures-HebrewStrong:H783":
          "21ad4dc3db83c274f0a2fc2ae48d5631178bce2b16970bbd0cebfb00e1d77d9d",
        "OpenScriptures-LexicalIndex:bew":
          "c4d79a160006f56b6dc24ac92e6d8df6a11090c154c7177cb80c4d8bdb62964e",
        "STEP-gloss-anchor:12121":
          "9affa89ffa5880148a83e9e95cf97564fbf2e890fafe4e568218bfb7e27a98b3"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "8bc8c8ea9eccc04339aee38a01ab92a5189ac3427ea14925e5b0abc95478044a"
      }
    },
    {
      key: "H0834C",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12181,
        eStrong: "H0834c",
        dStrong: "H0834C = combination of",
        uStrong: "H0834A (H9006+H0834A)"
      },
      input: {
        rawHtmlDigest:
          "e6211eddd2b280397d9e50c639c7bff37b22192706d884d622c39918d7506be9",
        rawAssertionDigest:
          "42dfe0d67951d4f4d2e90451466719c77ca12dec455c8528c405926f6015285b",
        auditRecordDigest:
          "d978c968aea5aa72458e6dddfcd276e94394c6d716713262abcffac19ee72141",
        candidateRecordDigest:
          "b9fa5b53ad8b491e1157abecc830efd95736c0c8c9634b1425edbacdab32c412",
        stepAnchorDigest:
          "c49f88050c656575f7d092be67c6ee6823d434f55b8b6f570fc13bb38bc148c9",
        firstAuditRecordDigest:
          "33d73017735104f4c6810ed59187aeb9665796e1fcf4777121eb82215ef39a11"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "e6211eddd2b280397d9e50c639c7bff37b22192706d884d622c39918d7506be9",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H834a":
          "b417a8acf8994e281a68c1547694d6962c282b7cf09e9d138f6ca55cd3fdb545",
        "OpenScriptures-AugIndex:H834c":
          "f282bef18dbd2d8bb2c0567861ec542fc28bf6cb01b44351dddfc62eb093a860",
        "OpenScriptures-BrownDriverBriggs:a.gk.aa":
          "aa3ad9ab807d1f26b6b80c5342b7bd98dca5ff933b4ab3efd3118c6316c52d9e",
        "OpenScriptures-BrownDriverBriggs:a.gk.ad":
          "2370659f67e4d5e664d1cbbfa1c8a2c4bead2d41039ae4c25530cf9c19853ffb",
        "OpenScriptures-HebrewStrong:H834":
          "405056731e3337ef41e5628ad02c394abfcd76ed0973d487a345e03e20d030da",
        "OpenScriptures-LexicalIndex:bgz":
          "fc5b8cf306155fc4ed951d57afe43445dc614d1052899fbf7a251eec938faa48",
        "OpenScriptures-LexicalIndex:gjb":
          "ded6859bbaf629a86ca0af5d66efafc30f1ef3881aa8f3c8b3ffab57b91e826e",
        "STEP-gloss-anchor:12181":
          "c49f88050c656575f7d092be67c6ee6823d434f55b8b6f570fc13bb38bc148c9",
        "STEP-relation-graph:12179":
          "bac079ec438b65edf55259a307950df341a47f719660a277e990182f3ce183cc",
        "STEP-relation-graph:12181":
          "27a63554550faeea3d4194f25be7648cacf139f00ca9e36e0bf1eda6458a3d63",
        "STEP-relation-graph:22674":
          "bf40cacef727a7cc8256b481c3ca353e87e50cabe85e204e37f1d1cc50c98c9d"
      },
      occurrenceProof: {
        count: 17,
        occurrenceCorpusDigest:
          "65746439d0939801f7aa721505fffeb2c25370548b0633165cf855cfa8cd2744"
      }
    },
    {
      key: "H0885",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12244,
        eStrong: "H0885",
        dStrong: "H0885 = combination of",
        uStrong: "H1142G (H0881H+H1142H)"
      },
      input: {
        rawHtmlDigest:
          "2079fd4fdbfc45260e1a44ac7759c9077fc8d848f2e9ecd39291e3210cd1f29e",
        rawAssertionDigest:
          "8e908c472d9966d07bc8a6c46cf8dd8f90d3215defafd68271ff874374614ba9",
        auditRecordDigest:
          "e3ac35dd75ed89da99830b9542020eb36268ddd3b2f687d72190af2d4d1a7961",
        candidateRecordDigest:
          "bbec6b0ecd01e113003e93db9ee09f675aed5232d392c5c9d2d2d72b93694adf",
        stepAnchorDigest:
          "2b8e9bc20b821b946fd9790f46cde4df27302c783fad71465151864d1f9f9667",
        firstAuditRecordDigest:
          "00a689bbabb578a08b01a7bc5061018064849bdc672052913b20ebcbc276ec2e"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "2079fd4fdbfc45260e1a44ac7759c9077fc8d848f2e9ecd39291e3210cd1f29e",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12244":
          "2b8e9bc20b821b946fd9790f46cde4df27302c783fad71465151864d1f9f9667",
        "STEPBible-TIPNR:H0885:entity:3255":
          "30da6da064bdfffae93f8aab62d02dc08bc9bb075e9b84adf4026a2ca1295032"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "69410f0385094cd72f9da343686cd15145f11e0350e3dd5ee837906a38d256de"
      }
    },
    {
      key: "H1006",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12404,
        eStrong: "H1006",
        dStrong: "H1006 =",
        uStrong: "H1006"
      },
      input: {
        rawHtmlDigest:
          "131d27b29758e167afa075501ac9f13724b8af4061ebd6e17c5033080eb551fe",
        rawAssertionDigest:
          "637c9eddc7de48b73d3ba6897654910dfe7d25fa6f835182857181b9a985e772",
        auditRecordDigest:
          "e5c75527161e6e79a776178b3ba0e535a1f43abac6707966bdc41ba4b242df65",
        candidateRecordDigest:
          "01014778ade3f44e4ec6a3c6b72125601df926801d344e9a1c2a4966934543c9",
        stepAnchorDigest:
          "47116303a0a596394172d076daaddd491cbdffa13d77e6e8147f1ac3e3c8b05c",
        firstAuditRecordDigest:
          "657b853c8aa8b0a9ec43554a8ce29fae0449dec53f8c4290a870abaccff838cc"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "131d27b29758e167afa075501ac9f13724b8af4061ebd6e17c5033080eb551fe",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12404":
          "47116303a0a596394172d076daaddd491cbdffa13d77e6e8147f1ac3e3c8b05c",
        "STEPBible-TIPNR:H1006:entity:3242":
          "c028d0ee86b7bcbccf167ab70b0ed1f441e8cea7ae8c5e234274e468e4e7f474"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "a850ff7798806d93e45844200b0470f034c047797fbeb4c3f22d9dc64e25d66a"
      }
    },
    {
      key: "H1023",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12423,
        eStrong: "H1023",
        dStrong: "H1023 =",
        uStrong: "H1023"
      },
      input: {
        rawHtmlDigest:
          "2455d08429f62593282bb6a73a613e367cf7fc39d44ff006498b9bd20a2f4821",
        rawAssertionDigest:
          "643c832930d234a9dfd015220bb0fbe9618d91eefb5315bc5edc7921fb922dc5",
        auditRecordDigest:
          "55c8dd102480ecf4d860ee69bcca8694c09ff88d86a91a0606f7a95c929489d2",
        candidateRecordDigest:
          "bd7cb0db7ae1ebea5cd8bfe9bd1d851ebdeef167240902b917518aaed3275e2c",
        stepAnchorDigest:
          "21a53198e8c885d12c74297783cdfa6e1468d7951b6f1ea93c62a877264a6635",
        firstAuditRecordDigest:
          "5cd57c07dc50d863aaab4365201c3b9f16163a6762ed65b299aed40d046504af"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "2455d08429f62593282bb6a73a613e367cf7fc39d44ff006498b9bd20a2f4821",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12423":
          "21a53198e8c885d12c74297783cdfa6e1468d7951b6f1ea93c62a877264a6635",
        "STEPBible-TIPNR:H1023:entity:3299":
          "4c3bddfc867df2cddf8ea416d61cf0eb17d250023cad04ab177a743c3f3dd933"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "ae31a6c9132ba8fa8f90d0b2b650503aa09a11a638c24b370efd3bf569c50034"
      }
    },
    {
      key: "H1038",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12441,
        eStrong: "H1038",
        dStrong: "H1038 = a Part of",
        uStrong: "H0062"
      },
      input: {
        rawHtmlDigest:
          "eb04fbf554af5aef89fc35d0c5c414f814a168659d1a576373934f3b56d93592",
        rawAssertionDigest:
          "fd636b31dbc1bb1800da58d4e5f7ebaf84b6b338d01f5ff75a5d4c132ba00c84",
        auditRecordDigest:
          "f319fd67f83bf6059d8cfee42c1a3aa73a5e4b3e074fcaa7d060153627869033",
        candidateRecordDigest:
          "acfabd2f999e7bcea2ca55c23747b655c01ce9e52d1148b2cc2e98e4161ff1cf",
        stepAnchorDigest:
          "f0e6208670c6db85af79817c091b6ff4dfc4ffdb1c6e460e419710ee078be63b",
        firstAuditRecordDigest:
          "b47886b957830c4a35efd927f40234c0833ac4c8685ac3f6e42ca3ef4ce8f4bb"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "eb04fbf554af5aef89fc35d0c5c414f814a168659d1a576373934f3b56d93592",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12441":
          "f0e6208670c6db85af79817c091b6ff4dfc4ffdb1c6e460e419710ee078be63b",
        "STEPBible-TIPNR:H1038:entity:3121":
          "8b0da0cd8b8b02ab73d379b972bcc0f3c67a052498f93981a62e2172989c135d"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "fe91ecff2a9e07d4f42728a63d4b45c74d137703a6088c05a5fd5fe96183ee98"
      }
    },
    {
      key: "H1045",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12448,
        eStrong: "H1045",
        dStrong: "H1045 = combination of",
        uStrong: "H6253 (H1004B+H6253)"
      },
      input: {
        rawHtmlDigest:
          "410dd2c92fc61dd8bc64c372010a82c66b9ac702f6415fb8653b6095633ee20b",
        rawAssertionDigest:
          "402019ea5367af8fe00ff4d5bfa79657bbf856da8d4eea137e6ae8260989e8ce",
        auditRecordDigest:
          "e69238a0a611937495bcae61624321788ffb7e41a3629f18c9591a5bbca2385d",
        candidateRecordDigest:
          "c604f6d1f331a80e8f2918b6214742ed32edf60832b9178be73c47d47025eac4",
        stepAnchorDigest:
          "ce325750dd58fc323ce9709876055d5b20b4ffb61227b6ae4707504fb1f14099",
        firstAuditRecordDigest:
          "ab2f837e3338edcd9a39add5cbb017b8232d9964236bd911149c96d5f3f8106d"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "410dd2c92fc61dd8bc64c372010a82c66b9ac702f6415fb8653b6095633ee20b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12448":
          "ce325750dd58fc323ce9709876055d5b20b4ffb61227b6ae4707504fb1f14099",
        "STEPBible-TIPNR:H1045:entity:3271":
          "67d7af948fc72ea6ccdc4c912efd7e1cfcb9b182b59752982e8f75b9dcbf2a57"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "42f77ef94250282f832c8b2704765e64b14f4d729359358afc65f9eb1e0309cf"
      }
    },
    {
      key: "H1100G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12510,
        eStrong: "H1100",
        dStrong: "H1100G = a Name of",
        uStrong: "H7854"
      },
      input: {
        rawHtmlDigest:
          "db1d4b26a15c03a9cbca4f4b7d973f6b022ac0982f7e4d6604d202d4e670bc2d",
        rawAssertionDigest:
          "50d309594ee9d0e52ee2e897e96cb731730432e56497d5c110a349f8a2dd1ac6",
        auditRecordDigest:
          "877b05efb4c99f6c761fa2cd185ccc6db2c3a30d61c173972dedced1e6659776",
        candidateRecordDigest:
          "8f56f3d7d2e7e95250a4335c108d03bce6179b7c63387222f1e1f564ccd5bca1",
        stepAnchorDigest:
          "60225dd76f1c20c6f940ed2ba1f615dabab6fc5bd6ce8b94dd85341d1c82e959",
        firstAuditRecordDigest:
          "2d12e53409ec3944f682b88da7fa99c8fb50e1f1256e960f6645babe70dde8ee"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "5a437a8a59c09682750fd30491d67c29a8185e519482f688cd5ac30e656e24fe",
        reconstructionHtml:
          "<p><strong>Worthlessness/wickedness:</strong> בְּלִיַּעַל denotes worthlessness and, by extension, wickedness or a worthless person. “Belial” is a traditional transliteration; the Hebrew occurrences are common-noun uses and must not be merged with the personal entity Satan.</p>",
        reason:
          "Sixteen exact TAHOT occurrences are common-noun uses; the TIPNR merge with Satan is not retained."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12510":
          "60225dd76f1c20c6f940ed2ba1f615dabab6fc5bd6ce8b94dd85341d1c82e959",
        "STEPBible-TIPNR:H1100G:entity:4202":
          "1ed9d632d3d782796e8d0518a71630568ef64b40ef848990711153879d9e2a32"
      },
      occurrenceProof: {
        count: 16,
        occurrenceCorpusDigest:
          "b09c5a623a0695a81eb7163977f1918517e8855db9a93452243333ad7e49e031"
      }
    },
    {
      key: "H1107",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12523,
        eStrong: "H1107",
        dStrong: "H1107 =",
        uStrong: "H1107"
      },
      input: {
        rawHtmlDigest:
          "28bfb97e705777f9f254c84da9964edf17dc9bee73fb33003315de5c72cce615",
        rawAssertionDigest:
          "293ae7cebee317fa35ef8d188486ab485e642b73426fae2e71dddf5fdb139a55",
        auditRecordDigest:
          "a2c6ff12ce327c246647c46f5c63c260b39f844f73122c9984c59cd1673477c3",
        candidateRecordDigest:
          "675d6de9fc655e69e7955be1a122b4bf86dcfd60cf78bf0cfafa67b4ae529dc3",
        stepAnchorDigest:
          "ef9aaae4bf9c81be9422b50e4422f2576502801e6f2975ad8607a8c835b1f965",
        firstAuditRecordDigest:
          "181f59863b8f70c6c71c3c14bac94d2300b383de8e26d53b2ddf1d06391ead69"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "28bfb97e705777f9f254c84da9964edf17dc9bee73fb33003315de5c72cce615",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H1107":
          "c1f5b43191439d9dbf3a52765d19b99b0375c9d623cf7a1e7183c6802260cf01",
        "OpenScriptures-LexicalIndex:bsf":
          "68ce7181d7934459553690664ff3b2efb5a3d1f6c99025d50e760b16c623ef32",
        "STEP-gloss-anchor:12523":
          "ef9aaae4bf9c81be9422b50e4422f2576502801e6f2975ad8607a8c835b1f965"
      },
      occurrenceProof: {
        count: 17,
        occurrenceCorpusDigest:
          "7cee5a602ef12a0390c21ad269226fc9d92461d0c1e9a6fb5de33b547e0ade8e"
      }
    },
    {
      key: "H1133H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 12566,
        eStrong: "H1133",
        dStrong: "H1133H =",
        uStrong: "H1133H"
      },
      input: {
        rawHtmlDigest:
          "3b6eebcd6912aaa3712420ec8545beddb3ed78426e6f1b2f166c7b790cf9b25f",
        rawAssertionDigest:
          "f42dfefc45cf3ede1ba4cebdff7d385be4b7734865b6d0bbf6d7fc1c67f654d9",
        auditRecordDigest:
          "cf2ce2a687405f2182aebf484597aa55bc7ae74f8e667e3c56a686ec763ac776",
        candidateRecordDigest:
          "816afa99845bb0bc2bb7da004507af48a1662412318e9d89ddfe88ce800bb503",
        stepAnchorDigest:
          "29a230a2c859614c7ea32dab6066c869fd15a877c8b870d0fdf009b566782024",
        firstAuditRecordDigest:
          "5bf7cf41511275f5950b0596392e3d9d45d580f42257a41f43a7666e30c95703"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "7dbded49c1b9dad30e3dc568266428c718e11f58c35b0d204433c8448d3f4279",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12566":
          "29a230a2c859614c7ea32dab6066c869fd15a877c8b870d0fdf009b566782024",
        "STEPBible-TIPNR:H1133H:entity:1227":
          "7ab431984d0a0364859fca0a840be92fbbbdd5184d915811cda3d64eb66c5b38"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "a6720724a8987b663e057c8edfc7943eb8bc01a5028e2387f27b989fa86c4baf"
      }
    },
    {
      key: "H1169",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12644,
        eStrong: "H1169",
        dStrong: "H1169 = in Aramaic of",
        uStrong: "H1167G"
      },
      input: {
        rawHtmlDigest:
          "ff9649d890118e03818b21a7ad45be7c093a5bd1f731a2426d674572c890952c",
        rawAssertionDigest:
          "975d5120dce4366ee1ac4c7690ce199b4e00256e364e5f7f9c00e433ca2ca9a4",
        auditRecordDigest:
          "2bbcb83032d5cbd3ff954341a8eba3aed42bb986d766d1603a02b84196f0384a",
        candidateRecordDigest:
          "9f0b822ff6c8f3ea053b7df3726e8c478c497e0bbaa827c872c3cd1c49fd27c6",
        stepAnchorDigest:
          "d2337a805df58d897f46b0b7a1b388fa65c97013836ca8649cb51e140fe1d00e",
        firstAuditRecordDigest:
          "959bdeb8e81546f3c694a0744f004f61e273d8b5e2a2504f274ccc3a741ede81"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "ff9649d890118e03818b21a7ad45be7c093a5bd1f731a2426d674572c890952c",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xb.ak.ac":
          "7444c3e8df249980c3136837ca516c499c77f09a68b9e454791d77a8c949e54e",
        "OpenScriptures-HebrewStrong:H1169":
          "1910ecd738459a3cde04047a6016347e8dc64bce26914e2c386fd3d604232e7a",
        "OpenScriptures-LexicalIndex:odo":
          "3e3800129a94947acae03297195ce3667818f0082a8827bbab2e00a57aa80289",
        "STEP-gloss-anchor:12644":
          "d2337a805df58d897f46b0b7a1b388fa65c97013836ca8649cb51e140fe1d00e"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "38950660566a03ac1c7bb1b5a137213152de91bb9535e5fd60bb9d2c07be8681"
      }
    },
    {
      key: "H1181",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12659,
        eStrong: "H1181",
        dStrong: "H1181 = combination of",
        uStrong: "H1120H (H1120H+H1168I)"
      },
      input: {
        rawHtmlDigest:
          "b3379df10384d85f55ccf29119882b38f30b1d434f5516b9c579e5421ed19a8d",
        rawAssertionDigest:
          "d62d66f83ef497797d337db2fa78bccadc7463d8a5475eb5e2f274aac8bdc0f1",
        auditRecordDigest:
          "de8b32b4bb0975ed629ba8ba8d0556bc551693f5c4f4ead6b44a04e04fc3034c",
        candidateRecordDigest:
          "413f242e8ad16a9ea3714c80dc5f4060750dba73a9bd4bd1ab854f82166427be",
        stepAnchorDigest:
          "1aa61c2f1af005fd00ae01375bb9361ef1b9989be4b2ef1b09d7a18e26a99855",
        firstAuditRecordDigest:
          "3e49c9bacbf334ab622d7dd7298529b70955314fcfa1ebb220c225771ac17a75"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "b3379df10384d85f55ccf29119882b38f30b1d434f5516b9c579e5421ed19a8d",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12659":
          "1aa61c2f1af005fd00ae01375bb9361ef1b9989be4b2ef1b09d7a18e26a99855",
        "STEPBible-TIPNR:H1181:entity:3245":
          "f49f12494a14d8c209ed0d311169a75e415b93020b55ead9b6f22a9e9a2c3ebb"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "669cf3c76b1ed5fe5cf71fbeac650152080fa8b1a7b87c7fac734894f4b71048"
      }
    },
    {
      key: "H1184",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12662,
        eStrong: "H1184",
        dStrong: "H1184 = a Part of",
        uStrong: "H7157"
      },
      input: {
        rawHtmlDigest:
          "f6756790cff5d0e389389d548bcaf755ff4348375741fbdce049005085664905",
        rawAssertionDigest:
          "07e9d5910dd29f342c9a808d192047acc132dc3e23ea4a51f76026f5e704e091",
        auditRecordDigest:
          "afd93f4d9f586f873c4204803c889a501027b8e6892a7c87651e0cccb260422c",
        candidateRecordDigest:
          "9dd17765ba0eccdb0709dd53df8b537fa79b232a07840e5cfde9d4a2be257f05",
        stepAnchorDigest:
          "c69a98d445608b92e106a7e21d5f06a594ade7dde53e8e287d551f1156e3288f",
        firstAuditRecordDigest:
          "feb8bad09c7b46214dd78bb3fe4f4adaf7383ef73625104d6da84473da208585"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "f6756790cff5d0e389389d548bcaf755ff4348375741fbdce049005085664905",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12662":
          "c69a98d445608b92e106a7e21d5f06a594ade7dde53e8e287d551f1156e3288f",
        "STEPBible-TIPNR:H1184:entity:3707":
          "03839a55a795272be40b265ff3c46cf189381f0e01a07bed2c4d7a0cab9eab61"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "6f4e869d81a412af5ab41aaa0b85c78ddc919dcbb81710277b9f4fee381d48f8"
      }
    },
    {
      key: "H1286",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12797,
        eStrong: "H1286",
        dStrong: "H1286 = a Part of",
        uStrong: "H0410H"
      },
      input: {
        rawHtmlDigest:
          "e534b7253eb52c789f9b4c30d66627b51e669ee44ed3f3a39af159568bf382d2",
        rawAssertionDigest:
          "acf28d7b0157b42210c4790956b754a2e7b4b30bca6601d57251df8e7cb0352e",
        auditRecordDigest:
          "630a2bdcef5ecfe5cef3e20451e0598a9945eb28d4be032aa7bcb3d032eede23",
        candidateRecordDigest:
          "0855f0cc5282c305ea117501bbf14c023d0aa050187989429899e79075345bb2",
        stepAnchorDigest:
          "a7955166006da422e798b145ed9450be928562c8f2beae8804178172303a0c78",
        firstAuditRecordDigest:
          "b26dabc79cd3af56c084bce97bf8f9cb055cb33379e6f30a8169e48c9d59c7c5"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "e534b7253eb52c789f9b4c30d66627b51e669ee44ed3f3a39af159568bf382d2",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H1286":
          "b45507c6a5d6d975bc01536589d0e088f6204b6f1785f974de373056b45579bf",
        "OpenScriptures-LexicalIndex:aqx":
          "0027193beb1dbf56fd9f37d69da27f917cad98527abfb1ceba672be74ff18df1",
        "STEP-gloss-anchor:12797":
          "a7955166006da422e798b145ed9450be928562c8f2beae8804178172303a0c78"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "322efd673fde3bd34dcf4e1dc39408c4d4497fd072f30183ce51b4753ffa6053"
      }
    },
    {
      key: "H1389H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 12923,
        eStrong: "H1389",
        dStrong: "H1389H = a Name of",
        uStrong: "H1537G"
      },
      input: {
        rawHtmlDigest:
          "2b249dafc0cc7cb87367b1b8e956fcb95a2e917ee2ffae0ac1defffecb02f0fd",
        rawAssertionDigest:
          "2f29c6dec52f4171346e6a07637f835feb0d825249a33641abe61c4e7c42e962",
        auditRecordDigest:
          "ef58538ab2b0b619e2b2a0d956d56b2cd2af8fab98efbe14b1234b0f0087160d",
        candidateRecordDigest:
          "a0e2691174fb687944bea10e9ee75b6c4c36ed5a52d34323b98d0b3d33e6f46b",
        stepAnchorDigest:
          "29f9f2eb3254b916d590149236694ff332d6bfdbfd4d5fc356352568e3b22408",
        firstAuditRecordDigest:
          "7a556d419441575a754896c4a038ea2a1a0497a342fe6679592e3ad170b1603e"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "5ac87d8b6672bead5ba78500e5864b2f4e9d0af73575504812f26579d8c7247f",
        reconstructionHtml:
          "<p><strong>Gibeath-:</strong> “hill of,” the first element of Gibeath-haaraloth in Joshua 5:3; it combines with H6190G.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:12923":
          "29f9f2eb3254b916d590149236694ff332d6bfdbfd4d5fc356352568e3b22408",
        "STEPBible-TIPNR:H1389H:entity:3521":
          "6578e6152125307c728bda575ffd627ce66b8358d6ec74569cb61795e20dd48b"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "bb7b9523d6e615c1ad4d498ee23c8f5279296a6d64114b35a6e07dbdebe84c52"
      }
    },
    {
      key: "H1389J",
      counterAudit: "raw",
      identity: {
        stepEntryId: 12925,
        eStrong: "H1389",
        dStrong: "H1389J = a Spelling of",
        uStrong: "H1390H"
      },
      input: {
        rawHtmlDigest:
          "925299ad1393e549d1e114fb6360ac387d01e8a1cacc355782692f016949e350",
        rawAssertionDigest:
          "20649a777de41053d40c8151b0e8f34a2fd9e9be54e1b3584c98fb11f89cd5c1",
        auditRecordDigest:
          "ab734eb6a360de061a7ecb198966b67f41d0ab0b4ed935eac6adc2ce90aadd06",
        candidateRecordDigest:
          "d37716f52b054110f32a6e99d4677bea27ffd9c2dddeb25458f83e119fc14fa5",
        stepAnchorDigest:
          "a98045eb13c43a2689cad677cb3af817826d4f818cf005e2dd5b1359ac344840",
        firstAuditRecordDigest:
          "e9c39ffea1dd22e488011a22dc7fd288b73cc255aa549be07b4d342ac102780a"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "925299ad1393e549d1e114fb6360ac387d01e8a1cacc355782692f016949e350",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      key: "H1499",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13060,
        eStrong: "H1499",
        dStrong: "H1499 = a Spelling of",
        uStrong: "H1498"
      },
      input: {
        rawHtmlDigest:
          "f662ae115de351a9f57faaea451fb6f233e0ad81bd5ffa40c89e974adbd990d1",
        rawAssertionDigest:
          "626d300618848e7e28953a60cf0dd0e0959d17de90cf6d39260ae5908f9ee853",
        auditRecordDigest:
          "79c7427126e8ca63b407243741acaeb01c95dc60f8d638153b4ad33830438c19",
        candidateRecordDigest:
          "3bf704c307c4d5ea0aeb315a9db8138367ea15fed119dedf312e8492541e26cd",
        stepAnchorDigest:
          "36c424c70150ced87794e442cbf9858c737fe558935734bb186328d61e9f50dc",
        firstAuditRecordDigest:
          "6f1eb92b1362f9a62d3590d9154d1c2f332abd5e10c5d088535dac29229bb155"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "f662ae115de351a9f57faaea451fb6f233e0ad81bd5ffa40c89e974adbd990d1",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:c.bl.ab":
          "582246d68ba19fb72fa906cbe5c395dc026cb5c64763c655d90ca6488fc69c5c",
        "OpenScriptures-HebrewStrong:H1498":
          "cdfea2b89773d64447f1396f0973a15cb27b3817abaf62848a10d723e016f520",
        "OpenScriptures-HebrewStrong:H1499":
          "86a135647b0471a0a6e7baa7db79ae68b3d12010fc40792370275e43895798f6",
        "OpenScriptures-LexicalIndex:cid":
          "37d6636aae52623def721441098fceafa9a9442a9a55cfa00994f130ee2f9b8e",
        "OpenScriptures-LexicalIndex:cie":
          "63c6a6e7df31382ad0f4a96cd9f280dae75ad516ecd114e6508398603d8f0b23",
        "STEP-gloss-anchor:13060":
          "36c424c70150ced87794e442cbf9858c737fe558935734bb186328d61e9f50dc",
        "STEP-relation-graph:13059":
          "f8b7ad336c0832ac707a240695f8d9314d5d10362c5c3c1c5b2c3a7fff139717",
        "STEP-relation-graph:13060":
          "96750b73f311cfdee97362b9e1c094c99b378c23504b1c702b7cd1a33a215de1"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "aa92df9b0b3bec745cce4970d0ee506d13e31384ac599ddd5cda1a4f0711102e"
      }
    },
    {
      key: "H1516K",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13081,
        eStrong: "H1516",
        dStrong: "H1516K =",
        uStrong: "H1516K"
      },
      input: {
        rawHtmlDigest:
          "9c541db1495328a8106a2cf75a10d60c020484bbf026b109115541009d205c39",
        rawAssertionDigest:
          "d5f70a74e83eea4c212a78f85e54e8c9698e5abcc3b5888a393a5b4780a99439",
        auditRecordDigest:
          "42c648405129ad58545fe9849116108b99362f74dc80649ad53310d534c65295",
        candidateRecordDigest:
          "2baa6ddf9e8fbb2f4fe73c5a6c632c22720665b236217e42f2af06088a326dd4",
        stepAnchorDigest:
          "fa5f452cb58256c9148b19b778c0d0e4f9031cbbd3082a8c5232123e77e6028f",
        firstAuditRecordDigest:
          "e083a79539a06de08ef8230fb415eadfc9d28b0541f6f562dd224d18f57fe68b"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "9c541db1495328a8106a2cf75a10d60c020484bbf026b109115541009d205c39",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:13081":
          "fa5f452cb58256c9148b19b778c0d0e4f9031cbbd3082a8c5232123e77e6028f",
        "STEPBible-TIPNR:H1516K:entity:3500":
          "b1f0215f019d1337936c2e5775d17eeb3493dd6acb99740beb6a5614995b3d91"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "d9dc14b2be91975aa19a50d8c6993ffad7c7518611cebc55dbee4c5d256c6ebb"
      }
    },
    {
      key: "H1661",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13264,
        eStrong: "H1661",
        dStrong: "H1661 =",
        uStrong: "H1661"
      },
      input: {
        rawHtmlDigest:
          "276bbf1312ec64c54dc476063bf348db337804bfe7412797bebaee5ea1e0b19b",
        rawAssertionDigest:
          "8bfea9dca259726abbf73fec5332cb1736ad139bfa46791a60662166bb2fd892",
        auditRecordDigest:
          "30f79faa2557450fbc57309f31ded4fa33564aabca6480348cc35ba558581f56",
        candidateRecordDigest:
          "ba61f2f210056b6f279596769e1bdc3c62a9534fe98b8723275d356da00cc359",
        stepAnchorDigest:
          "cc0396d52d8bfb34eda7608c7ba928a2f11831414dbcad8ab358387bdf62f25b",
        firstAuditRecordDigest:
          "3d3c733696966663054f6bcd69a2abdd9652cdcb505dee635aa441f617803de0"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "276bbf1312ec64c54dc476063bf348db337804bfe7412797bebaee5ea1e0b19b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:13264":
          "cc0396d52d8bfb34eda7608c7ba928a2f11831414dbcad8ab358387bdf62f25b",
        "STEPBible-TIPNR:H1661:entity:3488":
          "803f3edf595e871dd44aa94a30d6bcf0be171b2d4cda238b06c663d06b20baa4"
      },
      occurrenceProof: {
        count: 33,
        occurrenceCorpusDigest:
          "5a653acd0161fc8a09f703c36dccf6246f58648d120cead97e4f52e8d2a8bb1d"
      }
    },
    {
      key: "H1665",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13268,
        eStrong: "H1665",
        dStrong: "H1665 =",
        uStrong: "H1665"
      },
      input: {
        rawHtmlDigest:
          "2c41b97175c2a1cf073a4d670a22ad6c6b9c219612594e1014e8500d2252c9d9",
        rawAssertionDigest:
          "87a4654b410342b1329043db63e5a7481e5e38cdb0b2548635166840151581d6",
        auditRecordDigest:
          "c0cc72369c436f40455f87abe0b0d3145a4682faabebd55a45d3b0b1a5ab8c4b",
        candidateRecordDigest:
          "7639c0b7ab8f404b2179aede5b4456f0ce35adb56e18eb7d5afd0f942322bfaa",
        stepAnchorDigest:
          "78164ff04f676a8dac255ca2c15771fef6558fd0e279d9e2c653066a23b5519f",
        firstAuditRecordDigest:
          "4e66039e598685808c41cb91cb24c78bf630214a40757fa0dab29059abd833d8"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "2c41b97175c2a1cf073a4d670a22ad6c6b9c219612594e1014e8500d2252c9d9",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:13268":
          "78164ff04f676a8dac255ca2c15771fef6558fd0e279d9e2c653066a23b5519f",
        "STEPBible-TIPNR:H1665:entity:4164":
          "1ed92e6b3f34c7389bb21fba7bf84259a79e979d403fd1293f1085672f28a64d"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "af3f5984e7a785fd5269d8e71002c65501b96a9827aadac3eef799c9b2e5b843"
      }
    },
    {
      key: "H1668",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13272,
        eStrong: "H1668",
        dStrong: "H1668 = in Aramaic of",
        uStrong: "H1454"
      },
      input: {
        rawHtmlDigest:
          "eb7a6045ff73b38738d6ccde949937029ee8d6b0d4f66c5d4b34bd6a481f277e",
        rawAssertionDigest:
          "29783e9ea1f9c761b018d34ae7d03cc8025f172b3453648f90ef6f6154d0cc81",
        auditRecordDigest:
          "5cb494ea4676c12f5bbe1e6ae79d33989cebc2cb1bc4dbb9b1aad1cfc02f0abe",
        candidateRecordDigest:
          "f95503bf9b611c512e684ef2372a37638f7a5c52657e7db0775ec5741abbf97a",
        stepAnchorDigest:
          "3711833ed3c5795ecae16717e9469b20ab8bbb592c7c2b99b02be74b111f3739",
        firstAuditRecordDigest:
          "2f9fba413641b822a9d7e0b47131eb792239ef21a391c56dd2bd8b396e104e42"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "eb7a6045ff73b38738d6ccde949937029ee8d6b0d4f66c5d4b34bd6a481f277e",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xd.aa.aa":
          "33577132d837d6941d662f9586942d3d6702515b1bb9b4da2784cab09a0488ba",
        "OpenScriptures-HebrewStrong:H1668":
          "10b4ff552bc430b3b017442bdacd91bdb5f95afc5cb8babd6762d2d9e7ede458",
        "OpenScriptures-LexicalIndex:ofa":
          "ed59e82db5ec980209d677bc0d25a9fcb2e05c250515225b8bfa241d1505a83e",
        "STEP-gloss-anchor:13272":
          "3711833ed3c5795ecae16717e9469b20ab8bbb592c7c2b99b02be74b111f3739"
      },
      occurrenceProof: {
        count: 6,
        occurrenceCorpusDigest:
          "c88f59c9f243e5a7af357bbb5e0797e1c2b35b66bc8dafcad052377f56e824b5"
      }
    },
    {
      key: "H1697O",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 13315,
        eStrong: "H1697",
        dStrong: "H1697O =",
        uStrong: "H1697O"
      },
      input: {
        rawHtmlDigest:
          "01fd4c01fb39c7cb5bf0129d28d32e55fae9b2fab32e86734fbc121b25359d45",
        rawAssertionDigest:
          "11f24c2f2f636c21dff1d0f2f49a6a01da219d623d6cf0fedca71fa87e758680",
        auditRecordDigest:
          "09e835ea52727c8ed690110a56551366f47ea57f55a694ef5c9e6304688ccce1",
        candidateRecordDigest:
          "972da8f2d12f1bbe061d525885c5f68497146b0214aec73023150bdefb06b92f",
        stepAnchorDigest:
          "7f4b66c6af27c404d39f4b22e5178abf316dd640e94dedf0c69d677aea92a801",
        firstAuditRecordDigest:
          "4a16bb77a843070f113f3fe9c6b606617fcb9a70d313c8612252321cf9b108aa"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "3fa397ff83b1260f8e0f760faf8383929ddffc35d83b8ce37eb77d823d83d96a",
        reconstructionHtml:
          "<p><strong>Chronicles/records:</strong> STEP’s title for the royal annals and similar written records cited in Kings, Chronicles, Nehemiah, and Esther. The underlying דָּבָר means “word,” “matter,” or “deed.” Current TAHOT also assigns H1697O to unrelated phrases such as “according to this matter”; those occurrences do not carry the title sense.</p>",
        reason:
          "TAHOT also assigns this key to generic non-title uses of dabar."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:13315":
          "7f4b66c6af27c404d39f4b22e5178abf316dd640e94dedf0c69d677aea92a801",
        "STEPBible-TIPNR:H1697O:entity:4156":
          "1b08836944649c4d8d1f88931b4bdadf873f837c1ed36d8caa6a6c2557f5e68b"
      },
      occurrenceProof: {
        count: 60,
        occurrenceCorpusDigest:
          "83fe8ba97262cce888a95b0d6ae6190e58b2961d83a63f619618414efaa98b9a"
      }
    },
    {
      key: "H1761",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13392,
        eStrong: "H1761",
        dStrong: "H1761 = in Aramaic of",
        uStrong: "H1760A"
      },
      input: {
        rawHtmlDigest:
          "0cfe7ace5aeb777ddc2f7066fee1e620f814a10bb5c2aaf32a7379c32a89b04b",
        rawAssertionDigest:
          "e9256a903dc55071c6531bc505f50b9b18f01d357bc0cd8f92bb596543b6dc8d",
        auditRecordDigest:
          "c8415d5cbc891f775af3a9ca7f4889d29fd1e3ea92a4c33770f6ddc79adefd7d",
        candidateRecordDigest:
          "26bf58434823b819cac9bfd34391bb275a291e494b1f20ad3c43d2199a626e62",
        stepAnchorDigest:
          "94d09e010dc3aa5ed48c7d0203e26afcfc57f2c39058467cb4d557f35652eaef",
        firstAuditRecordDigest:
          "0bd26e6b5c0f09458b5bf5d79c8df57a75f350e41b4502eec9b8401f8d844f24"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "0cfe7ace5aeb777ddc2f7066fee1e620f814a10bb5c2aaf32a7379c32a89b04b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      key: "H1857",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13508,
        eStrong: "H1857",
        dStrong: "H1857 =",
        uStrong: "H1857"
      },
      input: {
        rawHtmlDigest:
          "f3964b79af08a83bfca67c1b105167099872802a8ef3a523eb85617c5cbf5b7a",
        rawAssertionDigest:
          "37d8e52542de55af584f8c7f322d70e071ac4d28021711ec63c726803a3ec782",
        auditRecordDigest:
          "0deb580945a9bae2fa9cb1c3d73422571c32cf29109fc5779a03eca2944a36ca",
        candidateRecordDigest:
          "fd16e174f170c8afdfebad3ac2ff0e44bc2c3dd48fed17aa7c029d24ebac63a5",
        stepAnchorDigest:
          "080df4cda0b53acae080df27024ea90ba1fe9c1603d1e7ab84f65702ee065942",
        firstAuditRecordDigest:
          "0fa43bbb3b8a641c9f2fad3985e69797f4897cbea71ca775ce5607a594387f6c"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "f3964b79af08a83bfca67c1b105167099872802a8ef3a523eb85617c5cbf5b7a",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:13508":
          "080df4cda0b53acae080df27024ea90ba1fe9c1603d1e7ab84f65702ee065942",
        "STEPBible-TIPNR:H1857:entity:653":
          "10874d1450707bbe2699d35f62fbd2119709782b2ebc1717dc7ecdea7322f8ee"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "81f01e26e9de94bfb60018ed2004459cc514e3eb2ff8a49eb2e538fcef685bfc"
      }
    },
    {
      key: "H1902G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13563,
        eStrong: "H1902",
        dStrong: "H1902G =",
        uStrong: "H1902G"
      },
      input: {
        rawHtmlDigest:
          "b1342e281613fffbd045cd30f91d95ab81287f7d6bd3296e252a4526e16c171a",
        rawAssertionDigest:
          "16c685bd518c51af37ecd158c30fec055f7fd67160af8275f74f0f5f82a0e167",
        auditRecordDigest:
          "759842f9142bba303414b52b6a741ac1cb809fffbde4303ca56647eebe026a5e",
        candidateRecordDigest:
          "6f8a0b52aed1fb527e5d4bb6f44fdd941d1868b7b5bd3e7f093149995bb1a386",
        stepAnchorDigest:
          "e6ca0a8e85b44993ec20f116d77278bb4b010881f5e6708e18728c6928efd6c9",
        firstAuditRecordDigest:
          "17ced18c398d48cd8c4cb93d9ae244774322b781f6d12d9dabac1a2e6fbef79c"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "b1342e281613fffbd045cd30f91d95ab81287f7d6bd3296e252a4526e16c171a",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:13563":
          "e6ca0a8e85b44993ec20f116d77278bb4b010881f5e6708e18728c6928efd6c9",
        "STEPBible-TIPNR:H1902G:entity:4166":
          "63b98c4a8ac5e9aded03374c5fcd91c34082d4b5d572232d744995f7c0a2b53f"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "b4f877a12f5570b44d7e9df4e5b859f21421500918de4fb3bd5c6ca593247b09"
      }
    },
    {
      key: "H1934",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13601,
        eStrong: "H1934",
        dStrong: "H1934 = in Aramaic of",
        uStrong: "H1933B"
      },
      input: {
        rawHtmlDigest:
          "bbdd1ba4b1a3f69ef0cc34a29d19d1f233f873baf329b660cbcef2bdbe6328da",
        rawAssertionDigest:
          "a6f206670f525e71d7b3e0d3df889699e48029f6121cc2ccc6656841fb391329",
        auditRecordDigest:
          "8b2b5c9fbdf117e2476c06075779585b032948fb7eab9c517ffba5978d98c331",
        candidateRecordDigest:
          "240ebe836bbd24ee2a7213f9e85ebffc6d8a001d6a1253ad7c6cd912bb9ef6f7",
        stepAnchorDigest:
          "bfd93c5a026c2dcd87f7678382f3d5fcb3ae82986c51064d72fea193325d7850",
        firstAuditRecordDigest:
          "146b14a1a934287f4b758e08db9e0f3331b0a4082a534df1ff417c7b8619fbb6"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "bbdd1ba4b1a3f69ef0cc34a29d19d1f233f873baf329b660cbcef2bdbe6328da",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xe.ae.aa":
          "9c18636c834e0fe512af4e418d85e61a8934d2f7a7f639af19fcb8eda9352bff",
        "OpenScriptures-HebrewStrong:H1934":
          "c2dc825fa4513826790561342efa5bdab922926b7ff740b0b5c275f4f5eb5d4b",
        "OpenScriptures-LexicalIndex:ogs":
          "abc28e65d2799ac1600f0e6a67d1f75f29e498acbe31b8d89a1a78da1474a995",
        "STEP-gloss-anchor:13601":
          "bfd93c5a026c2dcd87f7678382f3d5fcb3ae82986c51064d72fea193325d7850"
      },
      occurrenceProof: {
        count: 71,
        occurrenceCorpusDigest:
          "da32df18f13cb4b0f4c9f6bbe0f0ae6ac8b481bb3300583267123bf73c880520"
      }
    },
    {
      key: "H1940",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 13610,
        eStrong: "H1940",
        dStrong: "H1940 =",
        uStrong: "H1940"
      },
      input: {
        rawHtmlDigest:
          "be32ca7c071bccbc6b8105b4d9c71847ad2aa48696ccde8a4497705759f1d395",
        rawAssertionDigest:
          "e51e32a89234996f86e22017da77562943c0cd371ab66bb40a6e5016cc403655",
        auditRecordDigest:
          "44d0b0d9a033f86d12d59a6f920f30b25dba86c5df5c0530f7d03bf19f30ea86",
        candidateRecordDigest:
          "fc8d2fc192e9c588b3acf5578357b855e2d879bcb437651972e41c19a917e2ba",
        stepAnchorDigest:
          "ffe07fe4574fde7b5ead0a153759d9811b7a67c7a98011747766af4e77787b49",
        firstAuditRecordDigest:
          "09ce815d6599951dc206c7cdc9c5accf6e2057300638d3a5148993e1bae9f841"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "cb9e64416942f461d62e03145d0d6d85761486fbb3fb53fda33dbe0ecc3f501f",
        reconstructionHtml:
          "<p><strong>Hodiah:</strong> a man named in 1 Chronicles 4:19; the verse refers to “Hodiah’s wife, the sister of Naham.”</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:e.ay.ae":
          "51b562aab38d8089e7e2d5720c0bb9e48ae9de29528a3a1bf6279da686c44907",
        "OpenScriptures-HebrewStrong:H1940":
          "edc4a64fbbc8fda3001558a47ebf4e138bc5a47b3703668ab5dd779bd5d1caf1",
        "OpenScriptures-LexicalIndex:czu":
          "31f8d6ade6505036f3694c3902c5198f67095be9913e39903feff05dd667f68a",
        "STEP-gloss-anchor:13610":
          "ffe07fe4574fde7b5ead0a153759d9811b7a67c7a98011747766af4e77787b49"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "d64ef71e13d7e508ba3913a31f6120ec2c64449a8cf823755c0fba27eef116f8"
      }
    },
    {
      key: "H2079H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 13801,
        eStrong: "H2079",
        dStrong: "H2079H =",
        uStrong: "H2079H"
      },
      input: {
        rawHtmlDigest:
          "42a3a9d3b59fdbde6223981e448b64f382d143076d1920bb4f435a7752f1ba86",
        rawAssertionDigest:
          "65e89cd72358ba16d3bc9922d21220688306b22467a0f8982098a3ffe4f95d9f",
        auditRecordDigest:
          "15fc80a5d9d318ae9c909a1fa34fe2cd82d7949d970e0197f4916c7c4cb8f442",
        candidateRecordDigest:
          "ef6177306427ef8092e7bf54902e9978f9646c333e3438146c5b3616a188ff38",
        stepAnchorDigest:
          "1840a2c56e78eaf7aba85f4afffcddb0bbd8b30303400ea013de2c73bed69767",
        firstAuditRecordDigest:
          "f6247a03f2f9be8b19268b68e72f78962beabd08bd7aadbe357f0c174a661fe0"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "c5f5c1955416840f8e151ce1985bd4a4628918486a0662b83f787e046b466025",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:13801":
          "1840a2c56e78eaf7aba85f4afffcddb0bbd8b30303400ea013de2c73bed69767",
        "STEPBible-TIPNR:H2079H:entity:2913":
          "837f9b0223ae5526212209961140df134a58ebe2b22e6d0405a71f3a517b73ac"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "e6703045700461dddf105a29d8c41792901bd7bbaa1ea7dad3723658908a9f85"
      }
    },
    {
      key: "H2128I",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 13860,
        eStrong: "H2128",
        dStrong: "H2128I =",
        uStrong: "H2128I"
      },
      input: {
        rawHtmlDigest:
          "1c437be1277654e7d28d91e781f1aefc1a82f54c13793896c7cb51ec02c54b84",
        rawAssertionDigest:
          "af792b2cb5e3a6b8d31877ef785cdcfb339f3f3a6620dc7dbabdb2f709c8bbe7",
        auditRecordDigest:
          "3bb3da5bab57cf5fe8d2cd5e461427ee35f0317830fd8a17c8aeb5bbfe22c28f",
        candidateRecordDigest:
          "9af1b77240e5a23d43baded989006d302dec6357c2307fe3ac1c6b51f88d95f4",
        stepAnchorDigest:
          "67d08b5265d13ba6a428d8e37896c30d797c5df0d70697a2b24d47ac580cfdff",
        firstAuditRecordDigest:
          "6b3307af98956dc704ed349514b1af07ddbe8ded263c7f098682ee44eb78cd23"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "9c9b4348373f6e84377c792940c268ead23a63a95436e16aa2d5498e34278d05",
        reconstructionHtml:
          "<p><strong>Ziph:</strong> in 1 Chronicles 2:42, the name associated with Mesha, Caleb’s firstborn (“father of Ziph”); the same STEP key is also used for the Judean town in 2 Chronicles 11:8.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H2128":
          "af78c34ceee7b86e5c833e1f47da8ba5e6a1c7cbf24db6c72984c2b8ba3c128e",
        "OpenScriptures-LexicalIndex:dhs":
          "b7ac931a6a37b14201e4d96d82142c3969b0abe1ebdd604e8250b14daa204080",
        "STEP-gloss-anchor:13860":
          "67d08b5265d13ba6a428d8e37896c30d797c5df0d70697a2b24d47ac580cfdff"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "5d17dd497df45ec8c78fafe50dc8a0daa241b365519b09fe9edb4f1b9fd42ccf"
      }
    },
    {
      key: "H2132G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 13866,
        eStrong: "H2132",
        dStrong: "H2132G =",
        uStrong: "H2132G"
      },
      input: {
        rawHtmlDigest:
          "9a6c3d5752dbe60229f2c224e60b2f7fbe9ccfd5dbcf5cc53046451ac74de6e4",
        rawAssertionDigest:
          "2700af0c496462ba9391ce17573ff58a81b1fa6e95f5ad7b2cb9afad6f9485d4",
        auditRecordDigest:
          "00505092e2ae9f147bb3342394148d7af539864b964997381b5699e9e6c0c3e8",
        candidateRecordDigest:
          "8ef45be226ab8488b66b1b7e0e338da1def652165c757028b4b3c6af14894525",
        stepAnchorDigest:
          "4b071f6d2fa267a90251d36a28bc27181ef9e654733d0317a18e849b11d0945b",
        firstAuditRecordDigest:
          "76a2b285e119d61134616c0e87c922d3517e7a49ed8c0e53f8e789fb09bc87ee"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "9a6c3d5752dbe60229f2c224e60b2f7fbe9ccfd5dbcf5cc53046451ac74de6e4",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:13866":
          "4b071f6d2fa267a90251d36a28bc27181ef9e654733d0317a18e849b11d0945b",
        "STEPBible-TIPNR:H2132G:entity:3847":
          "85b77c9fddb33a0618d3d0b9945eb345b02c43c5575f63b5405035dbff677907"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "9cff3d23f1e291b332bfba177e51b0fc6862b282b9020e4f006aba77f1a39cf3"
      }
    },
    {
      key: "H2256A",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14060,
        eStrong: "H2256a",
        dStrong: "H2256A = a Name of",
        uStrong: "H0303"
      },
      input: {
        rawHtmlDigest:
          "be757eb2cd0faec1aa407a4a84ae07e8afaecd662884186d7744314869445c0d",
        rawAssertionDigest:
          "2bded0ac5b0652b34cfd79f5685e41b6e4a0588db56136cc40778d64cf403faa",
        auditRecordDigest:
          "6ed52444a514886e8c14ecfb55a3fd0874ebec4afcf25615bf6cf1a4cdfda104",
        candidateRecordDigest:
          "3b404932c22e5b79d9b766bb96819aa543baec9e57eaf53eefd454b278a1d52e",
        stepAnchorDigest:
          "cffc180b78befe55df62c737203ce1b3e15d4fd4926ec26d0fa33c02954cfac6",
        firstAuditRecordDigest:
          "8a99592c8f876f441c0db205ba6a2b13a697045b706adac57fc71821aad40255"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "be757eb2cd0faec1aa407a4a84ae07e8afaecd662884186d7744314869445c0d",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:14060":
          "cffc180b78befe55df62c737203ce1b3e15d4fd4926ec26d0fa33c02954cfac6",
        "STEPBible-TIPNR:H2256A:entity:3148":
          "c99a14310ce12669136ecde1e58608e6098131afa9286a613010f7e2e7258207"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "247f36e9b693341f77741b8307d6315b9f789183915d0cba651883ca546640c1"
      }
    },
    {
      key: "H2289",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14105,
        eStrong: "H2289",
        dStrong: "H2289 =",
        uStrong: "H2289"
      },
      input: {
        rawHtmlDigest:
          "71027508c527d9b1736c8a713671812edd47b4f7c5b9e96aeeda6cf6117a239b",
        rawAssertionDigest:
          "7a623527c63a5cbaf806148a8a1c2be78c4703026f06f2a7edb6c54b25567493",
        auditRecordDigest:
          "7041d7a2bc28c16dac276761c1d1a997fff293f89ecf6b891fe90fe0298c1e34",
        candidateRecordDigest:
          "d0129373dd65b13d45722eaff87072fd9367bd97e7ad1ca35fb37c37015fff70",
        stepAnchorDigest:
          "23a02faef4a5267e814ab35b75ae1ed963b6c092f091b7e4477a0302bdb019e0",
        firstAuditRecordDigest:
          "84a46a8c92903d741cb7a47e3f5910c3ba0b311da7d06d1216c3c374e20f45cb"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "71027508c527d9b1736c8a713671812edd47b4f7c5b9e96aeeda6cf6117a239b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H2289":
          "3136e256f6ead93d7379dd88292c6fb7e8423decbefa83497a2a5dc465e14f5b",
        "OpenScriptures-LexicalIndex:don":
          "2c31e84bd088510fd90995501d99f41a7dcc0a7c1a8bb77351cffa97ea299c70",
        "STEP-gloss-anchor:14105":
          "23a02faef4a5267e814ab35b75ae1ed963b6c092f091b7e4477a0302bdb019e0"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "35f63fab69af0dcfe1ff90dce961235285b853116025e72fa120123cab934172"
      }
    },
    {
      key: "H2303",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14122,
        eStrong: "H2303",
        dStrong: "H2303 =",
        uStrong: "H2303"
      },
      input: {
        rawHtmlDigest:
          "dff851d5c232f64d283885d02f191a4521dd5cdddd79fafba54de620f7073050",
        rawAssertionDigest:
          "d6f8f62e52b64a16fb91f5ea29c4408ca4b41e2a4fa0360c65961dea71b96e1a",
        auditRecordDigest:
          "de5430d96c67f61b24551d08aac211c80aa55c0bbe91aac3aee8de99a125cca0",
        candidateRecordDigest:
          "332940b1abd84dc4a4896ffa08b5eb198d8b02b93e2206cacf6cf35566f3913c",
        stepAnchorDigest:
          "059bb44a77d0ba240041c0b66065ef24283d101b8eab8b4ad9c842edf37ef23a",
        firstAuditRecordDigest:
          "51bc93ac551026d393fdbf007c8825a68740ddffcbc4eb0d3739e30ee495cd9e"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "dff851d5c232f64d283885d02f191a4521dd5cdddd79fafba54de620f7073050",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H2303":
          "875d985cf4394855800aee094170a855709d459baf039c2e75f8c4b5e74d6c51",
        "OpenScriptures-LexicalIndex:dpc":
          "51d68eb3174084c1de170ff2bfb4a0d6a95e350c98b956ecff23cfc33f09b2f8",
        "STEP-gloss-anchor:14122":
          "059bb44a77d0ba240041c0b66065ef24283d101b8eab8b4ad9c842edf37ef23a"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "9ade3ba9fff9bb1203652f7a4550de694d0649547ed24766c6a25f58ee598aa0"
      }
    },
    {
      key: "H2335",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14156,
        eStrong: "H2335",
        dStrong: "H2335 =",
        uStrong: "H2335"
      },
      input: {
        rawHtmlDigest:
          "f874ea55cf0bdc40da3a6ebc2aec55636cc95f710b1531473a57ffa27d5cd6f0",
        rawAssertionDigest:
          "3c6f6c7f8f79c559414c011f1c21d82755da8bc06b38b666922bbff0dd2076c6",
        auditRecordDigest:
          "cf3d2eb03bc2c0fe94a141bec5b1bbd8fdb8844240f884eb4a7cf19a3b51663e",
        candidateRecordDigest:
          "aeea872669984dff514d800110c5680e1097e9d6c6895ee7a7cd0a7d9804f379",
        stepAnchorDigest:
          "c8d4bca2fb660c7cce7b2e8699ad7743777ca22051a77bae49a1318149b08485",
        firstAuditRecordDigest:
          "3db6d988e83669e911458d66f77830e794971131ce4aad38a217c39849d6f4cd"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "3b5aeed437c271b7396002e58da118af0f6587581cb3a5dbbabee358200b35c6",
        reconstructionHtml:
          "<p><strong>Hozai / the seers:</strong> the expression in 2 Chronicles 33:19 is read either as the proper name Hozai (Chozai) or as “the seers.” It names the source in which Manasseh’s prayer and acts were recorded.</p>",
        reason:
          "The reconstruction preserves the genuine Hozai/the seers textual ambiguity."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:h.bp.ac":
          "b34b92e96e3b479af5a94c85d6bd13a78475f2fb7931a59aca0446c660f3c521",
        "OpenScriptures-HebrewStrong:H2335":
          "7a7b344fb1b98de183fc929b76e101e144d1797505895892e99c488c165eae97",
        "OpenScriptures-LexicalIndex:dqi":
          "df38c6b73c3f0ddaf1383ba1fa0a47727b7c43fb3bdddaf21feb8e442c51b8d1",
        "STEP-gloss-anchor:14156":
          "c8d4bca2fb660c7cce7b2e8699ad7743777ca22051a77bae49a1318149b08485"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "7680026a3dc0b7d977e832f24112283b83619743a4420d98113567eceb1df9df"
      }
    },
    {
      key: "H2589",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14500,
        eStrong: "H2589",
        dStrong: "H2589 = a form of",
        uStrong: "H2603A"
      },
      input: {
        rawHtmlDigest:
          "d08330a64e5b3dbd12a4f84971a188b353af5863205658d5bc2acb6e77c96fa6",
        rawAssertionDigest:
          "1d64d3908306f68966c591c677c923b03eb9cf995aa84f8f0300722cfd8e6d47",
        auditRecordDigest:
          "618e167db6bde99d476015b1c6b95d7f2150e8679ef011531a330a3b36b651e1",
        candidateRecordDigest:
          "f93d944681c2bc8d93d74de150593998435ca60e6d0f66e38abc3b5759c16ee1",
        stepAnchorDigest:
          "307dd098efdd85ddd0c116b21c1fb86b2329840c57be42bbd97f07e8622c5003",
        firstAuditRecordDigest:
          "a79ddc928852a72c21c378121554376b2f39126a5b9dd1da5f9991e8bc226355"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "2aa8f91290a00638ed276b2f0dc150d75289179064db1b5684e7592ad5a062da",
        reason:
          "The raw notice mixes verbal and nominal morphology; the audited exact lexical companion gives the verb's favour/entreat sense."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:h.dz.aa":
          "3ab64d20e02c2361d30aeefec3ec6ad0680e1efa7d598f71a675c491a8ebbeb5",
        "OpenScriptures-HebrewStrong:H2589":
          "8437c8b9ce85e6161dd9a0eb145b8faef62d85f0cd46ab9c554f783bd7a19f1b",
        "OpenScriptures-LexicalIndex:ebm":
          "19cea59dd604940e0af8878c8c70b77bb1eaa19f330f979703b83fff846c769f",
        "STEP-gloss-anchor:14500":
          "307dd098efdd85ddd0c116b21c1fb86b2329840c57be42bbd97f07e8622c5003"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "eeef815e22b3c4c363cb3a9817e902cbb542245ff739f6a902f8248825af676d"
      }
    },
    {
      key: "H2604",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14518,
        eStrong: "H2604",
        dStrong: "H2604 = in Aramaic of",
        uStrong: "H2603A"
      },
      input: {
        rawHtmlDigest:
          "398d0b13bc1d578dd52964d016cc68e83866622e8d8906569a8c4b52c25a5a80",
        rawAssertionDigest:
          "6504a3bc71b08384b3f20800b1a58813be932250cf8905dac8e1416c3e53d3bd",
        auditRecordDigest:
          "a9969d9473a337294724ba9da3fb2e28df08f74521da611f00015645d7b8eedd",
        candidateRecordDigest:
          "5b9628ea2f76f94f31d4f0d88b076d64c7f17926806f514b11b13b86679f3592",
        stepAnchorDigest:
          "e9411e4a08c74d64a2041d7d36461e9a211d65f40a557519a342427094c31b3f",
        firstAuditRecordDigest:
          "9fc6d7dcee33efc417daab6b09a2569ff6dc4598446a48c0bd5f8861760117f6"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "398d0b13bc1d578dd52964d016cc68e83866622e8d8906569a8c4b52c25a5a80",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xh.ak.aa":
          "79a168b33c9a4fd40182bc98723a22d7070f5fe4bb1f7281e424dcafc40e4c68",
        "OpenScriptures-HebrewStrong:H2604":
          "dd2b6013ab25f5ed54967dd34b031ebe9adc8cc7977ce24b7e6a5ebba07b74ee",
        "OpenScriptures-LexicalIndex:ojj":
          "18db70556c822613320e6b1800e8c2fc2af1fd9bc7b33f1646e5fb332195d25e",
        "STEP-gloss-anchor:14518":
          "e9411e4a08c74d64a2041d7d36461e9a211d65f40a557519a342427094c31b3f"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "f11e67e938fafded828ded4b57ef436df95df81adc2395cef2ae9d3ccd77f66c"
      }
    },
    {
      key: "H2679",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14633,
        eStrong: "H2679",
        dStrong: "H2679 = a Part of",
        uStrong: "H4506B"
      },
      input: {
        rawHtmlDigest:
          "52cdf62496d8d18039d3b86c035a2e924d9e1eb9ff386f0d2091aa7ac188607d",
        rawAssertionDigest:
          "6b8cc8fa330a905de9dab1b1b554495146a62cbe745332ebe3e10253aeb64823",
        auditRecordDigest:
          "f59bfa9f516c0d63e369847a824261e08b9ecd69600b7612095269be9c9cf94c",
        candidateRecordDigest:
          "ae8f3e2d690ae866c7a18547697fa377c5ea64ad9cfb82905b27412802eafe13",
        stepAnchorDigest:
          "e3d51fb6f224c9c1068d0a5d33c8b01bcf73231f3f43ef1708321ae2e7994e61",
        firstAuditRecordDigest:
          "b4051616896ffab2616daa399fa1fcb51e077286332a5833c40680c9c7ba1737"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "52cdf62496d8d18039d3b86c035a2e924d9e1eb9ff386f0d2091aa7ac188607d",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H2679":
          "3cea75fd081a47d1e97010dd21cb179c8adb793e83bb96f9a50aadbb860401b7",
        "OpenScriptures-LexicalIndex:efd":
          "d8610387d508ed42cb391fd260c7cdf18d31ecd4eb6fbfa5e555edc040fc4565",
        "STEP-gloss-anchor:14633":
          "e3d51fb6f224c9c1068d0a5d33c8b01bcf73231f3f43ef1708321ae2e7994e61"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "90a0f4e0b731b42fff8d004f5c7f2ca7996005e3b46c1e60b06641957fdcef99"
      }
    },
    {
      key: "H2680",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 14634,
        eStrong: "H2680",
        dStrong: "H2680 = combination of",
        uStrong: "H4506B (H2677+H4506B)"
      },
      input: {
        rawHtmlDigest:
          "8f00da5cb13ec02f3be943e0cdb05e3fe7cc0f96b81838ff24e53ec776eb5bbe",
        rawAssertionDigest:
          "1ca707412b43d6ef87f7fab7daee1f219bbfe654cd41f66ba9d59874384b0130",
        auditRecordDigest:
          "7738a5dc4ad25039f888c54d9f23cc075f079b1aab804f96a41b7eecae18d764",
        candidateRecordDigest:
          "5be219196a9a76ff403f4159a1f1bff125185c15eee3d62829a86b0da001f36c",
        stepAnchorDigest:
          "68488d704a3bc65f5bc1b0c04ba3c9efbc38d00903a31f01b4d2598447de8cc1",
        firstAuditRecordDigest:
          "9c72178a1765786a955d1a921bdc4e8984e2c31549b1348fa5f929e87e80f73e"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "142ed7060be5c37ba84c5fc4831c1b4dca832815cc231cd7f6ea8fbc36c0e3dc",
        reconstructionHtml:
          "<p><strong>Half of the Manahathites:</strong> the group named in 1 Chronicles 2:54. The Hebrew expression is חֲצִי הַמָּנַחְתִּי (H2677 + H4506G), not “half of the Manassites.”</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:14634":
          "68488d704a3bc65f5bc1b0c04ba3c9efbc38d00903a31f01b4d2598447de8cc1",
        "STEPBible-TIPNR:H2680:entity:1908":
          "ffd5b22c1048fc4f0b885e43e1b8f684082e9053c76575b91b4a6aed3bf9ca48"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "9448e155958d6efe1cb80b9896e71f5ac21c5bedb88bbdff439435f23a82f9b0"
      }
    },
    {
      key: "H2699",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14659,
        eStrong: "H2699",
        dStrong: "H2699 =",
        uStrong: "H2699"
      },
      input: {
        rawHtmlDigest:
          "f1cc5953de14949e077b0d077f045e77c36afc873e2ac571941bd06a1931e1bb",
        rawAssertionDigest:
          "24a0dcba0cbfe30492d25195739a64a8bb9ad6b265518fdc41858c63c3584726",
        auditRecordDigest:
          "59f79d3db8d56abb936f1ae1a51e411bfbf2a3dddb9ddd87b14022a8226fc9ca",
        candidateRecordDigest:
          "93663c69580b568a94beebc8ea4a29f8d4061e421f74f21f2cecc493eae02906",
        stepAnchorDigest:
          "1b1c06f91f7e08007fc33b25e8ee4f2f229cacbf3ef18c567015d3b21d756bac",
        firstAuditRecordDigest:
          "586c2c7556026379574fcbc7bbbdfeb20dcc4c59492b438b15e77afb02d4b63d"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "f1cc5953de14949e077b0d077f045e77c36afc873e2ac571941bd06a1931e1bb",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:14659":
          "1b1c06f91f7e08007fc33b25e8ee4f2f229cacbf3ef18c567015d3b21d756bac",
        "STEPBible-TIPNR:H2699:entity:3577":
          "3837c5a470ff1d6c98b1f6925af08e835fb749b965de9bcb00ac3da1fe38f1a8"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "4f2d40500ea1b3a5ab017c197f6800caa0bde537a36eb7bb0ef8425ad0e7f641"
      }
    },
    {
      key: "H2718",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14683,
        eStrong: "H2718",
        dStrong: "H2718 = in Aramaic of",
        uStrong: "H2717B"
      },
      input: {
        rawHtmlDigest:
          "9396f228cbf442785f8678fbb767f6b8debd6c5e5f82806c130af4bfefa07894",
        rawAssertionDigest:
          "707c3bbe6d9197512517ff73a815412b6cdc7bdc83eeb04757c5c318cbf0744f",
        auditRecordDigest:
          "439adb5396eef6fcafe0d1964766d567e9d04c82df6a07b804afd0a5922ac8c9",
        candidateRecordDigest:
          "81b9bfeed2a3d871000e21ee5a6d0b4b29543d4b66822e995a16793c1e79608b",
        stepAnchorDigest:
          "f421cb533bbd7b9d7ec6016b42045a629c547ee3a43ed44f6e6b4f8454105db5",
        firstAuditRecordDigest:
          "3476def765a43f38bda76f3a3433f11c093cb7555749a2648b08510bff920f37"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "9396f228cbf442785f8678fbb767f6b8debd6c5e5f82806c130af4bfefa07894",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xh.an.aa":
          "d9eb53fe32de693cc9695a065b1d7cda81bf09d94fe384bcfdbd1097ad4c306c",
        "OpenScriptures-HebrewStrong:H2718":
          "f2cb4788506aeb642b5f53881c121e76e3a1ee745cde3b3c7798c5410dbe7566",
        "OpenScriptures-LexicalIndex:ojq":
          "9340dcc6743615caee83c4d5739b91be53e6d4680695a4af3d742bdf5553be84",
        "STEP-gloss-anchor:14683":
          "f421cb533bbd7b9d7ec6016b42045a629c547ee3a43ed44f6e6b4f8454105db5"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "d1ea92be27513223ce0c550a7ed6e76e1adb770cce823a0eb92d25d32e0c3b33"
      }
    },
    {
      key: "H2791B",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14777,
        eStrong: "H2791b",
        dStrong: "H2791B =",
        uStrong: "H2791B"
      },
      input: {
        rawHtmlDigest:
          "1a9ac545c54c66bc196ed60fa7eb41d7157a2c151444168d27b7aca6107ab3dc",
        rawAssertionDigest:
          "f132163cf20feaff4246a9fce9cc53fff870a8ec5f9a2aef04c962d6faaf73bb",
        auditRecordDigest:
          "a38dba251aaf208ed0cfcac6d220aad210ff540823fa9e1b6fcf7846d67ac1f3",
        candidateRecordDigest:
          "6d232521aba9b4bd89fca1a012704833cfb51b9a82e1b352c273744940af31be",
        stepAnchorDigest:
          "08c3c225e6fced12ab3c02427b0c32ff4268fe42e79b54b6160709dd9864ce73",
        firstAuditRecordDigest:
          "5f516f6c1feec6a06bd733e3c42201e677a866928d667e0e8a6a2c3354446d3e"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "1a9ac545c54c66bc196ed60fa7eb41d7157a2c151444168d27b7aca6107ab3dc",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      key: "H2824",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14828,
        eStrong: "H2824",
        dStrong: "H2824 = a Spelling of",
        uStrong: "H2825"
      },
      input: {
        rawHtmlDigest:
          "a564e759eeea6bc8cbde5a9ea8c892d6d714dedae02d2b55d6264a5de00e8a09",
        rawAssertionDigest:
          "da61641a72e1fd3f68a500a02c48c52c9f988ca6e37401bc4a1b47cfc0503d7e",
        auditRecordDigest:
          "6a183c798f5a928a87fbcf596156047b4aeb17f5b9008f72c5ea2f9d5f3e73b9",
        candidateRecordDigest:
          "73abb0e0a1ebe3e34d4eef8989651fc57c848994679aaacf2f947009738c0997",
        stepAnchorDigest:
          "f161224cac2e6c2c5f8cad98b5e2f5849adc6100b6900ea17297960667cb108c",
        firstAuditRecordDigest:
          "802a385975f37ae36d978e7266524e5c83dfa89d54665676ce75a7069903bbe2"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a564e759eeea6bc8cbde5a9ea8c892d6d714dedae02d2b55d6264a5de00e8a09",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:h.gt.ad":
          "d564819619b1d0bafb79339dcf446babb9672b71a05bee2a222ae05bb8005da9",
        "OpenScriptures-HebrewStrong:H2824":
          "5f50d3374f98117e11517fe49d931d8814583737ef96caf9a8cb82e0a2a0e6ca",
        "OpenScriptures-HebrewStrong:H2825":
          "1519a28de9a93a6ac27b35b4fc355922373440a84a25dcdd6003b8c005d982ed",
        "OpenScriptures-LexicalIndex:emc":
          "52b92067ea033d900bbea3077902806f0bf068080e0e9234e02fbd4d89271046",
        "OpenScriptures-LexicalIndex:emd":
          "5b9f768325108900e3d21a87ef43253399dda31c4fde9cd2c525dcb75433926e",
        "STEP-gloss-anchor:14828":
          "f161224cac2e6c2c5f8cad98b5e2f5849adc6100b6900ea17297960667cb108c",
        "STEP-relation-graph:14828":
          "04d1ed65bbbc123e258ea3554c8c879fb2bf5ba3352764cfa606bd5a9dd112d7",
        "STEP-relation-graph:14829":
          "37b193aaab3f5af278c5b96c96377062f629e0be024d1f0e63a0fca79ae3971e"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "200e6613690fc81c866bf788442caf70ee18abc06f439b5452c7d62eb69e4a2f"
      }
    },
    {
      key: "H2869",
      counterAudit: "raw",
      identity: {
        stepEntryId: 14878,
        eStrong: "H2869",
        dStrong: "H2869 = in Aramaic of",
        uStrong: "H2896A"
      },
      input: {
        rawHtmlDigest:
          "3014242466ac56801599763d555a35e9691a9704ed13c58c118e6726e3408325",
        rawAssertionDigest:
          "3441c09dffa46dc91845302a099e75c3fe36eceb2f21675785cd212e76000873",
        auditRecordDigest:
          "a102c2ceb09a6529a22e311cda6a44f2ddee9e7bb73f5ebf821d13857ffd22c0",
        candidateRecordDigest:
          "c09cc58437118ba673fb37d79b6d125e311fbd491c4f0d313388bb729e90fdde",
        stepAnchorDigest:
          "5890903daac4ebbe0a548a9d9b7a1091b834ae2e3a01240a306f79d2d30d6d71",
        firstAuditRecordDigest:
          "d5cecbf2197b716ee34d8821ff0b111a20242f32977fe7450b1fabaa8a9d9bae"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "3014242466ac56801599763d555a35e9691a9704ed13c58c118e6726e3408325",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H2869":
          "2ada857b1812bea16784ebe48185885e70cbe24efec25334a9bbbacaa45e816a",
        "OpenScriptures-LexicalIndex:okd":
          "35a02b5257c798a57603cdf06aa872e2a512983cd133e26e542fc9c711a1a95a",
        "STEP-gloss-anchor:14878":
          "5890903daac4ebbe0a548a9d9b7a1091b834ae2e3a01240a306f79d2d30d6d71"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "1d6b54de051ba9b2c4b25a950783b3be1a6c5b1670954992b1cd83198893a1b9"
      }
    },
    {
      key: "H2975H",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15001,
        eStrong: "H2975",
        dStrong: "H2975H =",
        uStrong: "H2975H"
      },
      input: {
        rawHtmlDigest:
          "aedddda5588f47a15a74e99e403bb7719c9d829817b91bb19adb4dc57d284b00",
        rawAssertionDigest:
          "9c2e39f7df36066a4b5d86fa5f5fb73ece0b813b5b127710e0109b64c434313d",
        auditRecordDigest:
          "11be7bf882b68c7a82542afaf1f9a90a1f6d393326870d3e459cfdfd3a4933f2",
        candidateRecordDigest:
          "117c74009102246dfc3365f7d61b09dfc926f08691a36d3350c5a37892fda7b6",
        stepAnchorDigest:
          "b809d9f3e207184763fd7c88bf7330fadbed4d80de208e32c111210902a7d26d",
        firstAuditRecordDigest:
          "ae7732f0e915d7b939476cb26eb2e35da8fb82dd639f7bfdb4f95ada38ba5998"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "aedddda5588f47a15a74e99e403bb7719c9d829817b91bb19adb4dc57d284b00",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H2975":
          "dad0af372bf91fde0455c6bcea45cd00ab3fe5213772d5a8ab971b2d3cb1f1df",
        "OpenScriptures-LexicalIndex:esh":
          "6261a4b9346fab7d440b6500a6638f15452a63f454a45f3b3f838c83a5cbb697",
        "STEP-gloss-anchor:15001":
          "b809d9f3e207184763fd7c88bf7330fadbed4d80de208e32c111210902a7d26d"
      },
      occurrenceProof: {
        count: 15,
        occurrenceCorpusDigest:
          "5eae120f9af94e4fcdf0dd3e370abfc1b4e900351a257ae3d59113df5eb056d4"
      }
    },
    {
      key: "H3064G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15142,
        eStrong: "H3064",
        dStrong: "H3064G =",
        uStrong: "H3064G"
      },
      input: {
        rawHtmlDigest:
          "cb698c8a6bee8c9139dd47e10db7dee3fb607150c43ff33d7ca7c6fa3510a95e",
        rawAssertionDigest:
          "1f0fbbe4f485348a6a89704354c5441e2ea3888f3bd17da44516d98bff78256c",
        auditRecordDigest:
          "377478ee9371ebabcc2a19852a26bf8967d2d4a94292138bd5f1d93a5becbf85",
        candidateRecordDigest:
          "e728fa312c1d4cfd98236f1ff1e432094164d1d54f9045cddd3e3efaec808db8",
        stepAnchorDigest:
          "b85055174c5d0ef1ad3033fa5f5981236358423b76ca373f88f33fca71d56f07",
        firstAuditRecordDigest:
          "35f966f3a5e66fe375ee45250144b63c7c00b8be0b026847e24075bc2ea07e0a"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "40da9a26244179694a599e721d3ede1fb9fb434c83904b379cc7618c7fa5b04b",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H3064":
          "56d4aebcf9291be35f07713ed2289355641a147fdc2b9b30d6219c230c506872",
        "OpenScriptures-LexicalIndex:evo":
          "d167e8fdfaba9a0e7f7611df44c3ad0ce6d1ad446975d801b08126f03beb984c",
        "STEP-gloss-anchor:15142":
          "b85055174c5d0ef1ad3033fa5f5981236358423b76ca373f88f33fca71d56f07"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "2f60a1485555a49b30559c4525905ebb7952090ce0c77a56b13f9316abd45cca"
      }
    },
    {
      key: "H3064H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15143,
        eStrong: "H3064",
        dStrong: "H3064H = a group of",
        uStrong: "H3063N"
      },
      input: {
        rawHtmlDigest:
          "752a1a722216959024e9884572242ca12311bb79fb60848d5b3698d5d167fb6f",
        rawAssertionDigest:
          "0dc3d79bd758700716ed9ccb50dea046f9e4ba99a5934ab92bed784acded7f04",
        auditRecordDigest:
          "68c146d2b3606bb5a6db3cde6e1730859d5c1d3c72cb394181da636d24692210",
        candidateRecordDigest:
          "a0df14278f445ad73726fcb261b993977c8802a6b681f8261dfee2598b6942c2",
        stepAnchorDigest:
          "ae9497244e25c6a96a53d4f51f99ff6e5774711494f47411434b6a902aa9934d",
        firstAuditRecordDigest:
          "c8d6eebee1d4b83a5926a2722001762860787c114e25290e07489be31f7ffef1"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "43ee0f30586bdb5edf2eea592eba950061e9e1eddcfa260d21d812753f712b69",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H3064":
          "56d4aebcf9291be35f07713ed2289355641a147fdc2b9b30d6219c230c506872",
        "OpenScriptures-LexicalIndex:evo":
          "d167e8fdfaba9a0e7f7611df44c3ad0ce6d1ad446975d801b08126f03beb984c",
        "STEP-gloss-anchor:15143":
          "ae9497244e25c6a96a53d4f51f99ff6e5774711494f47411434b6a902aa9934d"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "61730479e26c19e62202c892dbb7aaff535e99a33713d2a1fdd66fad0abea50d"
      }
    },
    {
      key: "H3064I",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15144,
        eStrong: "H3064",
        dStrong: "H3064I = a group of",
        uStrong: "H3063G"
      },
      input: {
        rawHtmlDigest:
          "da96d919ee701d097efae201c2c5b7ae2cc8de8e03d71777c093a9ce19ae9253",
        rawAssertionDigest:
          "c8e5d9ccbf050fbb51527eaed66269769d24b3ee7af7529fe430d0818d5cf3c6",
        auditRecordDigest:
          "4c98b2f581e1d0ceb5c186c5daa11e7b40bead54fce68a3fb773feeff7237b1e",
        candidateRecordDigest:
          "3b9c78b8f976c46b37bbfee47326b5847aac6748e3b04a2f0c84bd8a81ec0b2b",
        stepAnchorDigest:
          "d9f5d2652329a9270016e8e99ddac3d99898b5c883840c40e82df5c00dde25d0",
        firstAuditRecordDigest:
          "2f40c3913f6a3fadd08a9c8fe14f5d464ba9dc553b059d867a84ac8a81f14661"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "9446807f2bf1007fffa1ce59b672862af805fc5912f41e5a9c806f2932062199",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H3064":
          "56d4aebcf9291be35f07713ed2289355641a147fdc2b9b30d6219c230c506872",
        "OpenScriptures-LexicalIndex:evo":
          "d167e8fdfaba9a0e7f7611df44c3ad0ce6d1ad446975d801b08126f03beb984c",
        "STEP-gloss-anchor:15144":
          "d9f5d2652329a9270016e8e99ddac3d99898b5c883840c40e82df5c00dde25d0"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "ff2ef580f8f9fa301a8946aa7f8d5a3d3f47b212dba145ecb3776087e6d896f7"
      }
    },
    {
      key: "H3066G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15146,
        eStrong: "H3066",
        dStrong: "H3066G = a Spelling of",
        uStrong: "H3063G"
      },
      input: {
        rawHtmlDigest:
          "5652709dcc439e9ba9513aa1111dccce2bcb74386ac9b369abe7524fea15943b",
        rawAssertionDigest:
          "fa9a843900857019402b015345d8c0e4924de91d1c44605886a03a03f71b8490",
        auditRecordDigest:
          "1e962107777ba99646f57b40bd1148c47563eb18e94ec0db2df48da1778ba879",
        candidateRecordDigest:
          "f94133dc579b10b31e514dc234c8e98b2e7b91cc10bb65cefc0f46b056a62629",
        stepAnchorDigest:
          "7fe5f6e9c838c64005ca9a58939c9d5ef082e717d4500da2dd3ee33546c047c5",
        firstAuditRecordDigest:
          "5cef33d2da3f474506950e8e83eb63bb766acc41d9123e62d0b9424568a7ce04"
      },
      decision: {
        finalAction: "publish_legacy_general",
        selectedHtmlDigest:
          "724c5dc661c2ab391fdb809c94e062d86a268dac51c416b4bce02d31a03e3b1c",
        reason:
          "Independent counter-audit proved that the section after § is the exact H3066 lexical notice and the preceding entity notice belongs elsewhere."
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
      key: "H3068G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15149,
        eStrong: "H3068",
        dStrong: "H3068G =",
        uStrong: "H3068G"
      },
      input: {
        rawHtmlDigest:
          "6b4a5a82e904d0fff22dff70e96adfe75f83fddb6e467bc6050bdf436cb3177d",
        rawAssertionDigest:
          "f03817b1d1c88f0fa288c5981292c9364907ece393465ebb1a1cdbcb77240232",
        auditRecordDigest:
          "e363dba068eddde4092962c53f950b99155fb5160093ac15f47fa772c1068223",
        candidateRecordDigest:
          "bd926843a3437367bd386255b39061cbc8c6b44d2dc072de07e2836b1eb74f6a",
        stepAnchorDigest:
          "2d14c06f9c49d12ebb20777346f1ebff7b15c6289a4b1485bc0202ece30ad980",
        firstAuditRecordDigest:
          "be2d352a3acdef1071ee9f5c1c0a0b52a38c59a11b4e77a9266e49e952113f45"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "6b4a5a82e904d0fff22dff70e96adfe75f83fddb6e467bc6050bdf436cb3177d",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15149":
          "2d14c06f9c49d12ebb20777346f1ebff7b15c6289a4b1485bc0202ece30ad980",
        "STEPBible-TIPNR:H3068G:entity:4174":
          "eeca575e2b6e6ebe91cd2d48d363e02a5a6b8ee52c30f764b4b4c61d0f2a1c88"
      },
      occurrenceProof: {
        count: 6526,
        occurrenceCorpusDigest:
          "37eaaefa2de109beb25530719948928954bf2a0874f7e81bd4ed4f9e2423a15a"
      }
    },
    {
      key: "H3070",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15153,
        eStrong: "H3070",
        dStrong: "H3070 = a Name of",
        uStrong: "H3068G"
      },
      input: {
        rawHtmlDigest:
          "6528dc0d3f382cf385001f8cfbf8b8a47b1795ef1801c62376d3950a4efc56fb",
        rawAssertionDigest:
          "96f4ee30520e13864d49fdaff7c43dcb535f8f1712f2f3fbed35ba9ece8c6ee1",
        auditRecordDigest:
          "42d14d8ddb18fbe47554fa99d5270f6aeb0db8736611892c5d08b58870c9d033",
        candidateRecordDigest:
          "4e57141d217238ca231efc9440c669295d57e5cbe48dbdcd77fd62e45ad52279",
        stepAnchorDigest:
          "76a77469d2c9a4b3025c9d403dbaba37cc2e761c64df416f0f0d797c4ff10781",
        firstAuditRecordDigest:
          "1a8959d3ddfdb34a230efd881c50477c873b69a339a15be8f01bd05815ddfb71"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "6528dc0d3f382cf385001f8cfbf8b8a47b1795ef1801c62376d3950a4efc56fb",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15153":
          "76a77469d2c9a4b3025c9d403dbaba37cc2e761c64df416f0f0d797c4ff10781",
        "STEPBible-TIPNR:H3070:entity:4174":
          "a59c68ba545bb47bdfde0b3c2b7177180c6f10bea0a8a6bb0bc4a7010cd22fd8"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "a133cec03d33ef646795c49727f43769356afb7e5e7b53719c9738f8093d4b7d"
      }
    },
    {
      key: "H3071",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15154,
        eStrong: "H3071",
        dStrong: "H3071 = combination of",
        uStrong: "H3068G (H3068G+H5251G)"
      },
      input: {
        rawHtmlDigest:
          "e05e3a52145db5b8591bcc6109e80a404dc437c7abb4a985649199046c45de2e",
        rawAssertionDigest:
          "f129dc245f98fda8d1bc9ce8507932c16cd4c32ce4ec415278fc05b46e32c0e6",
        auditRecordDigest:
          "1820b645e79fdb2a043f3fd00cf2d94be67b8c332dc1288d7016455d1806d7eb",
        candidateRecordDigest:
          "4fd961bf08692cd8e937f07f2475a4d89120b4156ceafd2f8c11bbd621d3f628",
        stepAnchorDigest:
          "8cf4a9e60ec67ce3cc184ebc4dd212f9e79b26d6385c9f02ac13a84b34d4adf4",
        firstAuditRecordDigest:
          "181c366461c8eb60a721d587abdb7f4187493dd62d0089a8f391537aeec5cfb7"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "e05e3a52145db5b8591bcc6109e80a404dc437c7abb4a985649199046c45de2e",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15154":
          "8cf4a9e60ec67ce3cc184ebc4dd212f9e79b26d6385c9f02ac13a84b34d4adf4",
        "STEPBible-TIPNR:H3071:entity:4174":
          "baf18fd08ca0c41aa1a6db29a6b215580c58780f5459051e42ef4a528e26c8a9"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "9d1fff81dfc8d77d7b6ea85eae2e4ba327417e20ebec6ecdef5d0b51883078fa"
      }
    },
    {
      key: "H3072",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15155,
        eStrong: "H3072",
        dStrong: "H3072 = combination of",
        uStrong: "H3068G (H3068G+H6664H)"
      },
      input: {
        rawHtmlDigest:
          "9bf8fab1259d019bcc07db00566351c407fec67c9733385db9a6f10809c142e6",
        rawAssertionDigest:
          "e10d2b65c2af4f3c19cf0ccc6ecfccafe03b128b67abfd0a7cd9f8d021a632ae",
        auditRecordDigest:
          "80b20254274498e66849ba9424bbbc38aec485a957e0be83f0a01772b85aaa1d",
        candidateRecordDigest:
          "5ea65a09e75ae81b8243abc29249c18bc667fe15e2db5d3bf3bff35c8c3f6877",
        stepAnchorDigest:
          "452c0e45f03ec864132bf2f7c2ffdbca0200c5db8103fc2a84ff8e2f5cfbb5de",
        firstAuditRecordDigest:
          "b035742cf9ae8429a6e8858e0b7544997ed543e7ae1dc117523f5d2caaa40190"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "9bf8fab1259d019bcc07db00566351c407fec67c9733385db9a6f10809c142e6",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15155":
          "452c0e45f03ec864132bf2f7c2ffdbca0200c5db8103fc2a84ff8e2f5cfbb5de",
        "STEPBible-TIPNR:H3072:entity:4174":
          "80e9184d1fe1a1d10b40e8cd4be377e9e32cdb66a73867f4e8d23157b8bb80dd"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "c25aea8b47b44e11dbf0e46618f948a1bcb7cf30a996ee3d9a213e9d5f5e4b11"
      }
    },
    {
      key: "H3073",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15156,
        eStrong: "H3073",
        dStrong: "H3073 = combination of",
        uStrong: "H3068G (H3068G+H7965H)"
      },
      input: {
        rawHtmlDigest:
          "973e6df2dd23b5102f7633edfe09fc1112132b466a0a0da4ef21c851f4dd78d5",
        rawAssertionDigest:
          "06b99d5f47ccf149222aa3fe8d9e294875ff3ccaeafc16b20fba2097c0f36259",
        auditRecordDigest:
          "fb2a7eb14f0a37dc1e03b4b3ee30213b1fc0b6bcaaac698df8bef551d3f31315",
        candidateRecordDigest:
          "1255a5b5b8651f942c28e565bca03cb4ecb03de223255b7f950ab7a9cd7e9588",
        stepAnchorDigest:
          "98c9ca2ad43d59b60ed9e1f2231b35ad43ce42e23cd921220e714aa4ffbfbcd1",
        firstAuditRecordDigest:
          "3235b9cbc68a7ae7dc96129099b6c1328fabc7a366e06fc640717bd1b0333fea"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "973e6df2dd23b5102f7633edfe09fc1112132b466a0a0da4ef21c851f4dd78d5",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15156":
          "98c9ca2ad43d59b60ed9e1f2231b35ad43ce42e23cd921220e714aa4ffbfbcd1",
        "STEPBible-TIPNR:H3073:entity:4174":
          "9e2c688e554c20f501179b691418ee88a94e62c0e6b39131f881e593f2108d2c"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "fe48f9143be50cbf9baba411417ff820fa79222c605c7ea0e70af7f8c9c6a427"
      }
    },
    {
      key: "H3074",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15157,
        eStrong: "H3074",
        dStrong: "H3074 = combination of",
        uStrong: "H3389 (H3068H+H8033H)"
      },
      input: {
        rawHtmlDigest:
          "9c3f59f7368cf0d9f213bae545d48b3c6e24cd06d8e5bb336825de940fb5818d",
        rawAssertionDigest:
          "b0d03aa81a7144f928bfd1be266004369cf81668e88012fd46ad762738bc7f6e",
        auditRecordDigest:
          "3a461737e911a53794986eb8f54ba34dc85f5572cf0c3b04fff33b015d70a395",
        candidateRecordDigest:
          "7ab1604ca9b2c38e2a3e3c26a8665d8dd929ebe223f00c0382ab3a77214c38ed",
        stepAnchorDigest:
          "8d2ee4768615fdacdabb284686fc903b3b0022ffe16ad31806c934b3f8c04e92",
        firstAuditRecordDigest:
          "a6b0feb46b6a5f46ac92a29c752924444d10319f348b083f8751b282ed50b624"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "9c3f59f7368cf0d9f213bae545d48b3c6e24cd06d8e5bb336825de940fb5818d",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15157":
          "8d2ee4768615fdacdabb284686fc903b3b0022ffe16ad31806c934b3f8c04e92",
        "STEPBible-TIPNR:H3074:entity:3661":
          "5633bcf5a5c4cbed412dec9454549e49880c78d588e16f386fc188190fba67fd"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "834dfcbf05c8d5aa5e58a3e7de0a3bf12b52874e75ef8635ae79b9d3c8cefa64"
      }
    },
    {
      key: "H3159",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15365,
        eStrong: "H3159",
        dStrong: "H3159 = a form of",
        uStrong: "H3157H"
      },
      input: {
        rawHtmlDigest:
          "0296f4ee2891a9f7ad9d805a740aa2deea95e923e30d81e548e14367f1ee669a",
        rawAssertionDigest:
          "76e7244c7ab1e573e75aa7bfd99a5fd515f52c68790b2054a962cce39dc1ae4c",
        auditRecordDigest:
          "86fcc68f5a8622eec560ec7e54eb55df8b13c6ac5ce23abeb692458e7d97a25c",
        candidateRecordDigest:
          "fa8aca9f65684aecea693028df1c1fd19295cc6b9cadb4cb7dd8033e6289396c",
        stepAnchorDigest:
          "871280570a95956d3dfab93292d7454ae7f58ebe118107eb317f28b0ad7c7b72",
        firstAuditRecordDigest:
          "f50b75535ce3be2351fb06d89d35a780c8532818a19a5fbbba3a7037ed13b066"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "0296f4ee2891a9f7ad9d805a740aa2deea95e923e30d81e548e14367f1ee669a",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15365":
          "871280570a95956d3dfab93292d7454ae7f58ebe118107eb317f28b0ad7c7b72",
        "STEPBible-TIPNR:H3159:entity:3668":
          "44ed88aefff14450cc1699fe3b03f387fe75d1abf7870865547fcca7786f78b1"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "355b3873c977bcd26bd6337cc8746bb4d43537dad9719a8183d87af733253840"
      }
    },
    {
      key: "H3189L",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15420,
        eStrong: "H3189",
        dStrong: "H3189L = a Name of",
        uStrong: "H3845G"
      },
      input: {
        rawHtmlDigest:
          "f1d732104bde2d3cf82c9a1301eacbea85f5ed07a7a6ddbbe22f35e57bac0cb8",
        rawAssertionDigest:
          "edd63fa1a772804e4ce384bddf7e4f1632154f447fe686b68abeabceb6c37d16",
        auditRecordDigest:
          "2de99334651dd641ef0a7346df4bcd2e94754f987716cfc080192df214e8474f",
        candidateRecordDigest:
          "509ba9366d733ece0f51f33383c99ff245589de8c96032129a8d08f923dd6701",
        stepAnchorDigest:
          "fa0210fbe5a71ddf18a91ac7b1ba472d9f31b3bafd3018c3a6151c130f87f8b8",
        firstAuditRecordDigest:
          "c8eb3795a99ffae0cadea8ba92e3b6d6394b73fa6dc7bf6d3da0af7e2f93ec1c"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "4e844602db34fde67d8e29b35ec4b80b7bf74301a10db2093b0ce3dc6a3cfe29",
        reconstructionHtml:
          "<p><strong>Jahath:</strong> a Hebrew personal name borne by several men in Chronicles. Legacy STEP treats H3189L as another name for Libni/Ladan in the Gershonite genealogies, but current TAHOT assigns this sub-entry no occurrence and current TIPNR does not retain that identification. Compare H3189G, H3189H, H3189I, H3189J, H3189K, H3845G, and H3936H.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H3189":
          "9273ddcdac1fffb6b9bfb0dd5c8f435b094bba0ac80a538be3506c8848ab7c92",
        "OpenScriptures-LexicalIndex:fas":
          "2cf6eb8deb224d5bb4b268a503876d28974fc71cd426d099f419ee1270b839e9",
        "STEP-gloss-anchor:15420":
          "fa0210fbe5a71ddf18a91ac7b1ba472d9f31b3bafd3018c3a6151c130f87f8b8"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "14d51d3c92db10de0505080f4752c6a09ccd90cb7700f5976c3242fa85087982"
      }
    },
    {
      key: "H3249",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15497,
        eStrong: "H3249",
        dStrong: "H3249 = a form of",
        uStrong: "H5493G"
      },
      input: {
        rawHtmlDigest:
          "0f6809d562a571989cacee76c3ae3bf6bb2fe354794c59769f61234f8f463663",
        rawAssertionDigest:
          "5e0005f83a8074868d73bd0d03e1b22dad963bfdd8f23561397223f764123f6d",
        auditRecordDigest:
          "cc8ac1eea1faf82d7bfb3e3ea259cd678bb73898db9915892a89098474f80689",
        candidateRecordDigest:
          "1a9d0f34857cc68d3c3d2867548348179d1b22b138be68ddd097383a4923b3e5",
        stepAnchorDigest:
          "57f6d21b328b17c69f23a685c96dd50c616d6c227ad14a61ab4aae4c9b3d4915",
        firstAuditRecordDigest:
          "d7ee680aaf42bc2fff1c340e4bd236891a0c10b10efaf5fac45b8dbd09d4d505"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "0f6809d562a571989cacee76c3ae3bf6bb2fe354794c59769f61234f8f463663",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:o.au.af":
          "a01bda89e3d8349070419daeac691da6579ae92da153c6b06c61753d4746a415",
        "OpenScriptures-HebrewStrong:H3249":
          "c281aa316437f5b83717956e96cf4c30e14799ef7844ca446f820e23032214ec",
        "OpenScriptures-LexicalIndex:fdf":
          "1ba0d3934d639282773193ca50227d46f3fa8fb90ffe47b2afea1880d5ebb724",
        "STEP-gloss-anchor:15497":
          "57f6d21b328b17c69f23a685c96dd50c616d6c227ad14a61ab4aae4c9b3d4915"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "3f7263b56438a782ecb7668460fcaa43ea41a5426350380558eacc4bfe6ec885"
      }
    },
    {
      key: "H3277G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15542,
        eStrong: "H3277",
        dStrong: "H3277G =",
        uStrong: "H3277G"
      },
      input: {
        rawHtmlDigest:
          "f8e83009fb95040f750652b853388305d377c95c9ee299466db6481d7117b082",
        rawAssertionDigest:
          "7eaea3742a11a77b943565f1aec589f64ec1188ba1aefc67a87f2bd9a9ab1ea9",
        auditRecordDigest:
          "f6c8e226ec1cc19620d2fd4a3603e7cf0819663b18c9dc9c5861f55bb70d452b",
        candidateRecordDigest:
          "6b8bced674d95cc89a64b5bd099d90210867b8dd16765260be5957cdda3924c2",
        stepAnchorDigest:
          "d0cd37e4386db33111652160bac04cb136712f709cfdabc36995e767f060fc6f",
        firstAuditRecordDigest:
          "e834b0d1931d9d404e34a63c30e869d94e9da983b686d54025a8e73bda3469be"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "f8e83009fb95040f750652b853388305d377c95c9ee299466db6481d7117b082",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15542":
          "d0cd37e4386db33111652160bac04cb136712f709cfdabc36995e767f060fc6f",
        "STEPBible-TIPNR:H3277G:entity:4092":
          "0d68f40eac20b556fbc21a94161ee622c062d8d98602b562654dbb1123e1f281"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "b07546b5ecb8947e3863c78e291f27c636a466a1cc622907bf56e0504141dd25"
      }
    },
    {
      key: "H3293G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15561,
        eStrong: "H3293a",
        dStrong: "H3293G = a Name of",
        uStrong: "H7157"
      },
      input: {
        rawHtmlDigest:
          "9284ba7b9423948334ca368826bf05ca20e32a9118fe25f04c41b970650ac85b",
        rawAssertionDigest:
          "65c0b51b06a08679878d6ea3ffc15ca5f4640bc249c08b66dd6ad4c1a2cfb2a2",
        auditRecordDigest:
          "c30ffc3a3b33ab8e1719e3bc9c80f3ada29aa828691d06c919f66d26507ecae3",
        candidateRecordDigest:
          "d9d23c8f890a3702b45c4c33902bb72ba2d85df5f48f0629969e5bfacd333608",
        stepAnchorDigest:
          "995aeb9b9b34d1cda04edd81e9f5ce735a801f56767bce27fbc04d1ecc2847fb",
        firstAuditRecordDigest:
          "bc645a1dc17140ad3fefb1b540996d98b9b73fa5d0751f1a1373fdfc5894b793"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "afd1266b3f371855992a693ae24c9ad547534b2d94b100e2826081f5d6d67cf1",
        reconstructionHtml:
          "<p><strong>Jaar:</strong> a place-name in Psalm 132:6, identified by STEP/TIPNR with Kiriath-jearim. Here יַעַר denotes forest or woodland, not a honeycomb.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15561":
          "995aeb9b9b34d1cda04edd81e9f5ce735a801f56767bce27fbc04d1ecc2847fb",
        "STEPBible-TIPNR:H3293G:entity:3707":
          "b76e44e007e5625cc1c233499a4ca3a7dd890e8d0ff4301b2f628b33dc24bee5"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "417cac8d99f606775e744419c0a3ccdb35e9ebeca50d4a656f53215becdd458d"
      }
    },
    {
      key: "H3406R",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15728,
        eStrong: "H3406",
        dStrong: "H3406R =",
        uStrong: "H3406R"
      },
      input: {
        rawHtmlDigest:
          "bca6149daa91d1174653a85f2e62af08d6ad5ab33e1ca75f8f9f856e70b75007",
        rawAssertionDigest:
          "5e0c059bcb08e4a755d67b033457ec72b65fcd40b960e861cb5d714c6ba01f48",
        auditRecordDigest:
          "cc3ca7cb3b260c85f8668a83cafc5c254ddf6cbda5d5c0516aee75b33de8c51e",
        candidateRecordDigest:
          "d611b6f94f45b7198f0c6a204c7685622bb2739b56ae02e3516db58af014cead",
        stepAnchorDigest:
          "90a666bdd71c3e8153b1299e6fe1a980c69eed18570018670e874425a7db38d9",
        firstAuditRecordDigest:
          "6d74f21e4e4fd6b30115c3e6016e03d0b6adc4469a60ed74ce558fff7cf3cb61"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "3310b47cbffbbc535f29d19a84c9b1f3bcc49c9d01e00a467c7c9d56c12d1475",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15728":
          "90a666bdd71c3e8153b1299e6fe1a980c69eed18570018670e874425a7db38d9",
        "STEPBible-TIPNR:H3406R:entity:1524":
          "bd739a8acb98c50e9ef4a545527a6d50fb3e6c4ff5eb58b56dd2df52bf45da9b"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "95b891e6462123ca72ce24d3e052a7c0bd98ddd2e9af0c99c31f11b7f30aea9d"
      }
    },
    {
      key: "H3452G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15800,
        eStrong: "H3452",
        dStrong: "H3452G =",
        uStrong: "H3452G"
      },
      input: {
        rawHtmlDigest:
          "611765d62ac700a42f4c4672d44cb1c8c8ae995548a86a40b7e76b113e008639",
        rawAssertionDigest:
          "2848ec0a631c8ac1859c40123042db363a41f423335cc656cc60ba030e5a605e",
        auditRecordDigest:
          "3bd8f7ff5a07de87b7b4c8171d256118a9f81c9065fe777a70cec7d687718334",
        candidateRecordDigest:
          "51715e72b774c02c9ac2e6d619f2a4e13f954913a3e61c33fab006e840aa951f",
        stepAnchorDigest:
          "9b3022da836eb1a9dc7b174caa08be224703d0c4b340aaff7f60d54c79777eea",
        firstAuditRecordDigest:
          "d6410d2fb54e0e846bfc912473ec770fb2a43f84eaca59a074caaeec09d08dac"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "611765d62ac700a42f4c4672d44cb1c8c8ae995548a86a40b7e76b113e008639",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15800":
          "9b3022da836eb1a9dc7b174caa08be224703d0c4b340aaff7f60d54c79777eea",
        "STEPBible-TIPNR:H3452G:entity:3663":
          "9d68a3f9b625f2c84828ab915f839bfabd6c6bb6a249c95039a850648395e715"
      },
      occurrenceProof: {
        count: 4,
        occurrenceCorpusDigest:
          "309a5986e60f8efe997c0eaae62fbbf89456163f3483ad6271c1e5ed1769b825"
      }
    },
    {
      key: "H3464",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15819,
        eStrong: "H3464",
        dStrong: "H3464 =",
        uStrong: "H3464"
      },
      input: {
        rawHtmlDigest:
          "d8c1a9e5c2fa71a3976e054723c0a84f3cd63e7c85f523c0804c356fb883ec87",
        rawAssertionDigest:
          "37cbf1c4a8c419620de1790fd7e65aef754d263deda644f78bffe1726905d9d7",
        auditRecordDigest:
          "59509170f56450bac76b5a7cf0aa2ca47d8b8bfa0b1812541e41244b0d87d411",
        candidateRecordDigest:
          "febdff8d5adcc2f87ae12366d31d9bb4922cacabf7aedd80d0257bbc960fa726",
        stepAnchorDigest:
          "2c12cb59635ecfdad354876e41d6d26e21f2c4737e98f716c4df424f9003cac7",
        firstAuditRecordDigest:
          "e42233d2d703c38f68a7f126d1e4b6e35c25def9fcb3cce35c69e51caa667093"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "7b4d2a1e8c34f2ea5b15be800d453b06ac4326cc9b7a77f00cbb4c6c433e1131",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:j.dx.ac":
          "7f9989c0580e840f82bb022339722af6e9bc6989d12e2ecffa8c83868743dae9",
        "OpenScriptures-HebrewStrong:H3464":
          "a3fa9587e2700403cff96515995788ed8ed46ba1f61a98fb7309760416b33a8c",
        "OpenScriptures-LexicalIndex:flo":
          "e1847509adce8260bd62087e722b3521d8c37603135d6614ab3bd404c35d1f9a",
        "STEP-gloss-anchor:15819":
          "2c12cb59635ecfdad354876e41d6d26e21f2c4737e98f716c4df424f9003cac7"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "4bc43e553ce0dbfd0edd6794b0bc4f29f9b73420c70f6d3db80fcf96546bf68d"
      }
    },
    {
      key: "H3477H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15844,
        eStrong: "H3477",
        dStrong: "H3477H =",
        uStrong: "H3477H"
      },
      input: {
        rawHtmlDigest:
          "10e858ed9572f03fdd48c36268c8401811e66121ced4e95dc668e9444c8e758f",
        rawAssertionDigest:
          "adb5fb295b52268deda9debc554b3877a17eacd5cbef895cc54e0779e96880b8",
        auditRecordDigest:
          "2de50b7449e18548bc75dd6033f9012dfbe039fd4c929d55c0b0b5c89cbb4816",
        candidateRecordDigest:
          "2b9908c28985c30f60b5523e0e49cd5155256a6629a3ecb91406b099eb7cca35",
        stepAnchorDigest:
          "5fe7c787a247f2ed2a67bbd4682026dfb519c7f7b08384f28316b99e22ff0317",
        firstAuditRecordDigest:
          "02d201e84cb1c9c9b889c73283acd323656c65e370e34c836269c416b695cc4f"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "fa735cbec02f325f31d189ea2282956486a34f447a2c8c67cb1708a67b0250ee",
        reconstructionHtml:
          "<p><strong>Jashar/Jasher:</strong> the title in the expression “Book of Jashar” (Joshua 10:13; 2 Samuel 1:18), not a person. יָשָׁר means “upright.”</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15844":
          "5fe7c787a247f2ed2a67bbd4682026dfb519c7f7b08384f28316b99e22ff0317",
        "STEPBible-TIPNR:H3477H:entity:1405":
          "11758db2243f5ff581ee20d1dec3e430abde036da7cfd65dc9de952374988d20"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "2edec5198c157124e529d6de87b093d2bc2f4175a968cd92519539fd00fd580e"
      }
    },
    {
      key: "H3482",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15851,
        eStrong: "H3482",
        dStrong: "H3482 = a group of",
        uStrong: "H3478"
      },
      input: {
        rawHtmlDigest:
          "d06d5c978c2d1ec9110849d57cbb822562f48e11da735a12d8a42c0d7c5bbc27",
        rawAssertionDigest:
          "375979a0c155d54b37edc0c90efc6f6b55135eba702eb5bdf15b46f9fe10a4ab",
        auditRecordDigest:
          "c8adaef5f8b8ac64ebed170cfe7c753f771be0633c6e93dc2d52a05e8023d863",
        candidateRecordDigest:
          "5d01b0e8c0a663fe616f6759fc2ebc52671fe9c9536f740a52a3928e879603bb",
        stepAnchorDigest:
          "628cd7a6dc29ea8ae1f2e68d4d424ef2e49a94687eec86767a6211fc930c4269",
        firstAuditRecordDigest:
          "264c3cf6c593598ec905079fa61ecee5de07ae80517928d19f62c19ce36f8ef1"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "d06d5c978c2d1ec9110849d57cbb822562f48e11da735a12d8a42c0d7c5bbc27",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15851":
          "628cd7a6dc29ea8ae1f2e68d4d424ef2e49a94687eec86767a6211fc930c4269",
        "STEPBible-TIPNR:H3482:entity:1307":
          "bacb26e9b4f2dbdc4c4cc2a53c360b19848fccd72f14882f3b8586be00c91612"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "74b18d81d6fa5d8f3f99429d69c439b83259403c5119e6b05452ab97ed7ee940"
      }
    },
    {
      key: "H3526G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15909,
        eStrong: "H3526",
        dStrong: "H3526G =",
        uStrong: "H3526G"
      },
      input: {
        rawHtmlDigest:
          "96cf39c76496c19e7e2d1d4d02b18a008cb5915680f43594e553bd9fa68e68fa",
        rawAssertionDigest:
          "298730aa1f52415a5afff6c69eff7e6d1a4d6e823c56c89a6c0c52d9c9238dc6",
        auditRecordDigest:
          "92ab3ef195981ee8d1e26f107453756e3a75107ec82e6cd9b0b89881ac6913f9",
        candidateRecordDigest:
          "1c3f6c96a1933984afef3534ca2066d0c5356f96cf513ae206958b734667d4c1",
        stepAnchorDigest:
          "77b23dbbb9191c4ffdbba7d194722342fa16240144abd2960a6481b10c39ef8a",
        firstAuditRecordDigest:
          "2af7bec44e3f5a1e6554525cd820a96dd99d4a6432c0786fe5b446fe6e79d1bf"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "96cf39c76496c19e7e2d1d4d02b18a008cb5915680f43594e553bd9fa68e68fa",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15909":
          "77b23dbbb9191c4ffdbba7d194722342fa16240144abd2960a6481b10c39ef8a",
        "STEPBible-TIPNR:H3526G:entity:4089":
          "9b7f48b90ff61ea597e408a118656f621767545c6f6f4f0a79f3711536bd7438"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "31ed7c2adedfe5b1516826a8486af877e7dd7b3b8e4050188484acd39db65a30"
      }
    },
    {
      key: "H3562",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15952,
        eStrong: "H3562",
        dStrong: "H3562 =",
        uStrong: "H3562"
      },
      input: {
        rawHtmlDigest:
          "3d8c5a557593140fd473f41ed5c2cf1d7ff66349208c1640bd9961fd5a5b751d",
        rawAssertionDigest:
          "4c501a89877b987537adb217545ac9c15080d4f810fa0561638a2fe4888038d4",
        auditRecordDigest:
          "17f4ec92e76de30d6491c023cdbddffefcd2b602bcae2e80213d27b93b335dfa",
        candidateRecordDigest:
          "72c32f3e14eb2608f3898612c78a0449596ed2a16c95874d1c22962f3068b725",
        stepAnchorDigest:
          "6b18aed40a90fc494c8ad13393e94dd119dda7e5a69f7265206bf878831f74b3",
        firstAuditRecordDigest:
          "4fa3175138e9647dbd73ed722e89a99e09ee05af1393f8e6b281446d3c6737d7"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "4eba521461d0511f27de61180e6cdea83223ace4155f5d637f4da9688caf1575",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:k.aw.ad":
          "e9f5525c3d39c9723d8da34cd2aa041488b127761a3e6fcb8677e2931f880bf0",
        "OpenScriptures-HebrewStrong:H3562":
          "c1649f1e0a5c2ae8a4652f76c84a84914aaa531a3df1c2a7a8a4659e33613fe7",
        "OpenScriptures-LexicalIndex:fqa":
          "29b062b165267d5efecfd107d1ae1394e823efaf45ac82bd45ed527fa7f6f5de",
        "STEP-gloss-anchor:15952":
          "6b18aed40a90fc494c8ad13393e94dd119dda7e5a69f7265206bf878831f74b3"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "b23e6a5c91470ca90cff2a0305bc9fa04e7966a33383d4c42bbeb1ac6475ab75"
      }
    },
    {
      key: "H3568H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15962,
        eStrong: "H3568a",
        dStrong: "H3568H =",
        uStrong: "H3568H"
      },
      input: {
        rawHtmlDigest:
          "0ea00865dd90f5a7a6d240d6b087af147280b7bcb888644dd9d03c980461a77a",
        rawAssertionDigest:
          "71d56b40c43a70e12812e6354a37b371c31bd60e596cce55c05d5274585d770d",
        auditRecordDigest:
          "0f3e86e40e3f806f14d2b06202d93aac70550b6030cd7cdf5a755606ed3fbcf5",
        candidateRecordDigest:
          "efbcee8d02a28c99ccf8b237445ac92dff8d1aead70b440229ecb86436008d44",
        stepAnchorDigest:
          "9753a14988ea894a6fa2b575c809a2b5115bcf78cb00304bea0c8728c2478ff9",
        firstAuditRecordDigest:
          "728193326cea5942ac04fff5312a6900b7b5afd69fc9f7ccf1b695103ff92e06"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "34058dd3dfa7d839db668248b77e355f359c27aaccd014ff87c5caa4159a451e",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H3568a":
          "a59282531e7ee35b822912aa38d0a51d2665232ba1aff50f3aa899524cd29893",
        "OpenScriptures-BrownDriverBriggs:k.az.aa":
          "23ad208dd86c478fea7ea41d07dac9e05747e24648f8d3d0d58dd6c72c28d345",
        "OpenScriptures-HebrewStrong:H3568":
          "36651b72815144eea5cf8ed1b0e0359cfee468b5d4a7ec0931fdcba9ac012625",
        "OpenScriptures-LexicalIndex:fqh":
          "ef6d0cd8d792a2b23141e7c6c8712a974e3698a3df291de7b10b83b4b6f5fa1f",
        "STEP-gloss-anchor:15962":
          "9753a14988ea894a6fa2b575c809a2b5115bcf78cb00304bea0c8728c2478ff9"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "fdeeea4c2f62326cd0bfcf89595eeebb81063cea2e4361b0c2366430746c3f80"
      }
    },
    {
      key: "H3569I",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 15965,
        eStrong: "H3569",
        dStrong: "H3569I = a group of",
        uStrong: "H3568A"
      },
      input: {
        rawHtmlDigest:
          "91dc4c787f460e6471b69d3715fd6b8f4801f833d6645e14625d50ceecb07fe2",
        rawAssertionDigest:
          "52e9ec61f115ca656a778e2ab300839c8a393bc78462b0c88579f218c13c4ab1",
        auditRecordDigest:
          "62ccb4e9f478ed344467ffffe4de9c7f7c654d4491006c68d6b99d8e2b19be09",
        candidateRecordDigest:
          "dae1c13731a00b60541d0a49bde8f44c2cf3b7bd18d33558e15ebed30e6112ae",
        stepAnchorDigest:
          "c4718fd71bd880d7f68a4143fb7da2a5cb7386976be6ac6d9f3e70e101819e6f",
        firstAuditRecordDigest:
          "7d6f59bc104806273a2003209aa051a71c79f43c36e9610d6c9b31ecac81c0da"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "a91650f452c7486d0ef1a8d767a3c28d2c2ac7a0425b877616d4678fc60fb5ad",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H3569":
          "60fb52f28e12d8e64a78f7e3be8969ffc331d02747dbde47d629dd2df21a6ebe",
        "OpenScriptures-LexicalIndex:fqk":
          "5b9511ec4f5ecb70b56e3ec2ee1866803ce6484110151b4a34fc62835db64ef4",
        "STEP-gloss-anchor:15965":
          "c4718fd71bd880d7f68a4143fb7da2a5cb7386976be6ac6d9f3e70e101819e6f"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "c98691992d2ba40c74e2cf67c64d1949fa0b4e4355a5c59a3cf09fb5dc863d9e"
      }
    },
    {
      key: "H3571",
      counterAudit: "raw",
      identity: {
        stepEntryId: 15967,
        eStrong: "H3571",
        dStrong: "H3571 = a group of",
        uStrong: "H3568A"
      },
      input: {
        rawHtmlDigest:
          "5df570aa3cc7ef46e0c8cd2c6225f3153220b91c5d41b6d571a5c19b9e196d62",
        rawAssertionDigest:
          "3a0fcc7011e440457a856d4be03d6bd34ba0ed6372ad8b90de50bd70317225eb",
        auditRecordDigest:
          "a9d615ffd54a9d72de95fd72acb97f50c4c60e114027c734d73b604181d679b5",
        candidateRecordDigest:
          "4d1b4204f193ccd7be5724adcf29733efc6c7dde9bded215cd72fae71207db6c",
        stepAnchorDigest:
          "d0aa30bee11e84fedbc541f76a98de6e1d26f9fca42de3042c4a1a374780c919",
        firstAuditRecordDigest:
          "f4fe422f3b37c291d9ff1c2d6e930f8704982386f95d99ad1154d55ca95a3c31"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "5df570aa3cc7ef46e0c8cd2c6225f3153220b91c5d41b6d571a5c19b9e196d62",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:15967":
          "d0aa30bee11e84fedbc541f76a98de6e1d26f9fca42de3042c4a1a374780c919",
        "STEPBible-TIPNR:H3571:entity:3374":
          "9c3a2b986b659223e30bae25c4e4fe462e6696b559267f28eb1280e8a5ce113f"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "5b50ffdf4e9dbcd2d76df4b461b2fd2ea089ed88b94cd39e0b6354d23a9ca1f2"
      }
    },
    {
      key: "H3603G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16002,
        eStrong: "H3603",
        dStrong: "H3603G =",
        uStrong: "H3603G"
      },
      input: {
        rawHtmlDigest:
          "8fbff9e2e565a8891bc4aa8af5b741cde16fb7f7da9b600af89beec85eaa1b39",
        rawAssertionDigest:
          "30cf281f129fe8c49247be7b070525ee00c79641db8ae9608ea78ab8b9d034a0",
        auditRecordDigest:
          "357221e8b5737072cc520754941e0d5a0c07f0bad0425aed69e83e5b1a2232d2",
        candidateRecordDigest:
          "7bb55024ae191406ecb20748b26967dc44f93cb5affffe8fb31fe6a2d4c9ccba",
        stepAnchorDigest:
          "4d7884aff49f38d2f933374b6a837694b7823a1118cdec1f2fd605cca52b1448",
        firstAuditRecordDigest:
          "9736f85861da3ae5ffbea617158493bcb1a36eafd5ee9ece9749b5f5dd6940e6"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "8fbff9e2e565a8891bc4aa8af5b741cde16fb7f7da9b600af89beec85eaa1b39",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H3603":
          "b23b4352b7e72518adb926cecbab087ea4f1321a6f08432cf15b2a749273efc6",
        "OpenScriptures-LexicalIndex:fsa":
          "2d9f3a9595af85651898d082cf29d83c8daf8f1eb11ece11ce0e4270382c2b23",
        "STEP-gloss-anchor:16002":
          "4d7884aff49f38d2f933374b6a837694b7823a1118cdec1f2fd605cca52b1448"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "58f184e34b5a6a5d161d50b74a7e3594e32232674ebcdb5f900def9d5bef76d5"
      }
    },
    {
      key: "H3651B",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16063,
        eStrong: "H3651b",
        dStrong: "H3651B = a Meaning of",
        uStrong: "H3588A"
      },
      input: {
        rawHtmlDigest:
          "01e87955f752ed67c4e2ad6b8ea4f91a95caa5d1e29566e2a72a0e24e739f387",
        rawAssertionDigest:
          "42b3d675715f86ea53a2d42bbf0fa662836dc9a29e56e287e4f8c3a3678b969a",
        auditRecordDigest:
          "6abf450613a5a309f18ab69401ba9032c9b5cd6fd9e183343aa970ec406a967b",
        candidateRecordDigest:
          "22ded2b60d96dc69485425633bba11593e5edd2f49bafb52d9939f1790a88a10",
        stepAnchorDigest:
          "b55a6dcd66f63282cec428da52a88b6c44a510957135a4a31690171e14b7078f",
        firstAuditRecordDigest:
          "b03ebfcb73a70b4b2a5592c7b20a460199dd23f71088ca4f9b3eb9d2c9f1fcb0"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "01e87955f752ed67c4e2ad6b8ea4f91a95caa5d1e29566e2a72a0e24e739f387",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      counterAudit: "raw",
      identity: {
        stepEntryId: 16064,
        eStrong: "H3651c",
        dStrong: "H3651C =",
        uStrong: "H3651C"
      },
      input: {
        rawHtmlDigest:
          "c6e56f2ab5720216a105707548262c55c32ff81f6841556ae3a77484513a97ae",
        rawAssertionDigest:
          "d8c1eaaf7d64bde07eacc58632e9bb58137cda8377ebd396445d6a9cb0784b4a",
        auditRecordDigest:
          "f0beb9cc45725f23c349c1dacd31d9a25838e1e42619a88a580fffdacbc11f2e",
        candidateRecordDigest:
          "6147d118f1b46dc8eed0002a8be73ddd237fe443c804164177f736181099255d",
        stepAnchorDigest:
          "5ab11125f2755f056895f41dfeaf77583834bc50355f2d2dc597d6111a2f2541",
        firstAuditRecordDigest:
          "0dccd6863f7d75c38c5a999e3511cbd2488cd32ba2671aeb8dedfa9c4c370802"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "c6e56f2ab5720216a105707548262c55c32ff81f6841556ae3a77484513a97ae",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      key: "H3715B",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16143,
        eStrong: "H3715b",
        dStrong: "H3715B = a Name of",
        uStrong: "H0207"
      },
      input: {
        rawHtmlDigest:
          "f336d8e1ac102421f04d8bf0c51abe95c0fcc1fad4ddea8ad5dde1eaaae18d36",
        rawAssertionDigest:
          "ac442fe3f7cde218e5dd67b2e9c4febe70e097236c04651b05451fe7457dbfe6",
        auditRecordDigest:
          "d17ee549a4a7f9236b54bae121f070f891fb65b63080cfa27fa99a67e375d6e7",
        candidateRecordDigest:
          "f5c0fba062e97e3cae367dc409e39bf2afc8617d57d203eba8e6142bc53f224a",
        stepAnchorDigest:
          "b42b5b4ed3d789ef3b899c957af20d9504ae9803740c0a4891c261770bbcfefe",
        firstAuditRecordDigest:
          "9253ac147596f9957e2ef7d36aea6e42ddd758ee5daca5a0d641b41939e07a66"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "f336d8e1ac102421f04d8bf0c51abe95c0fcc1fad4ddea8ad5dde1eaaae18d36",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:16143":
          "b42b5b4ed3d789ef3b899c957af20d9504ae9803740c0a4891c261770bbcfefe",
        "STEPBible-TIPNR:H3715B:entity:3849":
          "405827437e756704097b72ccf335ab76adddac8284e04daca7f95a17e71e9b9b"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "cc581cf77726a2deef649f09bffecce48d556a31ed965efee7ded185095da076"
      }
    },
    {
      key: "H3723G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16153,
        eStrong: "H3723",
        dStrong: "H3723G =",
        uStrong: "H3723G"
      },
      input: {
        rawHtmlDigest:
          "6d0e3a93c5afcad99ed5a50db0fb1004f2cfb7cc3b594b3904b3652b3156928b",
        rawAssertionDigest:
          "dd9de8fa8e73e644b5d47e915479af5d95f900da4c6939928835199542b3cdb0",
        auditRecordDigest:
          "d43c8caca77885f2a8832a60d7ebe54c59a1b020158e6daa79e2ae9e6f207f9d",
        candidateRecordDigest:
          "89bae72ba06e4564a9dc772e9284c7ccc720f265159662462755b4e0a74a1d7b",
        stepAnchorDigest:
          "d2ad7708851fc72bd18d27b8185d37a3cd8953db081f33cab2f1461202608ffd",
        firstAuditRecordDigest:
          "c60dbf79f20e85179b479efb96b52a356657c1b7821852980135059c9c93bff5"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "6d0e3a93c5afcad99ed5a50db0fb1004f2cfb7cc3b594b3904b3652b3156928b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:16153":
          "d2ad7708851fc72bd18d27b8185d37a3cd8953db081f33cab2f1461202608ffd",
        "STEPBible-TIPNR:H3723G:entity:3353":
          "d212fb6d102e00c625419652c49c9f0d81a6743a82381c0e8a6d1ac061a7377e"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "f2f355176a80c6dcda09715bd0bc27a19540207f576eba5f02ba2f4baa749aa0"
      }
    },
    {
      key: "H3762",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16204,
        eStrong: "H3762",
        dStrong: "H3762 = a group of",
        uStrong: "H3760G"
      },
      input: {
        rawHtmlDigest:
          "74eb0341c2c60a7f01a34af8a97e2239487c1188d13a108c8497699211923d29",
        rawAssertionDigest:
          "1cbd15eca9d9a2c85432452e2383ea069ad7be2e89f87593029440b4dbc82ec2",
        auditRecordDigest:
          "6ebc8ca7898a55dcc481b3ff01a9208c11243592bfbc3459bf2d9961795bc5f6",
        candidateRecordDigest:
          "264ddc6f7f443af612797a7222f1490a21beef3b7945c93292254f251c22f79f",
        stepAnchorDigest:
          "90da77a8fe20bdeaad7a011a012d9ff2803eeb3a5e1a2e92c2b8a1197ed6e98e",
        firstAuditRecordDigest:
          "aca64b118e99886d9e802e263a83ff45a5ad6ea8fb9e712b461492cf896a0758"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "74eb0341c2c60a7f01a34af8a97e2239487c1188d13a108c8497699211923d29",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:16204":
          "90da77a8fe20bdeaad7a011a012d9ff2803eeb3a5e1a2e92c2b8a1197ed6e98e",
        "STEPBible-TIPNR:H3762:entity:3346":
          "34127d2b9b1ca6c24590b7758fa3375e6d7625b3cdb3f751df8ace873b50b8f7"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "3aa391251aa57b1db5e65647606ab524eb8fe2cd004ab4177ce68646e2e51f72"
      }
    },
    {
      key: "H3814",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16261,
        eStrong: "H3814",
        dStrong: "H3814 = a Spelling of",
        uStrong: "H3909"
      },
      input: {
        rawHtmlDigest:
          "a6dedcadbaae1d1df92c63df67ff5ceb9fa71897a99cd72de298e2bb6d18e305",
        rawAssertionDigest:
          "387442e81004a48899563ae5db312dbbe01589b8992bb89a2884a9fa2617fdf6",
        auditRecordDigest:
          "46f234252c524c6640e8b1795161cf50643380bb1c13fdc73722bc29b4b8c7a3",
        candidateRecordDigest:
          "847bc7233173f5831c55ad1725fb8a1ea9fce08ec1048b13aa9cb58a33bfc6bf",
        stepAnchorDigest:
          "a543a3aba7917408f5cc15702e19e3282db76e20103824e559f929028229d99c",
        firstAuditRecordDigest:
          "8deae5cfecd4ee6ccb51742fa7befeea790cc266a97771effd594dc36061ad48"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a6dedcadbaae1d1df92c63df67ff5ceb9fa71897a99cd72de298e2bb6d18e305",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:l.ax.ab":
          "ead4560b23c730ca0207620ef430dd711133346e662a73cb0957f988f8a91fba",
        "OpenScriptures-HebrewStrong:H3814":
          "a889d963fac460025ed666c74ef8a9053ed187f1e244cd30c99538aa11aab18a",
        "OpenScriptures-HebrewStrong:H3909":
          "823e38a110176d461a91caf5e75d58c0feb06c18a6cfcc5fd7d6c34bc784f922",
        "OpenScriptures-LexicalIndex:gbd":
          "a2fbdbac8513581bc39dbbd61ea442f1433019a1c547e0291880a6cb62161c36",
        "OpenScriptures-LexicalIndex:gfi":
          "f3d6e8ce3868e512fd13a03a165938fab55b8249037425d74d2abdf7147920c0",
        "STEP-gloss-anchor:16261":
          "a543a3aba7917408f5cc15702e19e3282db76e20103824e559f929028229d99c",
        "STEP-relation-graph:16261":
          "4dfb85dbff0f3b978a836231e45d33ddaddf652b0a2074d2679cc0a3b32a0f20",
        "STEP-relation-graph:16377":
          "6767fa81666404be618c5669d5a617a4f42faed752ee12a2ec3d5c1473983f0b"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "e4334685b96b7f9e53eb76b0e10a0db2779ff49c40a8211c100f5baa0b0f5749"
      }
    },
    {
      key: "H3876",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 16338,
        eStrong: "H3876",
        dStrong: "H3876 =",
        uStrong: "H3876"
      },
      input: {
        rawHtmlDigest:
          "ff432f164babcb086ed1c555e5f76508191108b8444f578b3476a4ebd040a4a8",
        rawAssertionDigest:
          "afc14e5c3197974cf81a8ab4252ed8749fcf2371add5446dd1338100e82a44f6",
        auditRecordDigest:
          "ed438eb20d9441f975b289371de455730cd3a82848458473c8cf6c4ad1eab553",
        candidateRecordDigest:
          "6b52e13b6eac90afa47e76a612c279633ca2874ec1a61dcd24e0637ec653cf7e",
        stepAnchorDigest:
          "27c7b8707a5137c13162a48c997cb2906226ea2eade8a38f5fbcc8ba8ce0cec8",
        firstAuditRecordDigest:
          "2b5b22c7e47fef7f34c9a4bb01eabe00eb6c27f9b1b61fca7b664f7c72143697"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "101f622de5451d56434d4b1d816fe0e3174d25a4d94ea59e6e42d6c55c6d3596",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:l.ax.ad":
          "2540891eb5a0c20ea4099a36fd9dcb5d4233455778d1701917217c7810f03adc",
        "OpenScriptures-HebrewStrong:H3876":
          "39c6cfbace6b14760ef9bd70966c70c158db602852af47c1de8553392e244e99",
        "OpenScriptures-LexicalIndex:gdy":
          "ea4df195be07ad18174f22241f2aac8da945a64aa1b2b913fc5b4e45f45532a1",
        "STEP-gloss-anchor:16338":
          "27c7b8707a5137c13162a48c997cb2906226ea2eade8a38f5fbcc8ba8ce0cec8"
      },
      occurrenceProof: {
        count: 33,
        occurrenceCorpusDigest:
          "9616302e46db699b4ad89c65a256eee90189684db337b0adc2881f3da139efbc"
      }
    },
    {
      key: "H3889",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 16353,
        eStrong: "H3889",
        dStrong: "H3889 =",
        uStrong: "H3889"
      },
      input: {
        rawHtmlDigest:
          "c0ef708e2542488462ba9731d78526d0a6501a97d4617b17bde927a6f3f94df5",
        rawAssertionDigest:
          "666ed90d33e008c1ba7f6d4dd9941a10357f551610512cc31afd8739ae96edea",
        auditRecordDigest:
          "701eaf79800b1c1703e917c0c7b8f305fbef1ee6fdc5f84be0de56cd29f9918c",
        candidateRecordDigest:
          "5ca4a4a5f902222063c9702d5365eac8a395b5212945c0b6e95d92bb6bc94bd0",
        stepAnchorDigest:
          "543cb6f5d495676fd6ef31f404525655298233eecdef55902df0ceedeb07b8d9",
        firstAuditRecordDigest:
          "46fd5a2a5fd0b8e6ccc97d44f35e68ca1a383ac0bab35dceaec726d0db644c1c"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "b38b38d3e7e81b8cc16ddc63b265340f78d64bbeda5fe054bb74ea5b89d7a61d",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:16353":
          "543cb6f5d495676fd6ef31f404525655298233eecdef55902df0ceedeb07b8d9",
        "STEPBible-TIPNR:H3889:entity:1787":
          "1845a0c7b20ee7c4ab02b156a1c77496d90f0219ba85d8daafca17b654a37408"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "8e06983ada8a3dc02b3d5eca742413d8c7f1a8e10f843d00f3c93ccade83b1e9"
      }
    },
    {
      key: "H3928",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16399,
        eStrong: "H3928",
        dStrong: "H3928 =",
        uStrong: "H3928"
      },
      input: {
        rawHtmlDigest:
          "225082907b163ef7380393bd29df4576a49cf0290d99fb7c6f9a47482ed6c4a5",
        rawAssertionDigest:
          "f256188055eb5e39cbccdbef6535b15a1dd14defe08d9d16dfa38d5f66e132e1",
        auditRecordDigest:
          "708a7d175a18d444da2522a324c32edd3ad99d461e03cb199b54e2cf571a796d",
        candidateRecordDigest:
          "38ad5e52ed9e774b1706752331782671731c8c13b97ab57433e855beed722cf8",
        stepAnchorDigest:
          "4ec89a59fd7556b2dcef67e639c6e0212919b99405909c2126df67639535d72f",
        firstAuditRecordDigest:
          "2b0309ce380b8701a6e8157b584cebc7bf8f328862a1fb18f3869e0ff7338778"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "225082907b163ef7380393bd29df4576a49cf0290d99fb7c6f9a47482ed6c4a5",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H3928":
          "58cf97f51b32409cff3fdec740724ec4adc658fd969d77a63beda72247e719d4",
        "OpenScriptures-LexicalIndex:ggb":
          "8137b79d3c83e7c67d26b8b3c52859215eca39c17af4d386c75e6f84325c702e",
        "STEP-gloss-anchor:16399":
          "4ec89a59fd7556b2dcef67e639c6e0212919b99405909c2126df67639535d72f"
      },
      occurrenceProof: {
        count: 6,
        occurrenceCorpusDigest:
          "6f6f02650fcc4678fb6ae8b3b759dd49866df8124b1de4c78395899375ce17e5"
      }
    },
    {
      key: "H4059",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16549,
        eStrong: "H4059",
        dStrong: "H4059 = a Spelling of",
        uStrong: "H4058"
      },
      input: {
        rawHtmlDigest:
          "1dbb4b7956b1e9d7fa8b764c5f513542a7ed695dcef2d857294e4079b46af2f2",
        rawAssertionDigest:
          "1e6667a4798591bff1efce15c605207187c18705a202c4eb6993c8fac514027b",
        auditRecordDigest:
          "33780914115b718f315ce68fddcdc14a521a6d399cead1071560e3d877e0982a",
        candidateRecordDigest:
          "e6ce5be16486bbe5741565c20910716869e8bd991f6451c4860a903e81186409",
        stepAnchorDigest:
          "da135fd5b90855bc318a3e52f35600c9386902edbebbd71ad131b9dfa64160de",
        firstAuditRecordDigest:
          "c8471fbf72d5fee4379510d21d23408aa6125ff1c3e9206c33850d93e68f14a9"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "1dbb4b7956b1e9d7fa8b764c5f513542a7ed695dcef2d857294e4079b46af2f2",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:m.al.aa":
          "b59d433db78f64c1ccc5e6eeb1e487deb7131cd76890a4c9496703e040cf855b",
        "OpenScriptures-HebrewStrong:H4058":
          "d0536c31e5860c64d9616a86ed22f26b7ece3fc4d75214a134ab46279e6dc780",
        "OpenScriptures-HebrewStrong:H4059":
          "5f0f3e8302e01844af64eccb92d0549791f9f423269d7ffa0727ac83491e062c",
        "OpenScriptures-LexicalIndex:gln":
          "fa7ff5841040edec4e4421a28c55e8a0408629135207235ac75b4a316e2e1ac7",
        "OpenScriptures-LexicalIndex:glo":
          "0d6f6729362986ad0860d93650be0db8f683549cf8a376cbd5102d3bd7b76294",
        "STEP-gloss-anchor:16549":
          "da135fd5b90855bc318a3e52f35600c9386902edbebbd71ad131b9dfa64160de",
        "STEP-relation-graph:16548":
          "3a732566947964436658cc04d24b51df91d0cbb4c8f53793ad8cdd10284f0669",
        "STEP-relation-graph:16549":
          "64a7e6b751c9dbf411696663a415b8c1a7ec3d8c5b5b56a1f1db61f6d80c06b1"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "b93e8c15678b1ff8d645e88b7aa65049442b15361e366dceeefe1a028f185c4f"
      }
    },
    {
      key: "H4108",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16607,
        eStrong: "H4108",
        dStrong: "H4108 = a Spelling of",
        uStrong: "H4109"
      },
      input: {
        rawHtmlDigest:
          "23c8a2a1b2ba1938d7f31e34b1ef46fe37cc40a2acfdbc228ea6693743604b5f",
        rawAssertionDigest:
          "6985bfdfa3493268deebbc7b1e06f2d04a1fe69efd0563d1f7474f73c7b9503b",
        auditRecordDigest:
          "9de5f6bad4522b912bd376c385368058c7b48f61ef0320e81071c3e1c80838e2",
        candidateRecordDigest:
          "21b26f1ff77cfdd5adbae8dca5435a78c77f0593ae631cb3e5b307a1522d0352",
        stepAnchorDigest:
          "8fa2056f2003a22ee8896b8dd696e53d9988511e3eda2386a26c53c0b4d31e25",
        firstAuditRecordDigest:
          "974d34d3e88fbdbcc2a585ebea87c205f7fc1d142e6907c99f65422c1c046b37"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "23c8a2a1b2ba1938d7f31e34b1ef46fe37cc40a2acfdbc228ea6693743604b5f",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:e.bn.ae":
          "61bf8a63ec9865a7a531daf258d25bc67b5b94198ee29ecc1538456d177d7ce5",
        "OpenScriptures-HebrewStrong:H4108":
          "8976ff27bba089d6b9559080091db07c491cb409bf99303b3c3be361eb6b9e3f",
        "OpenScriptures-HebrewStrong:H4109":
          "bf5a02925cf002b6a74bf6f92a77e010b4ded43f7e8d36405e6697ac93a48a38",
        "OpenScriptures-LexicalIndex:gnh":
          "d8895a8186fe7e759a5feba7e0a74ecb1c2aa8d00d9cfff72d5437c2af57a483",
        "OpenScriptures-LexicalIndex:gni":
          "bd2ed226934240c3bd8fcb9aced8007e281383ec88f30935f3f5523a79a53e53",
        "STEP-gloss-anchor:16607":
          "8fa2056f2003a22ee8896b8dd696e53d9988511e3eda2386a26c53c0b4d31e25",
        "STEP-relation-graph:16607":
          "5ff1c874eff9593fff7f433170328dfd93792504e4a59d38abb0a6ef67b674c8",
        "STEP-relation-graph:16608":
          "b987b98250e82be9c504f1afe69d7fdcfa911104d7e170e7ba5062959bedbc67"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "77df8aea0759daea8a40e170c9092bf2261629da1b204d7180beea0b0a0fa9e9"
      }
    },
    {
      key: "H4178",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16692,
        eStrong: "H4178",
        dStrong: "H4178 = a form of",
        uStrong: "H4803"
      },
      input: {
        rawHtmlDigest:
          "5ec95196a5e57358f39ee11e3d453e1d64b381da19e40d4dd48bcff5630577e1",
        rawAssertionDigest:
          "f1d4b5e0c683fa66f1de709c10d83e583edc8c460b8d57759b10ea6933e981e3",
        auditRecordDigest:
          "a1a0e0817865b8527ec8c066e1d2b64c708339d0fb89e89bbe017f94e681c018",
        candidateRecordDigest:
          "eb09b0f61fc793355e4604db53e1d0795680c80e2da473b843eaab5b94bd113a",
        stepAnchorDigest:
          "5a511e56f94f7c04e91793b39eb23593f9a8c6550199e0a1aead72d8927cc785",
        firstAuditRecordDigest:
          "2e9532bd433513f75249dce6696ae38e39366ce423f730c4578b56b2eed5317f"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "5ec95196a5e57358f39ee11e3d453e1d64b381da19e40d4dd48bcff5630577e1",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:m.dm.aa":
          "eccbe639093381b313a245f8816c608f3e70a12b6052929794c87ce02c69de92",
        "OpenScriptures-HebrewStrong:H4178":
          "bc3abf6a9317ddf723ba80d3e4cdc0b63712e055f288d1b8a0433b4a77de9d6b",
        "OpenScriptures-HebrewStrong:H4803":
          "15c0ee25f151eff863a68ce24059ba77327e96b119e7ad4cf5790e27ac5daafe",
        "OpenScriptures-LexicalIndex:gqg":
          "c9c7f09d78f5a75bd1649c3768c5dec24d20837e2230bee0b0242a504ea61797",
        "OpenScriptures-LexicalIndex:hpj":
          "050dad2d3d5d145401ae933527b98433edcd1979604ea9006f7756a4d7c5c889",
        "STEP-gloss-anchor:16692":
          "5a511e56f94f7c04e91793b39eb23593f9a8c6550199e0a1aead72d8927cc785",
        "STEP-relation-graph:16692":
          "dc15f899a6067825da832a5fe929cb2325286a35a9d24e5a61820950ce13c2c1",
        "STEP-relation-graph:17483":
          "07276cc161c2eee367d886d9c718ab8c8decd1b218898564a0574f4c143942e6"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "b40e0761d9e41d929bb55a9b6ed6db7138f7804b0a5b319cc2cba3ae8a89c5b1"
      }
    },
    {
      key: "H4192",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 16706,
        eStrong: "H4192",
        dStrong: "H4192 =",
        uStrong: "H4192"
      },
      input: {
        rawHtmlDigest:
          "0b82357e6974d7270e3aeebace9266d40be29075271d11f69cbadf658c174382",
        rawAssertionDigest:
          "6df49bd789b15094e467058a234c11b44ea06564b69028e57d61728a2afeceee",
        auditRecordDigest:
          "8540abc03d71c973edc1cc960f39695ac6743834a0cff76731e1f41730e03e69",
        candidateRecordDigest:
          "7e5ceed31e52b80e265259f7ce2a9e1d24d5b18618edd8e200a1723f9406c6e0",
        stepAnchorDigest:
          "c889284beac18c794cfb4f1995eaa55655cca25a7a3fc178257ba78da8847833",
        firstAuditRecordDigest:
          "2bcf7b0ff64ef57c18ea7c3fbf0fcd6b51891f6e3cc7373678d4bd415eb4bf8f"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "048271809a6e1a3f239374b25407f2d11bb088c08742234ee0125873571e8fe3",
        reconstructionHtml:
          "<p><strong>-labben:</strong> the second element of Muth-labben in the heading of Psalm 9. The expression is uncertain and is treated either as a musical direction or a song or tune title, sometimes rendered “Death of the Son.”</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:16706":
          "c889284beac18c794cfb4f1995eaa55655cca25a7a3fc178257ba78da8847833",
        "STEPBible-TIPNR:H4192:entity:4184":
          "9cff789987ecfa28ceef990b268e9a18d4406692449a3bdfad0d3d7c5375f0da"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "aca14b371a5da9c1cad6884665071d03e709d9e53754c4731b844f37db46583c"
      }
    },
    {
      key: "H4307H",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16838,
        eStrong: "H4307",
        dStrong: "H4307H =",
        uStrong: "H4307H"
      },
      input: {
        rawHtmlDigest:
          "5495b2cc20ea1df219b23ee532c86f1051e6edec7b2d6fcf3890a1e57d098a4a",
        rawAssertionDigest:
          "1349499e04cc962427ae56ee56e56718ff10b5a0a86b4504df408c94ed195787",
        auditRecordDigest:
          "9a6430399d88d37ecb2fdbe9c2c6c0e396995930b91529766339466eb57778f8",
        candidateRecordDigest:
          "2ce2c3065280c4a2c9ee78ccd064a7465acb7b740d761e3c7fe7bc3e76bd816a",
        stepAnchorDigest:
          "e610d044a2e3a665e7e412cba2af5504fe4357d98e4c1ea248d36ca318140a3a",
        firstAuditRecordDigest:
          "43ec4ae75b755ade158a45af6193f19480bdd5f9d2ebda9c42517dc89bb5b4d7"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "5495b2cc20ea1df219b23ee532c86f1051e6edec7b2d6fcf3890a1e57d098a4a",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H4307":
          "46d2f7ed151318a56448b9c97dbf05b7ce934b81f1ca8550e75120a753893d96",
        "OpenScriptures-LexicalIndex:gvp":
          "c8b825fb3488d1886684235660300db1424b505635ec28846db207e910c9e8eb",
        "STEP-gloss-anchor:16838":
          "e610d044a2e3a665e7e412cba2af5504fe4357d98e4c1ea248d36ca318140a3a"
      },
      occurrenceProof: {
        count: 15,
        occurrenceCorpusDigest:
          "b8369fcec233399f6be09eb56209715a29ef7211facb22d6ec8cf3f036640097"
      }
    },
    {
      key: "H4308",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 16839,
        eStrong: "H4308",
        dStrong: "H4308 =",
        uStrong: "H4308"
      },
      input: {
        rawHtmlDigest:
          "c145fcfdd9d506dce0a04f4d535f438baaa04b211fa782e0767d011261f15397",
        rawAssertionDigest:
          "9421030a99236793f15a5724d4659329d2bee1ad59268715d057a510c440973a",
        auditRecordDigest:
          "e8f7e6b009ad795ab6a159be5b422788535811be7163ce49064412fdb043fa73",
        candidateRecordDigest:
          "522a777a4f8e99178d291737043dea0d199c552b52031bf092e9925e86314939",
        stepAnchorDigest:
          "d3fa1931e40fe4bb847d638657952f44bf9f308931aeccd3235c107dcfb2c3fa",
        firstAuditRecordDigest:
          "4cf54a260ad3818e3144dbe17b837e49da8e69d0daef12f5b86558eeff588f18"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "bd104cca1ddacdebda47088777b67d133eb2bb6d5e20837ea8dad2e5cc7f52c6",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:i.bk.ab":
          "a6f7016537d9c471385899558d38e7e5ae584ae9be30012dec49d4147896337a",
        "OpenScriptures-HebrewStrong:H4308":
          "2e10a1da554722f91060b77e7418845bcc9e4dbcc0c222ba21305b804c088839",
        "OpenScriptures-LexicalIndex:gvo":
          "66f874574dd5f318a756bbf3dc333dfc7a9ac7a6743b284dae4f84c7a43efa65",
        "STEP-gloss-anchor:16839":
          "d3fa1931e40fe4bb847d638657952f44bf9f308931aeccd3235c107dcfb2c3fa"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "9dfa57f027bc02c12114129efa1b8d7e45d229ed7f0faca3b9e4a6bee3e9b4ad"
      }
    },
    {
      key: "H4319",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 16870,
        eStrong: "H4319",
        dStrong: "H4319 = a Name of",
        uStrong: "H4321G"
      },
      input: {
        rawHtmlDigest:
          "758bb5756e56db7d6568ee667d5a938d9916bdad67e388ab3ed9e37c476f3914",
        rawAssertionDigest:
          "f065302e7f7177d074557e5c40299d144fe31577ebde882570c91d1783f91e9a",
        auditRecordDigest:
          "c5cbada1dc828a8a9a8f743364d1f6e146af2c948554fa1733b7538d2c717062",
        candidateRecordDigest:
          "bd36e11977f3aeffc670181761fd2274abbd35f955c11bda72f503418d1fd430",
        stepAnchorDigest:
          "6d5e47e66b8e322ca889d3c4a353cec1301ed4c9336fe5a30b77d281d481743c",
        firstAuditRecordDigest:
          "2ac354ab766f47c608aa14d5fa8904a0ae29119d565f63f997fe1572043d6727"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "1a70a96c5c0f3be3ae1b7f730cc12f51601d43476382231c902142abe0de29fb",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:16870":
          "6d5e47e66b8e322ca889d3c4a353cec1301ed4c9336fe5a30b77d281d481743c",
        "STEPBible-TIPNR:H4319:entity:2046":
          "06e23c107dd08f640bf086475922da8ee01a6ee556f5af0f1566647ff68d2f98"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "7de4465572fd66d31911c7c3d29b5ccc6b50e265aa3c6fef15fd667f63f27864"
      }
    },
    {
      key: "H4320J",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 16874,
        eStrong: "H4320",
        dStrong: "H4320J = a Spelling of",
        uStrong: "H4318K"
      },
      input: {
        rawHtmlDigest:
          "3a545cd17d56718d065bb003c0d92f73373013bd3494fb4619b8f063c2ffbd09",
        rawAssertionDigest:
          "2f9d9d74eb6812e3d6981115e47d943402b827f05ce09ac223e3463333131626",
        auditRecordDigest:
          "4a1dce6fb2a7f00baba5f67035559934c17e4f2d87dc44b62b1ac8cea6c6ebf3",
        candidateRecordDigest:
          "4c8ab6c8a27e03583f2545bbd6bb1e59d4c8eed5c973dd2d9e0168545bc194d8",
        stepAnchorDigest:
          "f8e36ee9cafb182439547c7d9924474555d5a6d5272474efc637f43bc7395bc6",
        firstAuditRecordDigest:
          "23e3f37d2982e9d969f990093b082e9b00ea795037149b1aa8dd4b31026fe359"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "104d85f317bf6de523e915ea319270ac512855bf079ff662262a48a66ebfd033",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:16874":
          "f8e36ee9cafb182439547c7d9924474555d5a6d5272474efc637f43bc7395bc6",
        "STEPBible-TIPNR:H4320J:entity:2040":
          "51b11f804f055db7390150f3eed5e85f0367b0ae698f5ac8061fa286b36b2b57"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "e7dbbb830e576c53217c79ba5c0df859bf4742c54aec0fa28ed84d2205b4b3e3"
      }
    },
    {
      key: "H4387",
      counterAudit: "raw",
      identity: {
        stepEntryId: 16953,
        eStrong: "H4387",
        dStrong: "H4387 =",
        uStrong: "H4387"
      },
      input: {
        rawHtmlDigest:
          "0cd79de3c964b5fc33f5454cf7415717a4054a727c660521b9728cf2ed73c0db",
        rawAssertionDigest:
          "f7ba3a16473863dee16ab6cf8aad5e429872e9ffd5cc0e62523b630f11b619be",
        auditRecordDigest:
          "dcf981a8e1f0cf01e0a04b36a798057d635b5f3b11af5ddd9f03bc356a38219e",
        candidateRecordDigest:
          "87df713bef6cdec4e423b4ca3014d64a882f5fa2dcf70409eb9c9053dcafc58d",
        stepAnchorDigest:
          "0f3a4129ef248f80d45ff3b331c6573d4bf918be4f2d6d4277ce50e2f7b14ad5",
        firstAuditRecordDigest:
          "943f733ba9e09b23c4f6f40b8a3cfc38a223454323a4f57d92dd93d4e1d78662"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "0cd79de3c964b5fc33f5454cf7415717a4054a727c660521b9728cf2ed73c0db",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:16953":
          "0f3a4129ef248f80d45ff3b331c6573d4bf918be4f2d6d4277ce50e2f7b14ad5",
        "STEPBible-TIPNR:H4387:entity:4182":
          "5272e33655dc6e2fbe49efa15524b4de057b066f3b93986d4ce570bf7dfba3e5"
      },
      occurrenceProof: {
        count: 6,
        occurrenceCorpusDigest:
          "4ad8106a332ee1d61ab93bc997761c54b2674a74d20401cdc75dfde1ac969fd2"
      }
    },
    {
      key: "H4428J",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17007,
        eStrong: "H4428",
        dStrong: "H4428J = a Name of",
        uStrong: "H7975A"
      },
      input: {
        rawHtmlDigest:
          "1c2455b26d6dd10d4b50fffa8d52ac2b2cbc197a328e6ab02e5423e48fdc0d5f",
        rawAssertionDigest:
          "636fc440001304c141e644332ff0ca25cadac2cba38fbd0d8d3aeb13f1676de8",
        auditRecordDigest:
          "72e600daeaeb2c03f43fc45805820661aada1e8b8404e6d6bef93f4900e77533",
        candidateRecordDigest:
          "9327317e021cfcc499cc9972245bbdf0083bdf409dab25d5863e960982523ab8",
        stepAnchorDigest:
          "1dab72b8c1e326f1bc30257a2427a2ecf24f263c9a4969c5272b524c0b8acf9a",
        firstAuditRecordDigest:
          "eae3d682b6a24674124f8afd43b4d29f5eba0ee6688edad06c08984c0007aaa5"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "1c2455b26d6dd10d4b50fffa8d52ac2b2cbc197a328e6ab02e5423e48fdc0d5f",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17007":
          "1dab72b8c1e326f1bc30257a2427a2ecf24f263c9a4969c5272b524c0b8acf9a",
        "STEPBible-TIPNR:H4428J:entity:3976":
          "5acd8c9631c533e81d3c23713d75a021c5ef26dd46f4e639b03bb67146bb0017"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "e6ed6b0062fed05962ed5a3e392a350ca2cd02686061f61f33395e3bfa5b1995"
      }
    },
    {
      key: "H4428K",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17008,
        eStrong: "H4428",
        dStrong: "H4428K = a Name of",
        uStrong: "H4432"
      },
      input: {
        rawHtmlDigest:
          "2c056010240a1664131aed544fc1e427c2f4942b9fbb43717551d606703bc443",
        rawAssertionDigest:
          "09dff7fd4f435e99c0aaa24a9f17be1c6a92713fb7a0f15f632c5742fe887adc",
        auditRecordDigest:
          "7a6a2960e762894f784802c16fe5b0ed4eb8c36fb077a9d4d69ca3496c0fcc6b",
        candidateRecordDigest:
          "5761bb10e7ac51fc69e6d489eb8c5a2776deee9c7c531198c232ae7fa20560c4",
        stepAnchorDigest:
          "46b9d39d7ba47014c19d0b45596570fd53fa12c0263cea6891cfe483767664dc",
        firstAuditRecordDigest:
          "71baa04aadaebd52541297f39213f0f91f541bcf31364a3019b67bc5cae4fa0e"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "2c056010240a1664131aed544fc1e427c2f4942b9fbb43717551d606703bc443",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17008":
          "46b9d39d7ba47014c19d0b45596570fd53fa12c0263cea6891cfe483767664dc",
        "STEPBible-TIPNR:H4428K:entity:4183":
          "dc19dbc7ba128f20676d4362d2cb25d44c8336e92bf2285f2935027338b0f7bf"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "6ba931c43a43fa28f02c8ae59c73dd23b3cb9531d7db98c6b006b7b06e9500e2"
      }
    },
    {
      key: "H4441J",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 17027,
        eStrong: "H4441",
        dStrong: "H4441J =",
        uStrong: "H4441J"
      },
      input: {
        rawHtmlDigest:
          "279f1c21d024a722f7bbdcdc8e4e0aa57298cfb4db144e4ea6cab514fa584459",
        rawAssertionDigest:
          "bfeb6625fdef06c60fc87e6efa12f043e3fcd6ff2096e1ea56accd2a08ac86a7",
        auditRecordDigest:
          "e7bf10abd32c55710e5c59f458e884a53d0a4bca5444035c22ca83bf72a2acb4",
        candidateRecordDigest:
          "805127bd97faf3f0870d508b5fbca2d2b0a522b427c504ce07cad1ee0b130de9",
        stepAnchorDigest:
          "38fad122e73c1d0905ad1084fe6c2365ca8fb94a2df96aafc5c5688553bccf4a",
        firstAuditRecordDigest:
          "df9531e6d58d001675f485b64332e70e63b7c33d1c425d94d20e18595849f9d9"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "3f087f7a697165b5772c199d17f477bec9af05b6a913d885ed46b619b18112f2",
        reconstructionHtml:
          "<p><strong>Malkijah/Malchijah:</strong> an Israelite named in Ezra 10:25 among those listed as having married foreign women.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
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
      key: "H4447",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 17043,
        eStrong: "H4447",
        dStrong: "H4447 =",
        uStrong: "H4447"
      },
      input: {
        rawHtmlDigest:
          "0b251710df6868435b147620fd768ef3299b450dbe90d714fa40c7262bda49ec",
        rawAssertionDigest:
          "29ddbb25849b9138da5b9bc5addf4d9f09430445604266156b2af3c5b3b290fe",
        auditRecordDigest:
          "54033e7b0f3b6de7d1df0164e7cc774e86d89dddb1e3d37a56757bd913f4becf",
        candidateRecordDigest:
          "65d96af50fb99e63eb376eeb40d5db0f45d4bdbdf74caa4e4b59f2f7692d62b5",
        stepAnchorDigest:
          "cfdae447b8bacaab535f403271d0cd38e14c53e8ba061e186da3a38186a71fe2",
        firstAuditRecordDigest:
          "b4a700ae16f4f63592e4a47d4a622017b1505b29ee563bc91a51ed73a12e1449"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "7359fe2ef540b103f09e6edee33c5e499cf28c32838ef4977808c32f04059adb",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H4447":
          "1f4419ea650668d5aa0cf1fc1cfd0609e111c9105df40aad1b934fe356f611cf",
        "OpenScriptures-LexicalIndex:hax":
          "bc92fc6fac002dbf5b0ef504102703643a1af2ddab95fd518538760b7442e139",
        "STEP-gloss-anchor:17043":
          "cfdae447b8bacaab535f403271d0cd38e14c53e8ba061e186da3a38186a71fe2"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "27f086cca8ae1189ee2766ed0a41f7e72ee0191337a1a0c64192e8de938b518f"
      }
    },
    {
      key: "H4496G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17097,
        eStrong: "H4496",
        dStrong: "H4496G = a Name of",
        uStrong: "H4506A"
      },
      input: {
        rawHtmlDigest:
          "57251d6586f069960fa1b8458dd9cde05d91c80c64ec5611c1b9a322be381fac",
        rawAssertionDigest:
          "9b532ff2c9bb86a7be6a8706ebe9d7424ec9b5032e6556dd8bfb91c920df4c2d",
        auditRecordDigest:
          "c01f962ec90ea67ab57b4bc5a6f90f67e144f67c5100ef116d7f191868bedb3e",
        candidateRecordDigest:
          "6dc029aea90b5597faf2c062d5bca6e417eb76f7e62b237bcea1e640000c13b8",
        stepAnchorDigest:
          "27b23d0f9162a0baaccf802db3f76dcf155d05d679e91d7ad9469cb7a7ea76f0",
        firstAuditRecordDigest:
          "3b81d5d534dc4282cfda2470c70b97b7f0e09cb0fbfefe0031906af55be3f2df"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "57251d6586f069960fa1b8458dd9cde05d91c80c64ec5611c1b9a322be381fac",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17097":
          "27b23d0f9162a0baaccf802db3f76dcf155d05d679e91d7ad9469cb7a7ea76f0",
        "STEPBible-TIPNR:H4496G:entity:3758":
          "2151454ed1431399262ee9acf24ddd538842266cffd9fdb360703ba849b98873"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "f228419cd4729f2f6c6eff0e6ed69f448edc3751ca65188f36836129e027bd97"
      }
    },
    {
      key: "H4616",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17247,
        eStrong: "H4616",
        dStrong: "H4616 =",
        uStrong: "H4616"
      },
      input: {
        rawHtmlDigest:
          "8728aeb6dc56bd1298c643b2544cad522c657d4131cc5bdb557a844b76b11047",
        rawAssertionDigest:
          "4860207205d578ff8a9b07606332c65d696f1618f7b5e24a46aca510001b9719",
        auditRecordDigest:
          "135f1e26a3535f1611387e1bc34a2c3e536172601086a5895a7fa15835518666",
        candidateRecordDigest:
          "0b4c3da5ac4eff55ede63ab63cd73c67a2cebe8ca9b935ac3e03525b1219d5e1",
        stepAnchorDigest:
          "4a4efa00d78149fe723b8a23ea6a0c7cb53aeb3835770dc52121e5a44a0b018c",
        firstAuditRecordDigest:
          "848a7f86d78b9cb1f28fa24cba40ca9fe9a83d1fa1857c7fa9462d742fbe6f3d"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "8728aeb6dc56bd1298c643b2544cad522c657d4131cc5bdb557a844b76b11047",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H4616":
          "28cf5f63b629061e2989d601b7a997531c363f55fff0286ef431bec39dcf591d",
        "OpenScriptures-LexicalIndex:hhq":
          "b42c4d3bfd6496bdf254cae4b0b885b8ed588d88cd829e7fb20e6e62879eb586",
        "STEP-gloss-anchor:17247":
          "4a4efa00d78149fe723b8a23ea6a0c7cb53aeb3835770dc52121e5a44a0b018c"
      },
      occurrenceProof: {
        count: 272,
        occurrenceCorpusDigest:
          "a5444db43a2a80ef0624e7653bebbf8340675789458cb5802d0c6958ad38db39"
      }
    },
    {
      key: "H4629G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17260,
        eStrong: "H4629",
        dStrong: "H4629G =",
        uStrong: "H4629G"
      },
      input: {
        rawHtmlDigest:
          "a5310fae4c3097d39277c62b84c5ea16fee29b14eda2f4341c191821ebedf325",
        rawAssertionDigest:
          "7f95e5ea81a851290097f5dcd68f39a10bb69d3835de77dd8008200477fe9805",
        auditRecordDigest:
          "2f1f68ba86b484a393704cc0ae23e894f07aadcf1b560f506e0d5fdae84f2f97",
        candidateRecordDigest:
          "602f32c4baaa7b100cf3a6261e3b8ed52df352abcaa854c43df82379c3570f7a",
        stepAnchorDigest:
          "0bcb14dccbbc3dec9ca3b9341e4eab423b9aabdfdd7be776e3c3b675d3c1b5df",
        firstAuditRecordDigest:
          "1dcb47d3aab7325391291cf3030fd2aa3d88b86584a5528a91aaf2ea46b0f2e5"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a5310fae4c3097d39277c62b84c5ea16fee29b14eda2f4341c191821ebedf325",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17260":
          "0bcb14dccbbc3dec9ca3b9341e4eab423b9aabdfdd7be776e3c3b675d3c1b5df",
        "STEPBible-TIPNR:H4629G:entity:3741":
          "a21f4182f5a6c828e98303336ee48186dea1b5eac8fc487c349496ce6ef55417"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "a94dbfbbb36282b0e600d3aab54b95351c27b1f0daa4a93dbdc89f7de17e4f36"
      }
    },
    {
      key: "H4629H",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17261,
        eStrong: "H4629",
        dStrong: "H4629H =",
        uStrong: "H4629H"
      },
      input: {
        rawHtmlDigest:
          "c449a978a7f00b9c77b4a39aeef7f19b95d1c577321242afb415d656b608201a",
        rawAssertionDigest:
          "bc1427bf39f4867e23455463574f55ab6ef7cf28791c5a8695d4118bc94ae1d2",
        auditRecordDigest:
          "9f474ed8214f53d8eaebc7c7a316d0f98e2b49a656fc57e973675c6d4271bba0",
        candidateRecordDigest:
          "2f9cbf3a5ae9d4487bb612512406f5a4ee236c4dc66a87eeecc9cf9f74782b68",
        stepAnchorDigest:
          "fdad608c284c43ff717355baed427fdd84eeef43b7f067e8cba3ced58b83c1a7",
        firstAuditRecordDigest:
          "5990bdae0eb721463cd42855ebfc7909eeae452caacc44618a7b45dd12b1338b"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "c449a978a7f00b9c77b4a39aeef7f19b95d1c577321242afb415d656b608201a",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H4629":
          "2cca98628201c65f7091db71f39e87ca29243ab9c38cf323e6e38ac5b77d91e6",
        "OpenScriptures-LexicalIndex:hih":
          "5eef81f8ff79f1f44b98e521aa2e16b6b2e974c22b6734751d37ae401ba13396",
        "STEP-gloss-anchor:17261":
          "fdad608c284c43ff717355baed427fdd84eeef43b7f067e8cba3ced58b83c1a7"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "520a3dee095de334d82e5d6b1fd4cc36112ff296d84f4b54abe4f16b353bc9b9"
      }
    },
    {
      key: "H4663",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17322,
        eStrong: "H4663",
        dStrong: "H4663 = a Name of",
        uStrong: "H4662G"
      },
      input: {
        rawHtmlDigest:
          "6f4819a1d31d51d089fb79684f0725e31204fd6e757d368701fa44814bcfe40e",
        rawAssertionDigest:
          "29c508eaa28ce9266045fd2fe0cc96d822e917105cc4c49070d92ba5cc3e83dc",
        auditRecordDigest:
          "2d97c0a56a0d03c31fbf3b0c0cc811f05c3b058a260ccbf3c099fb06c6456de2",
        candidateRecordDigest:
          "9ff4e574f1243614ab7f319ec5b4c1fe6480c0fc6571267d867840b0defc33f8",
        stepAnchorDigest:
          "ae8530604cd9b1d7090efb8d2006b9757b4f3e07d3c4509d3e747ff2a2c41967",
        firstAuditRecordDigest:
          "7e5cc284ab9d6fbdd19cd7a7ec32adb30ca5e9fc6f7077f5c82721c1c39b2913"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "6f4819a1d31d51d089fb79684f0725e31204fd6e757d368701fa44814bcfe40e",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17322":
          "ae8530604cd9b1d7090efb8d2006b9757b4f3e07d3c4509d3e747ff2a2c41967",
        "STEPBible-TIPNR:H4663:entity:3817":
          "4b2948f199103fa7fb97c51dc6c46367d6fde1ae54d573ee6ca36b351f0ab04b"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "48064b93941336b893b18fcfe6d2bb4a98382fef83a36dbccbf0cde55880052e"
      }
    },
    {
      key: "H4905",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17602,
        eStrong: "H4905",
        dStrong: "H4905 =",
        uStrong: "H4905"
      },
      input: {
        rawHtmlDigest:
          "c9b2561c4e269a1a9e1ef39b68c541f0ce4bf84749d9c6b094cd15ffa68e2622",
        rawAssertionDigest:
          "d983d71a15fc68b1c9ff70213f9bb7a0a9d4bc431f45c359494da4b5f0f9d5ef",
        auditRecordDigest:
          "6e8342abec89a301ec14cc940f900858345a1bedbd1f59b83939776938de7d70",
        candidateRecordDigest:
          "1672d2b587d087b9daaea5d4d4d162bcda6421e160ffed70b3957b046bb2fba2",
        stepAnchorDigest:
          "12300509683451076dc920bba97517bfc8b472a771b9e03ce7ffadce0330dd3f",
        firstAuditRecordDigest:
          "eeae9f6785aa3331850f4db898cb46cf99d5145bb9cb647a36e3844e0c70a216"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "c9b2561c4e269a1a9e1ef39b68c541f0ce4bf84749d9c6b094cd15ffa68e2622",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17602":
          "12300509683451076dc920bba97517bfc8b472a771b9e03ce7ffadce0330dd3f",
        "STEPBible-TIPNR:H4905:entity:4178":
          "7fa9a97ad89388c19fef11a50b666ffffcb6e305cc2796874cace18c6b335985"
      },
      occurrenceProof: {
        count: 14,
        occurrenceCorpusDigest:
          "e8359e46b57b24c40bc9e02881a5832cafaa8e22ad3db7447d1fbd26c0995789"
      }
    },
    {
      key: "H4945A",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17676,
        eStrong: "H4945a",
        dStrong: "H4945A = a Spelling of",
        uStrong: "H8248G"
      },
      input: {
        rawHtmlDigest:
          "f835cf13a0f765723baf42c5db2d8550cf51807f62923966b8f45086ea9b3873",
        rawAssertionDigest:
          "61bdfa7aa6d4ce5bbdd8c36a57c75b69e9a1ecfc5355950b6a226c01b7a8313d",
        auditRecordDigest:
          "63bb8cbbd9697b61ef5f6d80c73e16f6b87e0108e87067ef936322dab06bd82b",
        candidateRecordDigest:
          "c87d517cc657711dffef4602fda2a86cea891da9bb41888c95572bef1af38e0c",
        stepAnchorDigest:
          "05671a1ad392424586af2ef938509bf83d67be9bbec55e2d041a5d389cbab402",
        firstAuditRecordDigest:
          "20cb45dec49d3f2cc440734a198256efd6e04ff11a0d9a0d3696a9585125245a"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "f835cf13a0f765723baf42c5db2d8550cf51807f62923966b8f45086ea9b3873",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H4945a":
          "48e54e7c94f2b25cd7ccba520567bf670b56811b0006481630f079c9af2e7550",
        "OpenScriptures-BrownDriverBriggs:v.fo.ad":
          "d04c6d633dbc5453463761f2fe71ce593e2eb7936368e8010283f3a93865a281",
        "OpenScriptures-HebrewStrong:H4945":
          "3a20a7038956c0bbf1d9747aec104109efaf9a343371477f0240fdc2ac453491",
        "OpenScriptures-LexicalIndex:hvl":
          "cda4192e4e8300503426c0c73ac52015bf80fd6fca7c01b84c17976b00b8d362",
        "STEP-gloss-anchor:17676":
          "05671a1ad392424586af2ef938509bf83d67be9bbec55e2d041a5d389cbab402"
      },
      occurrenceProof: {
        count: 13,
        occurrenceCorpusDigest:
          "fe1771b44030473feea7ad1b71ffd3d2fd5624517e346c2455cd83b6842a5359"
      }
    },
    {
      key: "H4984",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17729,
        eStrong: "H4984",
        dStrong: "H4984 = a form of",
        uStrong: "H5375G"
      },
      input: {
        rawHtmlDigest:
          "4429bedaa2520086bee5cc753ff53b3d6605a9c4cfe0e9a4a3275d7207acdf01",
        rawAssertionDigest:
          "ae5a6725b07f7ff1a7485671c5fc14549e7a9c1ab9af88bb21301c277b560898",
        auditRecordDigest:
          "0981595266592ec4e7f7fa35b3361d94b3c0af067ac15c30c263df2e98c66a8b",
        candidateRecordDigest:
          "a2fef9259fca4b4728fc90404c8ef136e28b417710e24f52be068413d98e23b5",
        stepAnchorDigest:
          "82b88a6c98b5fa59523594099941a10351ba74210f09b7ee196f628965f8f1f2",
        firstAuditRecordDigest:
          "26b57f00261729a7357c3f91191c2169ed5d1d35bcfd4962b0447eade2a2299d"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "4429bedaa2520086bee5cc753ff53b3d6605a9c4cfe0e9a4a3275d7207acdf01",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H4984":
          "1afeb87243d8d0142c92d1bb58fe0036e5fd6de9b82661c4c5607e9ab706b106",
        "OpenScriptures-LexicalIndex:hwx":
          "48c39902ced770d1fa0b5951c47c6829e15c9604113820aaeb9075f2a5fb1ff0",
        "STEP-gloss-anchor:17729":
          "82b88a6c98b5fa59523594099941a10351ba74210f09b7ee196f628965f8f1f2"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "5dcb2bad9ada122fa99c76f4b748f60241226752e7d909b8537917aeeb7eeab6"
      }
    },
    {
      key: "H5045H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 17802,
        eStrong: "H5045",
        dStrong: "H5045H = a Meaning of",
        uStrong: "H5045G"
      },
      input: {
        rawHtmlDigest:
          "9e14d03ba35bccacca592d047eecf77a89d02020d59a5fa106db23a98cace018",
        rawAssertionDigest:
          "62a96b9e529fad4394a5eb6ab8c1102c8aef4c9087736d2d0194e730e4fa6c15",
        auditRecordDigest:
          "6c0de6dd8f5b63f7efaa1af3ef11ae52e92454a97a0ed25d2e1b634092b1c75a",
        candidateRecordDigest:
          "e773507b2fcb4b62dc131f78dd8c36619c3b9cbf84e637743f7a9edcb3c18bba",
        stepAnchorDigest:
          "7ea97f6351417789bafe508292110db4c01f83d9072037c2aa1822f2c9e9990d",
        firstAuditRecordDigest:
          "5f5d288160b827cb04da535b620bf5b5cd92b4b2cb2b68eb49b4db9c5358aecc"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "742acc7886f5a34bc7a4be54878f125d51a49e5fd172ed59a5d8ebdcbc2f5987",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H5045":
          "1718c28975951969b057d67e0645f5462af68d57614b7ca2ad56302ca9f92d19",
        "OpenScriptures-LexicalIndex:hzi":
          "6cdb7f73b948ef303646d6b644e6fb69b1bc279793626fa6c88f5832a201de16",
        "STEP-gloss-anchor:17802":
          "7ea97f6351417789bafe508292110db4c01f83d9072037c2aa1822f2c9e9990d"
      },
      occurrenceProof: {
        count: 69,
        occurrenceCorpusDigest:
          "00074d2821a2d9aa6585d1ad0bfb7536842c95193ad0353dce01fb12aa0c76d6"
      }
    },
    {
      key: "H5118",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17889,
        eStrong: "H5118",
        dStrong: "H5118 = a Spelling of",
        uStrong: "H4496H"
      },
      input: {
        rawHtmlDigest:
          "fedab92a0be70048bf57823529b39af4075ff9235e8bb262086ef84ef5e94cc4",
        rawAssertionDigest:
          "a4e5939ada569508562f364434c090acbbf8296dd965d0ec5fb7e20a48ca31b3",
        auditRecordDigest:
          "7802f8e757bd2115bc4b6db5765db85044372c18d04c398c095df2defcda7684",
        candidateRecordDigest:
          "2763c03bfb4142f5fefdd1d5086cd6d800550f61e03ea85000f2f45d59c8a547",
        stepAnchorDigest:
          "45139a95b5c2cd2ebff740eb125d3478d512cb4ac9bddfe8491dd480eccd88dd",
        firstAuditRecordDigest:
          "2cacd4c5636fe9a2abe29a2d922f71a876e83cd462fd663d08d7642227b00f86"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "fedab92a0be70048bf57823529b39af4075ff9235e8bb262086ef84ef5e94cc4",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:n.by.am":
          "69b8425ebe3cc43a303406dad1957844bfda39b936c9728db1a45e06783ff77b",
        "OpenScriptures-HebrewStrong:H5118":
          "c180cd4c44c1af70dc5fba053c0ddf5199f0c075c8731b530b25586b0de028db",
        "OpenScriptures-LexicalIndex:ice":
          "94ba0f9e3e4f0d6547cf02a5b458daeb497f401490d194ee29994cdb1db4a942",
        "STEP-gloss-anchor:17889":
          "45139a95b5c2cd2ebff740eb125d3478d512cb4ac9bddfe8491dd480eccd88dd"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "39f3ce6dad1a53c9368f946a07e7a52e632c722c48dfdf10932e77e6caf403c3"
      }
    },
    {
      key: "H5139",
      counterAudit: "raw",
      identity: {
        stepEntryId: 17914,
        eStrong: "H5139",
        dStrong: "H5139 = a group of",
        uStrong: "H5145G"
      },
      input: {
        rawHtmlDigest:
          "4959ebb1a9a635842ed17e12a30cfc0e782d227a7f5c5187b46fa00807623123",
        rawAssertionDigest:
          "c11f23de5fbaf0eac6d1ab65cbcabbdecb0cc5c671a045ddccb154c21b4ed62d",
        auditRecordDigest:
          "395aad4ff5b3c36318a76c3ee82cb11925dc27127415ea5b51b3443313a15149",
        candidateRecordDigest:
          "99982557b360a6263235add5aa08ba2db84bc773708e803b49b5b30fd28b7590",
        stepAnchorDigest:
          "d9780a2095c39d82125c708e8b5f1afe5e7bb6a9c85492d8081f43a70ff08c95",
        firstAuditRecordDigest:
          "8b7ca3c4ac1038f946c72da9a5210a9aa8c16a0f83e5a255a6a774b8bffbc06e"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "4959ebb1a9a635842ed17e12a30cfc0e782d227a7f5c5187b46fa00807623123",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:n.cn.ac":
          "83b47fbe7436506ef85c831d6c92dbbf59965e5edd6f9eaead3f26056a2ad6b8",
        "OpenScriptures-HebrewStrong:H5139":
          "ed16c90c4bc91d89c2c4ea3793e767b48d3f55a461747cf18845d8cc32d89e26",
        "OpenScriptures-LexicalIndex:idb":
          "d65758e80e07538403752f68f120cfc6c771d5f49618325684ae0b65c3ceb4aa",
        "STEP-gloss-anchor:17914":
          "d9780a2095c39d82125c708e8b5f1afe5e7bb6a9c85492d8081f43a70ff08c95"
      },
      occurrenceProof: {
        count: 16,
        occurrenceCorpusDigest:
          "b3732c3010e21663b7a173118935cb9c651e105b5b94dddf15e6ed0517fbabb8"
      }
    },
    {
      key: "H5158G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 17939,
        eStrong: "H5158a",
        dStrong: "H5158G =",
        uStrong: "H5158G"
      },
      input: {
        rawHtmlDigest:
          "99493d281c3393f536ba03e30d82763a97777ea5b2a217aae03d59a40780248c",
        rawAssertionDigest:
          "4d3a19d8e4839cc064e838384176735c2f4a7df93924df9a1e6771b3e350f6c3",
        auditRecordDigest:
          "1996d71f58b360f0801fc41c370ec0f2037e73a90c251cdfe7069d97587df99d",
        candidateRecordDigest:
          "c6cdd219e21e92f8756d8507f694625e0fa8d9acff40c6e5eea93cf61ef5a066",
        stepAnchorDigest:
          "90b1eb09ecf5e9b5e5b9c1e75773393990bc2a7a81ad24e753ded7b34c8c0ec3",
        firstAuditRecordDigest:
          "7f7585ec981665624a4fa4cceea37f5ea47ba1a7a0be86fcadf40aa1afb9acef"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "e336d62ee7978db5b80a8cabd789d9ca01827f4c0ef033b7515261b5f755b20c",
        reconstructionHtml:
          "<p><strong>Brook of the Willows:</strong> the wadi named in Isaiah 15:7, also rendered “Ravine of the Poplars.”</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17939":
          "90b1eb09ecf5e9b5e5b9c1e75773393990bc2a7a81ad24e753ded7b34c8c0ec3",
        "STEPBible-TIPNR:H5158G:entity:3331":
          "9d86f274fb7053d05b90d351368325a02f6889cbd96040da696d931321f41fd2"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "b36b44c75316afb1f776cc7d634cf5b7d7a944a78e9dc49276938127c4653e43"
      }
    },
    {
      key: "H5158K",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 17943,
        eStrong: "H5158a",
        dStrong: "H5158K =",
        uStrong: "H5158K"
      },
      input: {
        rawHtmlDigest:
          "99493d281c3393f536ba03e30d82763a97777ea5b2a217aae03d59a40780248c",
        rawAssertionDigest:
          "4d3a19d8e4839cc064e838384176735c2f4a7df93924df9a1e6771b3e350f6c3",
        auditRecordDigest:
          "13a12355064627ad9250b206d5171f43c3600cdf4ac42e2290611010771a61a2",
        candidateRecordDigest:
          "e6988ce48539f375d5841e6e709a1326307a85d73cd0fb1b0df71f3b2b2616c3",
        stepAnchorDigest:
          "90b1eb09ecf5e9b5e5b9c1e75773393990bc2a7a81ad24e753ded7b34c8c0ec3",
        firstAuditRecordDigest:
          "8d26b7f5b2748e623e6e3d8051ba6bb587db9953b69ab592ee6d9c810a28d3cd"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "98d29320fcf6e4753249e8fb869e58718fd33af58023148195b02c02dd93cfde",
        reconstructionHtml:
          "<p><strong>Brook of the Arabah:</strong> the wadi named in Amos 6:14, also rendered “river of the wilderness” or “valley of the Arabah.”</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17943":
          "90b1eb09ecf5e9b5e5b9c1e75773393990bc2a7a81ad24e753ded7b34c8c0ec3",
        "STEPBible-TIPNR:H5158K:entity:3330":
          "af0027d5805bfbc98372c8c97046e361099e32937f7ccaab3bc5d68e5091675d"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "90e0937e5f7fa5722569aea1090002dfa92c263fec6ce9cf829b2662849588a5"
      }
    },
    {
      key: "H5158L",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 17944,
        eStrong: "H5158a",
        dStrong: "H5158L = a Name of",
        uStrong: "H7883G"
      },
      input: {
        rawHtmlDigest:
          "1bc672c6a1756f302ceaa63b01deb0dd478c8490b7fd18bdc96f0cc420147813",
        rawAssertionDigest:
          "e95e1e5a2707363ebc0e08519caaf1074aac7d43cb9c3c70cf72fff0a7c7eece",
        auditRecordDigest:
          "9b90c7a6283fd1e7cf5d0ea7ebf01905d795d961a548786e37f63975c1f57f12",
        candidateRecordDigest:
          "972e88547ca1b46022edb0fd913c46fc7fa90e76bf78cac321ce39f7c8c097b9",
        stepAnchorDigest:
          "90b1eb09ecf5e9b5e5b9c1e75773393990bc2a7a81ad24e753ded7b34c8c0ec3",
        firstAuditRecordDigest:
          "f62034127cca833ce0e8b3282c065649461defa3cc6b67503c090fef98db69c3"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "e38e4bd6087326af4ea4002462cc3a9ac0ac7cf8fd76da51714411ae681e5307",
        reconstructionHtml:
          "<p><strong>Brook of Egypt:</strong> the boundary wadi named in Numbers 34:5; Joshua 15:4, 47; 1 Kings 8:65; 2 Kings 24:7; 2 Chronicles 7:8; and Isaiah 27:12.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17944":
          "90b1eb09ecf5e9b5e5b9c1e75773393990bc2a7a81ad24e753ded7b34c8c0ec3",
        "STEPBible-TIPNR:H5158L:entity:3329":
          "53ea3f537e80058d5312d080de34e7dc6dda3095272d8f9cb84bf86d253f9ab9"
      },
      occurrenceProof: {
        count: 7,
        occurrenceCorpusDigest:
          "fa371be71c90090b343dd3a90a2de66f05c5199fa32b0aab45fa71be006457d5"
      }
    },
    {
      key: "H5158M",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 17945,
        eStrong: "H5158a",
        dStrong: "H5158M = a Name of",
        uStrong: "H7883G"
      },
      input: {
        rawHtmlDigest:
          "1bc672c6a1756f302ceaa63b01deb0dd478c8490b7fd18bdc96f0cc420147813",
        rawAssertionDigest:
          "e95e1e5a2707363ebc0e08519caaf1074aac7d43cb9c3c70cf72fff0a7c7eece",
        auditRecordDigest:
          "d64429246f20ba1bd22fdf1ca5658aea89b58e4dc09c0d8aa1d33f44a63c34f4",
        candidateRecordDigest:
          "e57b3cef5d3f5c77239649c2b83817c1efd87279ac05ab00c49dc744d3fa5851",
        stepAnchorDigest:
          "90b1eb09ecf5e9b5e5b9c1e75773393990bc2a7a81ad24e753ded7b34c8c0ec3",
        firstAuditRecordDigest:
          "a1aa777e45be8eb258ffdc0d55007a875d8901eb25e3ddbf635e34b541e183cb"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "4404100a03cc7cb2d1c46623f0a452b72f108a10eb05cce84c73e3a64109a817",
        reconstructionHtml:
          "<p><strong>Brook of Egypt:</strong> the boundary wadi referred to simply as “the brook” in Ezekiel 47:19 and 48:28.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:17945":
          "90b1eb09ecf5e9b5e5b9c1e75773393990bc2a7a81ad24e753ded7b34c8c0ec3",
        "STEPBible-TIPNR:H5158M:entity:3329":
          "f38016a2d56cf8965b821125d0ece82bde985585a2339d0ff283bf85ee4a7f66"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "7c4cf0f8a4a354f3e85cfed0f85b78bc33a4e94470464ae69e592ab2ebe4d5cd"
      }
    },
    {
      key: "H5354",
      counterAudit: "raw",
      identity: {
        stepEntryId: 18198,
        eStrong: "H5354",
        dStrong: "H5354 = a form of",
        uStrong: "H6962"
      },
      input: {
        rawHtmlDigest:
          "37122720e431e69e6c5a82a679a5121c52ec176b86a334e6ec92d39dae584b41",
        rawAssertionDigest:
          "fc1d596a997f46db4fe99ea01d29a4ee777d3e0685f0e2f19e589d260edc3c51",
        auditRecordDigest:
          "84078ae08b739efa07a7d03dacab50384e25cf20f7ce7ff2233781bb4f871f9c",
        candidateRecordDigest:
          "bc19fce224f3d267c241666b4d70cdfb7b5261064d1abf92bffda6498ab540a8",
        stepAnchorDigest:
          "1ae96285ba07d50e7f8e61065ebded3921e1820ea2057747ff318dbfa5697b38",
        firstAuditRecordDigest:
          "35528a2a3559db98e8ddc226f8b9999cbebfee8e43b74624d7e5f3d6f2e76de9"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "37122720e431e69e6c5a82a679a5121c52ec176b86a334e6ec92d39dae584b41",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:s.as.aa":
          "f9b23138639345a9bc15650610376245121c75f4a22aee2ede3ea5ea6da62a78",
        "OpenScriptures-HebrewStrong:H5354":
          "8e1fbff679c6cea22d74dd82b5de167e39225d27fa38cb1feec637ea50058068",
        "OpenScriptures-HebrewStrong:H6962":
          "ce287cd9f2fa4e5dfb3af8cca7a402ed4f039154107bcb5427d500f72f8ef5a2",
        "OpenScriptures-LexicalIndex:iml":
          "f8b9bda416b94d016afec374e534dd602e8b20616c0d1c896aeead4b0b434eb1",
        "OpenScriptures-LexicalIndex:lep":
          "ce71b631d282dbff84fb0a4bda4998cc773da43a3ab3a9b83f38c701df7dd2d4",
        "STEP-gloss-anchor:18198":
          "1ae96285ba07d50e7f8e61065ebded3921e1820ea2057747ff318dbfa5697b38",
        "STEP-relation-graph:18198":
          "5f4bfd248d23f15b8234df0536f55fc4dd01db3283e34c85a17a213d4f531658",
        "STEP-relation-graph:20430":
          "f2c19a32489cf1cfce1593c63772dff01b9ec31b10eb86f01749f0128cb6c156"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "9a3f07a95d8aab2d6bb5836fa2c2a9dd5645d7f6b2526e3d60a38fb59fb0f808"
      }
    },
    {
      key: "H5371H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 18220,
        eStrong: "H5371",
        dStrong: "H5371H =",
        uStrong: "H5371H"
      },
      input: {
        rawHtmlDigest:
          "4de2555e630c206a1bad02762e234466f01b7cb0a6e9e93c87a9428244879546",
        rawAssertionDigest:
          "84a25f2d54cb3fe23ac2637d085254e090fcc619dfe0242c605f934e1fd8cd46",
        auditRecordDigest:
          "af01c850d8a5b0d8012cdfa4fa425cb31fb165dd311a82d8ac331a6135567db0",
        candidateRecordDigest:
          "6e8b9fb7531d13740038b5c0a7b8fb5c056bd6d0208bff97cc830974ac77038b",
        stepAnchorDigest:
          "6c374d2f23efb13c533cee69a7001a6500adfbd94706724672dd520acecc7fd9",
        firstAuditRecordDigest:
          "305d46e09b7ee6637d75a152a927247e5bf6a2b68b33b8e90116b574ca1d9276"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "ef91f8a76aa1a3330d026e41648af4936371dee672ca659bea50d61f2696ad6d",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:18220":
          "6c374d2f23efb13c533cee69a7001a6500adfbd94706724672dd520acecc7fd9",
        "STEPBible-TIPNR:H5371H:entity:2170":
          "36cd2591f8fc26fa085c855dc128e2f0a031cef5fee74ccb72bfaede2dead240"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "04ab04ef51c41bfb6e4a9bd0a6c5fca8495274447def48d48ec631e85c019321"
      }
    },
    {
      key: "H5372",
      counterAudit: "raw",
      identity: {
        stepEntryId: 18221,
        eStrong: "H5372",
        dStrong: "H5372 = a form of",
        uStrong: "H7279"
      },
      input: {
        rawHtmlDigest:
          "4a4194ed4fbf23b2c4f95bca540bdfce3640dd560db44979caadbb033a02386b",
        rawAssertionDigest:
          "a2d50efbcdcff9bb003a601b99fd9baeb073c5e2f2e3fed60d245a754dd82b4d",
        auditRecordDigest:
          "7dc76f13850f3880a1156a1600ef1d5f30fa5257459f5a4aeedc4519f544ceed",
        candidateRecordDigest:
          "cc8021e902ff6b4d52c905c28046b16d0373bcd3617c7d1f222b0b220e1d3a23",
        stepAnchorDigest:
          "9b2f2b220caeac3117e4d60a85d95f45b98ecdfdb00a72448e9febdffbabdb9c",
        firstAuditRecordDigest:
          "c16a10a7ae0d69579752c2fbfa3be96b7b0bc77458c2cba717fbb95bad3dbc96"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "4a4194ed4fbf23b2c4f95bca540bdfce3640dd560db44979caadbb033a02386b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:t.at.aa":
          "b4751c943cd0b9fb1fb9f7917fa2307f1add8ad6de5928c29248de64445517f9",
        "OpenScriptures-HebrewStrong:H5372":
          "98eabb09364ee9b1abf1a7cb671e7eca9a840852b42757462564f5d26f544978",
        "OpenScriptures-HebrewStrong:H7279":
          "8336eff81d648a0acd7a6927d76214cedcd0ffa4605311267c9b4cf84125b8de",
        "OpenScriptures-LexicalIndex:ing":
          "226007b646b1398702539be11222446cb5630698350496d66c30b108b56b8f33",
        "OpenScriptures-LexicalIndex:lsc":
          "17bad8d48bf43262b9013170c30c01262a2ca15cd53a209f468bc5c3285e9c8c",
        "STEP-gloss-anchor:18221":
          "9b2f2b220caeac3117e4d60a85d95f45b98ecdfdb00a72448e9febdffbabdb9c",
        "STEP-relation-graph:18221":
          "cbf8de74b07da23f8b6517f464a555c8c6559005f3004499697d3fbc593a5067",
        "STEP-relation-graph:20846":
          "44980102b2ceaa50eafcd2434e612b58dc8fd96b7c45377dd0a416ff3af65cce"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "8eb8b7b6752f5e5eed6ad84b9d52c74f759e3906ef872206dcd78e8c93ae9a79"
      }
    },
    {
      key: "H5411",
      counterAudit: "raw",
      identity: {
        stepEntryId: 18281,
        eStrong: "H5411",
        dStrong: "H5411 =",
        uStrong: "H5411"
      },
      input: {
        rawHtmlDigest:
          "aec5cad9f22e2daa0cdca0ad5197f96e017d98ac0373e99f537747d721903cd7",
        rawAssertionDigest:
          "bfa279e985b93df5790f07906e1d4ef36a964c0aee30b9f4f8067f9e5aa6f2c2",
        auditRecordDigest:
          "fd0f75905b758943a3add193c2af216ef3820c0bbc4fbc803801f00ef3d66b7b",
        candidateRecordDigest:
          "94d997526cdf94302cfb88d74de7c4b743434b0e1ac8ae6a6b8a75c29fac1316",
        stepAnchorDigest:
          "330be444694c364c2178e56a4e416f821f258ce1ffe6ab829ea539400c8b70d6",
        firstAuditRecordDigest:
          "f9f21e217c68e7f909e364fecc17cdb9fbc9246211926b241128e60b4385d6bc"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "aec5cad9f22e2daa0cdca0ad5197f96e017d98ac0373e99f537747d721903cd7",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:n.gg.ad":
          "5de76faafb04705ad1f44cdd071d8995a8aea0c9b2cde68d0282b725c779b8e8",
        "OpenScriptures-HebrewStrong:H5411":
          "49c1fbdbe8bd0a109441bebe8cd17e23e27ec46e93811c552faabefbe9c0ca4c",
        "OpenScriptures-LexicalIndex:iou":
          "33946746893d9836e4ddd7017772204307badf13aaa2f45eb2a598c447aa90ac",
        "STEP-gloss-anchor:18281":
          "330be444694c364c2178e56a4e416f821f258ce1ffe6ab829ea539400c8b70d6"
      },
      occurrenceProof: {
        count: 17,
        occurrenceCorpusDigest:
          "4dcb9d001489c139904f64527ae345dae1526f6eb97d36dce26d185287f6831c"
      }
    },
    {
      key: "H5570H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 18505,
        eStrong: "H5570",
        dStrong: "H5570H = a Name of",
        uStrong: "H5574"
      },
      input: {
        rawHtmlDigest:
          "2e4384ae3d62d79d465806816639f74a11a6f386a34ab7b82ddb3512ce49ebe0",
        rawAssertionDigest:
          "8dcc022ef3b5cb0537ad4c634fbe3b902f158c957a35feb10df5a861f32e37c8",
        auditRecordDigest:
          "3fb9a893ac44c341551e9151bb73d68049c34922900d6838077128f2e2f3ab55",
        candidateRecordDigest:
          "9704c21286e43ae3f76604e69a798c65e233f9cbf7542f59483ab65f0545af1a",
        stepAnchorDigest:
          "d42a026bf086c8b8592e661ed5b90bbf5e76e67e51b44a7c60d27462986af7fa",
        firstAuditRecordDigest:
          "2210e95423afff52c8902659fb96d649e788cc75cd6e9b2ba7ebc664d9fbd35c"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "f67c54aefc6b0c4ad6f8c3df8e7a402d94433d2c5f2b7cffa407702956736bd3",
        reconstructionHtml:
          "<p><strong>Hassenaah/Senaah:</strong> a name associated with a returned family or clan. It appears with the article in Nehemiah 3:3 (“the sons of Hassenaah”); related spellings occur in Ezra 2:35, Nehemiah 7:38 and 11:9, and 1 Chronicles 9:7. The 1 Chronicles context is Benjaminite, not Levitical.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:18505":
          "d42a026bf086c8b8592e661ed5b90bbf5e76e67e51b44a7c60d27462986af7fa",
        "STEPBible-TIPNR:H5570H:entity:1102":
          "dabe9c27e78ee28261f0c32b2a22ee72310407875053edaa9bf438a30d4128f3"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "340bd08fe35cb27e19b6aed9d055885f9313a4368c499751f210ba37b305b91c"
      }
    },
    {
      key: "H5571",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 18506,
        eStrong: "H5571",
        dStrong: "H5571 =",
        uStrong: "H5571"
      },
      input: {
        rawHtmlDigest:
          "85e2040fe2880a0b8d6e0be66cee35db028bfe31737e379514ed48deeacb8b89",
        rawAssertionDigest:
          "2f64eb59d1b6da9b0b4cc81dab2fd9b590f0bcf15d3399c59db93d54544975ed",
        auditRecordDigest:
          "5b11009dddcb5e1b72ea6de46b0455f353b5ac4b0d20013157e55195e2ec087e",
        candidateRecordDigest:
          "879399c0701b606d018a8c68eaa29db42cd96e11a5cfc1741eca45c50a1e53b7",
        stepAnchorDigest:
          "15681181472227b841de86e7fb81a2e119df284f1df0127c2982788d94991ad3",
        firstAuditRecordDigest:
          "69f7a890022648e99d2d66cbe0e2a5baea396c9f0003d9111fe986ce69714160"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "43268e28bda990246ffc8b42016d749b76088450ab6a2522e51481e5f6595040",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:o.bw.ae":
          "2608aa62601e2a6dc623ffb6209d907838e31064b73057bff4ec33ebf018dab3",
        "OpenScriptures-HebrewStrong:H5571":
          "129b3fb345a2a8e15887df2390791f8f152863f929fc6e490ac59132a79f69f0",
        "OpenScriptures-LexicalIndex:ivt":
          "7cc8e5e1948a569317ca53d53264a568f9b3909118f5d569aa7520dadaa16b75",
        "STEP-gloss-anchor:18506":
          "15681181472227b841de86e7fb81a2e119df284f1df0127c2982788d94991ad3"
      },
      occurrenceProof: {
        count: 10,
        occurrenceCorpusDigest:
          "49aa9082765c6dc2b28a74ed985d34e38b21ae2e07f508a9b9efe945ed4d42e3"
      }
    },
    {
      key: "H5718O",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 18722,
        eStrong: "H5718",
        dStrong: "H5718O = a Name of",
        uStrong: "H5714K"
      },
      input: {
        rawHtmlDigest:
          "6c24e1229780e3cf92e3870ab51f996225194909466f393091f5639b7190d97c",
        rawAssertionDigest:
          "1b66e40fcdd7fb0b0ffbd2316b48d8260171cce745f2fbef6ef4dc9a24ac8a57",
        auditRecordDigest:
          "2b767d2eadffcef026ab7a3f5572799fb6af7fb7d1e76bce27ded85747854984",
        candidateRecordDigest:
          "561cece51a1aa5686a05c0bd19e29d0036a40555955f236ca1eaecac20fbdaa9",
        stepAnchorDigest:
          "42de7f8888a3fba943df359573e6da93e710a3216ab1de5d4a673639ce5c5324",
        firstAuditRecordDigest:
          "8cc74e82ee71c6ded395ef6b52e8122ae8b86bbd504cc23d9f79e6ecf606e4cd"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "dc1b42d4a334da6dcb1b17457d0378fce43c2400968e4dfe1354fd3c31ba98dc",
        reconstructionHtml:
          "<p><strong>Adaia:</strong> the Ketiv in Nehemiah 12:16 where the Qere reads Iddo. This is a spelling or reading variant associated with the priestly family Iddo, not the Adaiah form עֲדָיָהוּ used in the raw notice.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:18722":
          "42de7f8888a3fba943df359573e6da93e710a3216ab1de5d4a673639ce5c5324",
        "STEPBible-TIPNR:H5718O:entity:1253":
          "5b8fbd5602ab95bf1f8ce0df888daa5e46cfab6f02d15dafc23ae6bdad1a4311"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "f374dba99ce5bdb5ee0a190190ae1ca081ae4cadbcde72e0d21b31869a6995d8"
      }
    },
    {
      key: "H5757",
      counterAudit: "raw",
      identity: {
        stepEntryId: 18777,
        eStrong: "H5757",
        dStrong: "H5757 = a Spelling of",
        uStrong: "H5755"
      },
      input: {
        rawHtmlDigest:
          "8e86a66fb2af5e425b9e1dd5e13012ab886292d76d0067c1f07ac5c49789f79b",
        rawAssertionDigest:
          "51536e95346b81a9c86ff9bda436fde3486968f3eb4f267d3ddfc0c7ea766b04",
        auditRecordDigest:
          "ccbe00e543598e61664d6d68864019c8e6b76b6d2833f5356e7f1f62ce6289d2",
        candidateRecordDigest:
          "42891dd3060abdf346d35e56ae4a19fce6f19d7d40462bd191ff849a174930d4",
        stepAnchorDigest:
          "9c89eb89c5a4b3e302e9b4b00057f4176b1a5b176b5327cd17198b0f2e6dbb8a",
        firstAuditRecordDigest:
          "0c6cf1e61b3b60b0167b473ce6bb3b43d0b713af3cd4ca0bbd7431b4ce3173bc"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "8e86a66fb2af5e425b9e1dd5e13012ab886292d76d0067c1f07ac5c49789f79b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H5755":
          "2e3f9e3ca0d49ab0588d0abc61b0fc16220fb5e91ae53a06b50f9fec0a0ca44c",
        "OpenScriptures-HebrewStrong:H5757":
          "e75d28a3f0ac353e9ca6344e373b0c7ff091afca0811cf738c4e92acf8e71070",
        "OpenScriptures-LexicalIndex:jdt":
          "8fb8c06d0a4dcc923dcf6230f6c0918474d2bd3b887db46ae0d71c714658b76c",
        "STEP-gloss-anchor:18777":
          "9c89eb89c5a4b3e302e9b4b00057f4176b1a5b176b5327cd17198b0f2e6dbb8a"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "a88a1c2a0ed3a27957eeacfacf3c7bf1722ffc7ec6095fb2a2fd80b526f52eb4"
      }
    },
    {
      key: "H5800G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 18841,
        eStrong: "H5800a",
        dStrong: "H5800G = a Name of",
        uStrong: "H3389"
      },
      input: {
        rawHtmlDigest:
          "d960f21f3976110ba17483a6454948911b78d372b5311d02ac84d7d8df25f64e",
        rawAssertionDigest:
          "a38f0d5f0b24fc14fe51b925a3a2c3ea88a0c5a981a420a5ece9053b88800b3d",
        auditRecordDigest:
          "f7dccbe202a1f2a446e65537cd2abd575514f148de4466ac173cef7fe30a5ff2",
        candidateRecordDigest:
          "8aecaf54a63fc4c38e1058ac3202ce4e9b1649348fd3da70dc2a37c9a53ae823",
        stepAnchorDigest:
          "f9c894754efbc59ed509e9b67cb3292c54fc73d43e75b9f5e2d6ff7f98c38dfc",
        firstAuditRecordDigest:
          "63b5f82a2913e4e19893f5a64e4d145331deff727b756b3e34e3ad963abf1556"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "55febf5415fd27e68614ce48c00441a5fc7ee79bd69e139622faed144c7730d4",
        reconstructionHtml:
          "<p><strong>Forsaken/Deserted:</strong> a symbolic name applied to Jerusalem in Isaiah 62:4; it reflects עָזַב (“to forsake”), not “to restore” or “repair.”</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:18841":
          "f9c894754efbc59ed509e9b67cb3292c54fc73d43e75b9f5e2d6ff7f98c38dfc",
        "STEPBible-TIPNR:H5800G:entity:3661":
          "0913a2b026ff8fd6100d49c6f4651946cc32d2bdb6fd3acc7a4d053509a259a9"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "cf5648434bb55404650879605b768614b214cf265ca776bfe6d88881e997817f"
      }
    },
    {
      key: "H5886",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19020,
        eStrong: "H5886",
        dStrong: "H5886 = combination of",
        uStrong: "H8577B (H5869B+H8577B)"
      },
      input: {
        rawHtmlDigest:
          "24bf253fd3d83624a9f40b6aa33ef5aaa224f59f9cb5f6b367d61fc12fa11ae2",
        rawAssertionDigest:
          "fb422c89f1bf7900d5359e0b1b9cb19e3e5dad223c537964312d9847973e1866",
        auditRecordDigest:
          "4657479b78c4492b4eb6c50c5a109a31affcea17ff7504d3acc0d084d908d805",
        candidateRecordDigest:
          "2edfa27003a4a0ca9d6bf32ec3f89c31b9d519ef7009ed26015dc87d71c19f56",
        stepAnchorDigest:
          "73b56a1f645d6538223018cd9d4bd029394062d57dbc2665e5da90061643c4dd",
        firstAuditRecordDigest:
          "99d0be582820adf3df4ac7d9b8a8e72c066d2371007990317cdeec94168fcaef"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "24bf253fd3d83624a9f40b6aa33ef5aaa224f59f9cb5f6b367d61fc12fa11ae2",
        reason:
          "Counter-audit retained STEP's fountain of jackals notice because OpenScriptures and TAHOT attest it alongside the alternative Dragon Spring translation."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19020":
          "73b56a1f645d6538223018cd9d4bd029394062d57dbc2665e5da90061643c4dd",
        "STEPBible-TIPNR:H5886:entity:3402":
          "3d2a9c40f93c0f472206427918457236e76a65c9c87e7bfcb2e73fc56ed7100c"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "47c01df2317dcb4f9281578bb930e0e77c73591104bfe5b114c308a2e2d73c13"
      }
    },
    {
      key: "H5892H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 19032,
        eStrong: "H5892b",
        dStrong: "H5892H =",
        uStrong: "H5892H"
      },
      input: {
        rawHtmlDigest:
          "ad6a11b1cc3604261c9be3da83bc3870a1af520089257d28c16845281f400e92",
        rawAssertionDigest:
          "ea3b96a4e858916d042453e2c7d5152a7f4e92a1c77f14565896ae14aaac4c8a",
        auditRecordDigest:
          "5d3ca5763a64b507a1e69b1facb19329c3b7277b4830a65d151cb49bd112f563",
        candidateRecordDigest:
          "030a6a7fa51a11ce68b1ce511a1a5811ae137d10c37e338d866f30985b34b340",
        stepAnchorDigest:
          "a2da78dcc4ac4f26e93ec3152a22b409c680f629b356a6f52a6c1fbb0b84e7bf",
        firstAuditRecordDigest:
          "5160950427042522d41b516799b56cc277aa218dbae2717c8a9e1f5264bfd045"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "9307e6437703bf9ba50291dee96b9e7e7a69a590d2c4fbfbacd3dd8b74a6e4de",
        reconstructionHtml:
          "<p><strong>Ir-:</strong> “city of,” the first element of Ir-nahash in 1 Chronicles 4:12; it combines with H5176K.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19032":
          "a2da78dcc4ac4f26e93ec3152a22b409c680f629b356a6f52a6c1fbb0b84e7bf",
        "STEPBible-TIPNR:H5892H:entity:3629":
          "ea041eb05c4ec16a30a90fdb95516f202ece0ed8cba549897fb86f8a228650f2"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "39bb3b7412f5bcebb8a60f3250ac578b62875578ca63f1ec5f7a5415b074124b"
      }
    },
    {
      key: "H5920G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19065,
        eStrong: "H5920",
        dStrong: "H5920G = in Hebrew of",
        uStrong: "H3068G"
      },
      input: {
        rawHtmlDigest:
          "8ac54f90ebf98ba09cd5efccf8463376d7e72ceab042c515acaf022911526d4c",
        rawAssertionDigest:
          "32f91ce38beea5b1ab8e9c612ec167f84cff6d28f8bdb0c6818cec85ce7065ad",
        auditRecordDigest:
          "eec2367d30aff40cd9be3b03418eb3f72c0554b40eac6f87ccb70d23496b341e",
        candidateRecordDigest:
          "cdc2c9211024f67ffdd359e5caa1cfc7f1e178d979bd99b4d4c15e5a358477f9",
        stepAnchorDigest:
          "33b33919595337bd74045dc1d1a6d016bce183276ce0c083d39acc380054de92",
        firstAuditRecordDigest:
          "f5b627aefcc53ec95121663d7e503cf05916cd5ed4604f708543ceec225f49f3"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "8ac54f90ebf98ba09cd5efccf8463376d7e72ceab042c515acaf022911526d4c",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19065":
          "33b33919595337bd74045dc1d1a6d016bce183276ce0c083d39acc380054de92",
        "STEPBible-TIPNR:H5920G:entity:4174":
          "40dfda59358db935f34aa02050182b5fcd35a81bcec5dd77cdfbd649288cbf0d"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "07967aa35273a1cac777991afb251f1bb2392dc183d5d0a3e29d7cbedc8fb211"
      }
    },
    {
      key: "H5921B",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19068,
        eStrong: "H5921b",
        dStrong: "H5921B = a Meaning of",
        uStrong: "H3588A"
      },
      input: {
        rawHtmlDigest:
          "97f4af9c195466ba29ece902a360ed5792e902b93b4848301d26ffbef0390785",
        rawAssertionDigest:
          "679c28e72e2ea67fa4ef4a2570115c3646bb8f5101a866bfb85a8f67c2bf072a",
        auditRecordDigest:
          "c37a44a1dbacebcb2ab3aae6e426c5abc3eb4533e29719626ba34b5c1d428aa6",
        candidateRecordDigest:
          "096529c9e486f6dd22cf7ce533316d4caa2a5f9f6aab1b65af2328e2ee5c7b29",
        stepAnchorDigest:
          "8ae72b73e17d44a40bef26de500a2a192e818a6aab418baa3520a1dba6d9a811",
        firstAuditRecordDigest:
          "3d644a510b9a864f0261b9cb6b24aab32c5e0122673d13b353b46108e783337b"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "97f4af9c195466ba29ece902a360ed5792e902b93b4848301d26ffbef0390785",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      key: "H5922",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19069,
        eStrong: "H5922",
        dStrong: "H5922 = in Aramaic of",
        uStrong: "H5921A"
      },
      input: {
        rawHtmlDigest:
          "e42a5ce21dea0ed1f1de341c78efb1411766d8624326e276e74691efd1b5b95c",
        rawAssertionDigest:
          "bc3e3374892137244110df4751f0a3bb2743be015e21753d72716fcfa49c10a7",
        auditRecordDigest:
          "209b043fae7fb74e580dffa14e081f6b0600b204f424cf8f65fa3c9bc08fc122",
        candidateRecordDigest:
          "885344bccdea5277d8596f5ae350c0e7ac7093f5fcc47117a7590a5067ffce6e",
        stepAnchorDigest:
          "9a5a5e24deb3c3936717864eb65f646e30f2ea2656a6a27e15f90584bd1bd4bd",
        firstAuditRecordDigest:
          "a7f204ecde0152b8b32fb7d9bc9e1904ef80dd65bcd4951312ccb0113ac85354"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "e42a5ce21dea0ed1f1de341c78efb1411766d8624326e276e74691efd1b5b95c",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H5921a":
          "2713bb2c456cbb020020a811db01f0a1ad4450c3970ccd2c6cbd444b9e434d95",
        "OpenScriptures-BrownDriverBriggs:p.cs.ar":
          "1e951fa42d73b347a9c0297bd0df8b609ae3141b84980eed229a5c676815a713",
        "OpenScriptures-BrownDriverBriggs:xp.af.aa":
          "3c6e2eb346113f0ea24deeb589e469eb78ed42b2bd8ae27f2402a25503b54166",
        "OpenScriptures-HebrewStrong:H5922":
          "0cbc1ae0daec364ed8475e10cb1ca76daa09bc8870b410a6d75447eac351fa69",
        "OpenScriptures-LexicalIndex:jkq":
          "7d34325d91e1cfd9668c001dfb41ced6cb7ce13c39b4643024f18dd6dc8b8adc",
        "OpenScriptures-LexicalIndex:otg":
          "d93fe09ebd81e71638589b04987e126d8622aaefd761cf0c3c5edc43177c1707",
        "STEP-gloss-anchor:19069":
          "9a5a5e24deb3c3936717864eb65f646e30f2ea2656a6a27e15f90584bd1bd4bd",
        "STEP-relation-graph:19067":
          "eb6108447f9ce80e06d85d544c0cb30625413263c92fe4b768d69864738dee90",
        "STEP-relation-graph:19069":
          "d52d5330a415d290068d349ef40a04d7f6b60ae581e78b4ba1306c4a1f59b161"
      },
      occurrenceProof: {
        count: 104,
        occurrenceCorpusDigest:
          "2b20e5587f99a00af3d43a1e45960c1b3c556a2398f52e5ebe88a61478bbf06b"
      }
    },
    {
      key: "H5931",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19085,
        eStrong: "H5931",
        dStrong: "H5931 = in Aramaic of",
        uStrong: "H5927G"
      },
      input: {
        rawHtmlDigest:
          "a5f2bb44f3d6254dd99bf9605ae78672535eff250ca5878b8203b6d398cd7fe7",
        rawAssertionDigest:
          "e46ec06d477cc13862db43b465921e1c3a648c631df3253ec7cd39f97d9c7bf1",
        auditRecordDigest:
          "dcbabfb39f3f62283827aa79166367551928ab609d674271fa0dd3610cb61861",
        candidateRecordDigest:
          "758a779bed8ee45b76a0db1379acab966b1a0c3b945a67e5706f6df272fb9125",
        stepAnchorDigest:
          "6977a33b5bf04e2a06a1d692f57b4dc67b48f6bd523fdfd45f2bf6f9f405afd3",
        firstAuditRecordDigest:
          "efb459bd3b4ebefa628cded092581c6e2184461f9acd356c5b685a8c032016fd"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a5f2bb44f3d6254dd99bf9605ae78672535eff250ca5878b8203b6d398cd7fe7",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xp.af.ac":
          "ad18662e909f39eb32618aa8f841906e947073c93a851bbb14a6be509d1abc70",
        "OpenScriptures-HebrewStrong:H5931":
          "4f8db2e8087e1bccc37d92806acc8aa311eba2e9df7d3bed68e048228f9c7d0c",
        "OpenScriptures-LexicalIndex:oti":
          "8889d50776f546f5594e628189ab2c4caf07f7032be8f6330e991307e7d7d987",
        "STEP-gloss-anchor:19085":
          "6977a33b5bf04e2a06a1d692f57b4dc67b48f6bd523fdfd45f2bf6f9f405afd3"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "fc11ca8c15d487ab4536f83127183172c56353c476f4d351b5d4fbb68ed549f3"
      }
    },
    {
      key: "H5945B",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19100,
        eStrong: "H5945b",
        dStrong: "H5945B = in Hebrew of",
        uStrong: "H3068G"
      },
      input: {
        rawHtmlDigest:
          "8ac54f90ebf98ba09cd5efccf8463376d7e72ceab042c515acaf022911526d4c",
        rawAssertionDigest:
          "32f91ce38beea5b1ab8e9c612ec167f84cff6d28f8bdb0c6818cec85ce7065ad",
        auditRecordDigest:
          "0269ba1d242a48a3a49815f206bda4164886b953b40059dce5a61dea2464a623",
        candidateRecordDigest:
          "05926a1decefea77c809aca2bd64e715d88b518451ef5bc5c852afca1c2ef973",
        stepAnchorDigest:
          "3f691186f1bef87357131c4e97be5a5eb549337439dd39c1ab381773a53bd346",
        firstAuditRecordDigest:
          "19abb7bf871628b78ead2f1f8d10df041ef1bf3a3a7c93feac36f7901f6814d1"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "8ac54f90ebf98ba09cd5efccf8463376d7e72ceab042c515acaf022911526d4c",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19100":
          "3f691186f1bef87357131c4e97be5a5eb549337439dd39c1ab381773a53bd346",
        "STEPBible-TIPNR:H5945B:entity:4174":
          "e34761a3ee39deb09abd89ee9c36d68c7824639090c9ea38dd94a33008581f09"
      },
      occurrenceProof: {
        count: 25,
        occurrenceCorpusDigest:
          "5878df29a7a4887d95c0403f48d5848d0b9845b0edd2c23a63e3ebc4c975ee93"
      }
    },
    {
      key: "H5946",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19103,
        eStrong: "H5946",
        dStrong: "H5946 = in Aramaic of",
        uStrong: "H3068G"
      },
      input: {
        rawHtmlDigest:
          "e4d3c2926ba9727176174e74b25d948b5463496dfb1bf226a79f1350309003ac",
        rawAssertionDigest:
          "bd24978ef3a8f74c770cb4b967be35422d323377329c086566f1794985153bfd",
        auditRecordDigest:
          "f99fcc6606733f7b2a3ece4d3c5ab5283b1ec5215c0fa51ed71c5bfb3ca92d46",
        candidateRecordDigest:
          "242e3f628d0cbf9a10547f5a361e767a4519368cf583f670b029c0227660432c",
        stepAnchorDigest:
          "053d80d567b9b0cd8c9cecbf1eeaafc2d644e8fb8612d5f66b4b4129d30278a8",
        firstAuditRecordDigest:
          "146c31fb2d94d1b4f8e65d03472ed3ba924d435fc3955bddd5da551b2874fd79"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "e4d3c2926ba9727176174e74b25d948b5463496dfb1bf226a79f1350309003ac",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19103":
          "053d80d567b9b0cd8c9cecbf1eeaafc2d644e8fb8612d5f66b4b4129d30278a8",
        "STEPBible-TIPNR:H5946:entity:4174":
          "d4041f390f3328a9b9bdf885e0993e282ee3a6195fdc90a7a762d614668d0025"
      },
      occurrenceProof: {
        count: 4,
        occurrenceCorpusDigest:
          "ecd990cf5976c365ed89e110c115c1cb2f343989c1b156ed22ad6e3632d6df3b"
      }
    },
    {
      key: "H5971H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 19136,
        eStrong: "H5971a",
        dStrong: "H5971H =",
        uStrong: "H5971H"
      },
      input: {
        rawHtmlDigest:
          "d5108e4612e8b4f84b7fe2eb56cf7096cb3f99b95731a06c87dde76d59117907",
        rawAssertionDigest:
          "e34a6eaff4d9025a9aa0c5cc72175d602a4480b3fd86b40f898b5a4efc272ec7",
        auditRecordDigest:
          "4dec157abcbe5aa0191c2e38218b94757d6fdaae41fe04c937002b064a6e0aa9",
        candidateRecordDigest:
          "75961bf54fea83b8e80007eb1c53282c9c8f5ae235181a43f0acfe330c803ce2",
        stepAnchorDigest:
          "1bd24572ec4864696d3c9e6f253b3b778c760a6139dca15ba5dcf964ae143aba",
        firstAuditRecordDigest:
          "395df82994e2678381c27327d44540f32ac6ffdb2c382e136349dc74e83b5b3c"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "74b41ae1cfb81427afc8ca675af4f9555f28cc0a8eb99de2cb03195367df63f8",
        reconstructionHtml:
          "<p><strong>People’s Gate:</strong> the “people” element in the gate name in Jeremiah 17:19 (literally, “Gate of the Sons of the People”).</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19136":
          "1bd24572ec4864696d3c9e6f253b3b778c760a6139dca15ba5dcf964ae143aba",
        "STEPBible-TIPNR:H5971H:entity:3870":
          "118c9279eb1e37f59696fcafb4590935134ff15e26ea461fc7452743da2a5200"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "44a6fd4c145b769068d69c536fea57986e868dde78f7e2962a2a56d7b0ce9353"
      }
    },
    {
      key: "H5971J",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19138,
        eStrong: "H5971a",
        dStrong: "H5971J =",
        uStrong: "H5971J"
      },
      input: {
        rawHtmlDigest:
          "08c007820178c5ae44a07a2fb526ded64b3444f1b2948fc2fe7028aa0c775629",
        rawAssertionDigest:
          "00b68debc77bf85dea496e4226c8fb411ba0f7f83a5af74c2109872970d200fd",
        auditRecordDigest:
          "b47f0566db836eb607a7205b2d1e528cc3e2780a579e3f93f5c15ef9ea7b6690",
        candidateRecordDigest:
          "6cd501e9c17eb1a09be7e2ef51cd4a26e0f3ae4efa1df2376ddb651bf780f8ee",
        stepAnchorDigest:
          "36eb6a74d87d8f7d818bb018b84257b4fb344e7f28a265b287618d195659e408",
        firstAuditRecordDigest:
          "4a05814c8dbdddf6c0bf1150588ab32df8c9325766b981662b2b051f1efd83a3"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "08c007820178c5ae44a07a2fb526ded64b3444f1b2948fc2fe7028aa0c775629",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19138":
          "36eb6a74d87d8f7d818bb018b84257b4fb344e7f28a265b287618d195659e408",
        "STEPBible-TIPNR:H5971J:entity:3166":
          "734de2532b9d2c817711d6043deed7601311f8e0c939ffc0a1257574c58125e1"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "70dec8e05bbf636adb6244ed38c4fe6f950e9026d22e77b5cc2f2b96facbb270"
      }
    },
    {
      key: "H5978",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19151,
        eStrong: "H5978",
        dStrong: "H5978 = a form of",
        uStrong: "H5973A"
      },
      input: {
        rawHtmlDigest:
          "7dcca214d9892a49d7ef2f32bbe0520beb1f92a5dc00c38289009521246988ae",
        rawAssertionDigest:
          "d76363385999ec139d97013d1bd675d0a9e7e1b4697e276691f47c23ea788c43",
        auditRecordDigest:
          "f7221a5ec48e6913ba9ea2b59f5e5c829dc6a81c2506bbddafad7c3cc8aa5d9e",
        candidateRecordDigest:
          "d812f42d90c2d811c9d7777e55d9065d3f9473a0d897bfd0cb4a7cf3b61f5b90",
        stepAnchorDigest:
          "519c326969249ff8ddfcf641b7b7bc97f934cd85e09eca96deb379fdc7616b46",
        firstAuditRecordDigest:
          "497641064ea4b3fbea6bafe40ca27f2ace98d0972ff5cea4e1316b860d6f655a"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "7dcca214d9892a49d7ef2f32bbe0520beb1f92a5dc00c38289009521246988ae",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H5978":
          "cdc9cf82eae65b054ae45e63888f26d34b0cfbcf1c70129d4979cb3de0a5d6fe",
        "OpenScriptures-LexicalIndex:jmr":
          "5a5d41867d1dbd2faaa12c2f9aad975437077cd34a2d4e6ff62b3cc8ca83c172",
        "STEP-gloss-anchor:19151":
          "519c326969249ff8ddfcf641b7b7bc97f934cd85e09eca96deb379fdc7616b46"
      },
      occurrenceProof: {
        count: 42,
        occurrenceCorpusDigest:
          "0956de1a795fb65395be8be48a68b86b2f0541d67969feb047316331faefa056"
      }
    },
    {
      key: "H5985",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19160,
        eStrong: "H5985",
        dStrong: "H5985 = a group of",
        uStrong: "H5983"
      },
      input: {
        rawHtmlDigest:
          "fb857e34ab66f1ef5ef6eed6b6d293e126dff7d61d383306e01c255be840b074",
        rawAssertionDigest:
          "50f0e752c01965d1e769a6f337fa47d8157eb8303d16b7aa32a8b505fcb94447",
        auditRecordDigest:
          "82b90f7bd7c8ef93ac9e2844f3d6da5e46361aee48ca2e9a41ebd45b245ebf1b",
        candidateRecordDigest:
          "d4e08841f2ac3c8ccc04cf5c5a66d41bed8969467787ed073139c42fa9847c03",
        stepAnchorDigest:
          "5a7a188024b5e69dfcd61f54ca9fd5304f45e3741c2bd640149acff03e72a669",
        firstAuditRecordDigest:
          "e54f28888966817f6830f55711d2fe8be2323bd561c565c3c8d0d41dc1244e3c"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "fb857e34ab66f1ef5ef6eed6b6d293e126dff7d61d383306e01c255be840b074",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19160":
          "5a7a188024b5e69dfcd61f54ca9fd5304f45e3741c2bd640149acff03e72a669",
        "STEPBible-TIPNR:H5985:entity:3168":
          "31e98a0861f4b01d883e4fbbb04cc13764a84ffe9047e17d146d9d601376143c"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "6c10b6e57ce13bc15f0e1baa1c11fe288f68993cdb6299f844cb92a647d5884f"
      }
    },
    {
      key: "H5993",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19177,
        eStrong: "H5993",
        dStrong: "H5993 = a Name of",
        uStrong: "H5971G"
      },
      input: {
        rawHtmlDigest:
          "4cec2dccae8495f9440e31cb32fc2698090d1a1653c50da819e40d6a27df56e8",
        rawAssertionDigest:
          "f732927c5a00d01a33d2ee05bd2a601e354cbd5736df463a3f83c64083c8d95d",
        auditRecordDigest:
          "ce7cee8d06a0fb10b063c4d56175b74ad9f480485e77498f55036167596577fc",
        candidateRecordDigest:
          "8d086c8a0869ed7695a80da44392275a0a89c9de29de72b9f8e9363c1bf994fb",
        stepAnchorDigest:
          "e3a5ac997d4b01267a0af96fb090d33f33b6211603fb40ef36aa164d2ffa34b5",
        firstAuditRecordDigest:
          "0f8de11e8ac6740e82a5315c9fbba73d16b13ba05edd23559b91a908b53544c3"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "4cec2dccae8495f9440e31cb32fc2698090d1a1653c50da819e40d6a27df56e8",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19177":
          "e3a5ac997d4b01267a0af96fb090d33f33b6211603fb40ef36aa164d2ffa34b5",
        "STEPBible-TIPNR:H5993:entity:222":
          "1d0e94ce911bf1d569e68aa7ea842486830b6ffbbfdbe0651b23836a8aff18c4"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "d71f873f1757e0b5c4b1885edc14fbcb69088b1fdc2df503b8b6f2bb31984aaf"
      }
    },
    {
      key: "H6010J",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19199,
        eStrong: "H6010",
        dStrong: "H6010J =",
        uStrong: "H6010J"
      },
      input: {
        rawHtmlDigest:
          "1886d8d2731ec02aba7c4dbed875f6767351e92bbddff2f08545f784ad17fadf",
        rawAssertionDigest:
          "528c1bd6db3a8612671d7d3e7aba1253ead1a59317d995a196876d67f7f6ba1d",
        auditRecordDigest:
          "a3ff66c947e3637031b0ad4eea77a37ffa5e523a2378cc5c6092bbbf48baca47",
        candidateRecordDigest:
          "a1cae523f3e423084037e2e66c9e42b9582e12154e89dbf931b7bd052cf6a040",
        stepAnchorDigest:
          "07c5669c40e821a04605c41659c58f8ed6a2d162686999ff07093772d27eed0d",
        firstAuditRecordDigest:
          "04a53a9d5c00f4eced73c634d05cafcbf9feae96e9f47405a6deb8f92d950404"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "1886d8d2731ec02aba7c4dbed875f6767351e92bbddff2f08545f784ad17fadf",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19199":
          "07c5669c40e821a04605c41659c58f8ed6a2d162686999ff07093772d27eed0d",
        "STEPBible-TIPNR:H6010J:entity:3437":
          "f74703b24b6c2bebfce146bd94593b796e068d48d5d35790da147a27db394135"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "18903642e58f972003aa5ba639d0158267294437df7e208d76cb7a6693e344d3"
      }
    },
    {
      key: "H6033",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 19243,
        eStrong: "H6033",
        dStrong: "H6033 = in Aramaic of",
        uStrong: "H6031B"
      },
      input: {
        rawHtmlDigest:
          "5f2a970d8d5cdafd6ef5b647df837a7c9b0fcf69abecb40c0cf9b8ce95c1c750",
        rawAssertionDigest:
          "cddebb43ee3d6cc1ae3c0709bd6cf55656e4a98c695981755c043b196bf0eee2",
        auditRecordDigest:
          "7eca4a4d4b3e79a56dfbcace4154328304c7c527e33c08493030ca892c4b34de",
        candidateRecordDigest:
          "081d2ea0bd545943bc9efccc4bd34f255538ed25febb0ff1e341dc9ca741ce21",
        stepAnchorDigest:
          "b9201498bf6d0830f26d4b58ca11c64e432d11645275555b643d4e6ae70e3551",
        firstAuditRecordDigest:
          "88e609c24131fd1c3b27843d9aaab0d9ddb377e10929f3e57286934edeb76a71"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "710f4c2a5ec0944e0404aa2d256df780bcd8173f8035b472f4a98301d60b8fda",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xp.aj.ab":
          "45472975ca9930f365c458b114882db3f91a468b80fcaa7cfaff788b1814e427",
        "OpenScriptures-HebrewStrong:H6033":
          "51857d8243c84b9aa3c2ecbe3e3d792dafd05d3146d8166acfb322446edfe886",
        "OpenScriptures-LexicalIndex:otz":
          "567bb26bee7585082b34d833b7e084bbb1aaded6e854e881e2da811a2a50e8e8",
        "STEP-gloss-anchor:19243":
          "b9201498bf6d0830f26d4b58ca11c64e432d11645275555b643d4e6ae70e3551"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "6fcd0dda5862c7d3a443d9e0763c4e7b28f966701bcb2428977ee500fc1f1217"
      }
    },
    {
      key: "H6034G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 19244,
        eStrong: "H6034",
        dStrong: "H6034G =",
        uStrong: "H6034G"
      },
      input: {
        rawHtmlDigest:
          "50ca799cd55345ca79ff80378d3777a1709993a91df9a1402c395377fc9947b3",
        rawAssertionDigest:
          "0a9322a5f29dfa1b33e5cbd689a846dd5fff139504b4e9dcfbb767aafbfc5103",
        auditRecordDigest:
          "bc22b674aab4e48ad5eb42e3a5e22d7761fcd3dbc008c5262e061a65b1f093bb",
        candidateRecordDigest:
          "6e91eeadc2ceb1876c1b98ecc7ca1622985721b6d86a3b521dd5a6b3e67b36f3",
        stepAnchorDigest:
          "b8fe81cf5f0b21e27e9b4dfbd6f681b238fa69cfce3a55321f66b1f4fbcdc062",
        firstAuditRecordDigest:
          "f8a85ccef81e217bfe5c8bcf418a857b1b095d59c4af78de9e5679752768d21b"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "3f806f3be0d7c23811422c5acf3118c379cc93210131fbbcea1190e4de82a6cc",
        reconstructionHtml:
          "<p><strong>Anah:</strong> Oholibamah’s father, named in Genesis 36:2 and 14; the text does not identify Anah as Beeri’s wife. Current STEP merges this legacy sub-entry into H6034.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H6034":
          "036b3bf694a765132520a5e7da591bc66e9280cc5984dc37927fa537c77a9248",
        "OpenScriptures-LexicalIndex:jpa":
          "05b4a1a16b13df8fadb494239600f343f00dffbe3d45b0b15d4f281836d10148",
        "STEP-gloss-anchor:19244":
          "b8fe81cf5f0b21e27e9b4dfbd6f681b238fa69cfce3a55321f66b1f4fbcdc062"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "23f981821274a38a6e84e671d3d809e0e560dba92e11cd17e7f3c0948e7a3d8c"
      }
    },
    {
      key: "H6034H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 19245,
        eStrong: "H6034",
        dStrong: "H6034H =",
        uStrong: "H6034H"
      },
      input: {
        rawHtmlDigest:
          "d4d25f16fd72270c78a856712448e8b84b21aee2c0c2e1103a58d76327da0bd1",
        rawAssertionDigest:
          "eeccdc682ec212feac486eaebe6613d28f9c0e263352e3739cb9c7cb0f9b7225",
        auditRecordDigest:
          "18b720d85432d0d30776e29a04b38b98213f44650cc8b6dad89b6ec69c565e63",
        candidateRecordDigest:
          "e175a1ee174ffa660cdd57dc43d61254085a878bd136effc6305d1a629d41942",
        stepAnchorDigest:
          "1a9b39bc118b5a49ad18ce407e6c562a1ba8a0a6adf61a9df0396df93114b410",
        firstAuditRecordDigest:
          "a133a3b952e40e1f56cac2ff836ed7caa2a5df86544d02e546579942a7101e05"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "5833d268b0f66ae61c56749e82e96413327b8f85a0f1f813e9b25fad6f0e3f5a",
        reconstructionHtml:
          "<p><strong>Anah:</strong> a son of Seir and Horite chief in Genesis 36:20 and 29. Current STEP merges this legacy sub-entry into H6034.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H6034":
          "036b3bf694a765132520a5e7da591bc66e9280cc5984dc37927fa537c77a9248",
        "OpenScriptures-LexicalIndex:jpa":
          "05b4a1a16b13df8fadb494239600f343f00dffbe3d45b0b15d4f281836d10148",
        "STEP-gloss-anchor:19245":
          "1a9b39bc118b5a49ad18ce407e6c562a1ba8a0a6adf61a9df0396df93114b410"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "4800a9cf0343b53e7ea464f15e66e23f981444dc836076b04ca0375de1bdfce6"
      }
    },
    {
      key: "H6034I",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 19246,
        eStrong: "H6034",
        dStrong: "H6034I =",
        uStrong: "H6034I"
      },
      input: {
        rawHtmlDigest:
          "b335a7b0d5acaf5fab85059ea5d0fdb0fd27cb9bc782b668751479a2c1fb1c09",
        rawAssertionDigest:
          "a0ef006d5da9400fc00638c81a7f7c6164695a8dbf6e833d2fd0170ba50dbf16",
        auditRecordDigest:
          "e709a8358091c306289c9eb55375ef6ab0e591bc56ad38560c52dbebecccbeb4",
        candidateRecordDigest:
          "d9ef57863e8a6ad15b7d8db8b708b975b0703225a4288eccfa746cafa48f5758",
        stepAnchorDigest:
          "1a9b39bc118b5a49ad18ce407e6c562a1ba8a0a6adf61a9df0396df93114b410",
        firstAuditRecordDigest:
          "5eeed70fa6b152533ffa0ed12db454403fffc5d1e150f92eb2f373b430ec3489"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "fb0ce10d285d98ccf11467c833703bea70037c4aac0e85820380ab505f971a45",
        reconstructionHtml:
          "<p><strong>Anah:</strong> a son of Zibeon in Genesis 36:24, followed in verse 25 by Dishon and Oholibamah as Anah’s children. Current STEP merges this legacy sub-entry into H6034.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H6034":
          "036b3bf694a765132520a5e7da591bc66e9280cc5984dc37927fa537c77a9248",
        "OpenScriptures-LexicalIndex:jpa":
          "05b4a1a16b13df8fadb494239600f343f00dffbe3d45b0b15d4f281836d10148",
        "STEP-gloss-anchor:19246":
          "1a9b39bc118b5a49ad18ce407e6c562a1ba8a0a6adf61a9df0396df93114b410"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "4072cad2b471f3f976aa124b88443afa50e1967a241cb0b3540c1b6f38dcdaac"
      }
    },
    {
      key: "H6037",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19249,
        eStrong: "H6037",
        dStrong: "H6037 = a Spelling of",
        uStrong: "H6038"
      },
      input: {
        rawHtmlDigest:
          "838b5e57fb4b0bb5f60fb11089b97cdab6b6bcc0e5aec344b68f7c8d44f75272",
        rawAssertionDigest:
          "6afe87d4a5cad98b4dbf7e43b3f5c27e88c3d3228121badc5938189efdcca570",
        auditRecordDigest:
          "d51fc9f288f1c2ef13347d31a1fa5124647c640f7a6aaf79be19428f0ec9bfdb",
        candidateRecordDigest:
          "9b26a65fdd037cafced13240461e5c3aa7ea7e9655ed4e90a02cecd5b86f6b71",
        stepAnchorDigest:
          "66078f201aa651276a17f20f66b9a2b648e0006839a97ce56a804ac44882ab2e",
        firstAuditRecordDigest:
          "4db9787e4b7d8153b8823a9ef65d62d8f2700d8a6ce933aee7407536cd9a1855"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "838b5e57fb4b0bb5f60fb11089b97cdab6b6bcc0e5aec344b68f7c8d44f75272",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:p.dv.ac":
          "b6fefd766f21d260bbaba564ddf51b67f791decef54a07e5eda6800bcabea91c",
        "OpenScriptures-HebrewStrong:H6037":
          "acbb3efbc00d3f125d71a1fdb74a092cc6ceb9f0d1377dbc260c2106cec73c69",
        "OpenScriptures-HebrewStrong:H6038":
          "b203b4ab1e0de8b93c134ed304c5a78d8cf8a071736ea14842608d490bdf40bf",
        "OpenScriptures-LexicalIndex:jpi":
          "45119cdb431623dd6d7a9c10ca03ffd06dd8eb0c7be6208fa2f662283587f0d7",
        "OpenScriptures-LexicalIndex:jpj":
          "1cccd55f81cac35e9da1ba2c529bd0ffe73142d9d7513b88be2a54371cf560cd",
        "STEP-gloss-anchor:19249":
          "66078f201aa651276a17f20f66b9a2b648e0006839a97ce56a804ac44882ab2e",
        "STEP-relation-graph:19249":
          "ef184f65a026f1fbea35c77b28d56418a65e7e71b401c9f8dc2159a97b86e7a3",
        "STEP-relation-graph:19250":
          "d0455b85cbe1f5b08627dda06e6c619ddf2338cb4c9f39771637771d6fe83a0a"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "b4b0b4c8f0bd0c70c7b03d5560af3bb74fb7cc88691a61dd64582d7662205c5d"
      }
    },
    {
      key: "H6049G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19265,
        eStrong: "H6049b",
        dStrong: "H6049G =",
        uStrong: "H6049G"
      },
      input: {
        rawHtmlDigest:
          "fd9a5c07ed298fa4a6462b6fd5559ae424d7466a411c9c97016363e0266d8006",
        rawAssertionDigest:
          "e22a891f131406866ce6e3c2dd28849f1f9c5e0261bd588ace31a37fef09637d",
        auditRecordDigest:
          "070fad9d0d4b27a71af73b7a0344a429b34366fa5ca289107a74ab5c12f725c8",
        candidateRecordDigest:
          "2393d8807e78a7eeb7444eaaa254583dfd8ba22e70b206803dd1244ae0a51785",
        stepAnchorDigest:
          "14a94ac500dcfa2eee6d77a60ba738cea35b6b5139ec5b775929a62c762f2df1",
        firstAuditRecordDigest:
          "8c05082e25f653f00a69f2e0d5bb40545c3f3c5a24f97db418c5da90a027d82c"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "fd9a5c07ed298fa4a6462b6fd5559ae424d7466a411c9c97016363e0266d8006",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19265":
          "14a94ac500dcfa2eee6d77a60ba738cea35b6b5139ec5b775929a62c762f2df1",
        "STEPBible-TIPNR:H6049G:entity:3397":
          "bae51ac62415794019d483da1eb207943c467a29241b10725f0ea7ac27273a6a"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "b108631c88d065d84b28a7d6b3d1f1c1484bc20330e04b8e9107d3e8e09ce9e9"
      }
    },
    {
      key: "H6112G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19351,
        eStrong: "H6112",
        dStrong: "H6112G =",
        uStrong: "H6112G"
      },
      input: {
        rawHtmlDigest:
          "a11cc47acd923d4f1fa564cf62ee030c69019597ae9485f0d3eec92ef22604a1",
        rawAssertionDigest:
          "4888faf4af1728b87d0c6e333064b49f960c45b5a019e6389afbc9bf483e68ce",
        auditRecordDigest:
          "6fac5c20f0081501ae2a678b3ccbe470179e751d4f61b082d079021dde3ce1fb",
        candidateRecordDigest:
          "a0bdf73a8502e394d28b8adf06f60eb66996cd1e727fabf3075120f3b6088a2d",
        stepAnchorDigest:
          "e9d1c19e843d20c10b6af5b80d4b65aceb7a791f3402476833332e5dd8834e4d",
        firstAuditRecordDigest:
          "f0add129e94556c23aac670600db4927231d78c93f7ae38ee53a512e60285b0d"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a11cc47acd923d4f1fa564cf62ee030c69019597ae9485f0d3eec92ef22604a1",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19351":
          "e9d1c19e843d20c10b6af5b80d4b65aceb7a791f3402476833332e5dd8834e4d",
        "STEPBible-TIPNR:H6112G:entity:902":
          "6bab67821a602340353d070e37416bc8dd5caadcdcfeed5d326f91ef43f65c6c"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "a4325ac125362ac4149358bf7685f887d3d74e34fbdf77d3080d39250069bd23"
      }
    },
    {
      key: "H6132",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19377,
        eStrong: "H6132",
        dStrong: "H6132 = in Aramaic of",
        uStrong: "H6131A"
      },
      input: {
        rawHtmlDigest:
          "a561a59b85e39ec5d39a5a1a1c44bbd61078e5750743c5cd4592777c52b9531a",
        rawAssertionDigest:
          "7d081cc87d36a3e8f9dccec8c2a0cca5f1a755a1f73831d9edb581747df1f4dc",
        auditRecordDigest:
          "2dd1eea369ce15077fd33ffe28c1e13a1976464808fa137e3cea07d2f9646ff9",
        candidateRecordDigest:
          "3e48a3f3bde3c42d9b9135cfa50d11dabc71a6c169205a8bdb7d03f3fc8291de",
        stepAnchorDigest:
          "073c61f7c8a6d441edc60cbe5fe20ec9c1e5d9405ec86b68a4c53be39683e8b4",
        firstAuditRecordDigest:
          "0410fece458004ad702267546932c544123704285af4315c2d29307cf75cc0f5"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a561a59b85e39ec5d39a5a1a1c44bbd61078e5750743c5cd4592777c52b9531a",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xp.an.ab":
          "f6d05d4f4501086b0c73cc61e42ba81599fcc8fca4f79e05b927714188164e19",
        "OpenScriptures-HebrewStrong:H6132":
          "1169211622aafe7abaca4a66cb57cf5d1f6e0ca9b6a66463713f91e598ffb326",
        "OpenScriptures-LexicalIndex:oug":
          "5e780b090d166986c6576e086bbbe05e544d55e6fee2cf7d2febfc56ef98e8fa",
        "STEP-gloss-anchor:19377":
          "073c61f7c8a6d441edc60cbe5fe20ec9c1e5d9405ec86b68a4c53be39683e8b4"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "4bb96e6526186953fd64d7b88326b7870c60525b80f11aaa2c3543610e1a2504"
      }
    },
    {
      key: "H6160L",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19415,
        eStrong: "H6160",
        dStrong: "H6160L =",
        uStrong: "H6160L"
      },
      input: {
        rawHtmlDigest:
          "d89ede379a504cd0989767f76f74e4d93fbe86b4779a83471a26e65a65450cdb",
        rawAssertionDigest:
          "0f24586f8fa66438746a41f2f758897b1c0053e35dc4da4cc6bc7044a42a09b0",
        auditRecordDigest:
          "0b629528232f035fcb493f3c72b3c5dddbd9759f72781db220972ad03d46dda0",
        candidateRecordDigest:
          "b483fde1bdf629f8a68b0ca5419a170d2b55e28ba1168cb7c9da516e7ef0cfee",
        stepAnchorDigest:
          "3df35d29a5480694e9365e127d148b39209126c078bf96a1123114849df7f2a1",
        firstAuditRecordDigest:
          "161fa972daa6dbf08669000bdea83457e2db110bf0a1a85f1cf1bbf416ca9cb8"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "d89ede379a504cd0989767f76f74e4d93fbe86b4779a83471a26e65a65450cdb",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H6160":
          "554939e09c3ea387551d1868b4ca1a49f2df7d80da969e71bf6309ae46efee40",
        "OpenScriptures-LexicalIndex:juz":
          "9c0672fffa9e0e498bac25c4bded834acbdc32ba4b705b422d34b927d391dcc3",
        "STEP-gloss-anchor:19415":
          "3df35d29a5480694e9365e127d148b39209126c078bf96a1123114849df7f2a1"
      },
      occurrenceProof: {
        count: 20,
        occurrenceCorpusDigest:
          "58ea70a0d3720e53373c4a5ad2a1fbf03415353c6dff472b7322c710da67e13a"
      }
    },
    {
      key: "H6190G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 19450,
        eStrong: "H6190",
        dStrong: "H6190G = a Part of",
        uStrong: "H1537G"
      },
      input: {
        rawHtmlDigest:
          "e953f814236cae139657e99879ad71cc95eb271304e7a6865e675cd85ac3be97",
        rawAssertionDigest:
          "90d67c1b5746db463f0e0adf6e589be06bbf2f87ab809defac426e67309eaa87",
        auditRecordDigest:
          "830a45bfbc65fe90608ea008497ee8f648abc5aa45c2b773201759f524ef467d",
        candidateRecordDigest:
          "9310535b6422e55c2a02385619057c0b1e0cb2ceaff9aba6486f1fbe6eaa9341",
        stepAnchorDigest:
          "4ed37c1dd6fe2b53196ce9ebde3654a69cbcdff365c75dba29b203c5cdb961bf",
        firstAuditRecordDigest:
          "308e8ef194415c23b9e012a523dfd71b40fcd6df0a8a49c054098b765d873b1c"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "34db70a020e2113ffaba31dcd8bfa90a19aeed12054776e05cee779e2e08b5fc",
        reconstructionHtml:
          "<p><strong>-haaraloth:</strong> “of the foreskins,” the second element of Gibeath-haaraloth in Joshua 5:3; it combines with H1389H.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19450":
          "4ed37c1dd6fe2b53196ce9ebde3654a69cbcdff365c75dba29b203c5cdb961bf",
        "STEPBible-TIPNR:H6190G:entity:3521":
          "eb66529a7fc7ada7bf3dff458dbc6fed46f940c68771cb89274733b32b92d577"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "c1e24dd2662adbfeaa0fe94e5e1994319a320aef48b75987ebd77e4be95098d1"
      }
    },
    {
      key: "H6317",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 19616,
        eStrong: "H6317",
        dStrong: "H6317 =",
        uStrong: "H6317"
      },
      input: {
        rawHtmlDigest:
          "3e188801ce3e46ba26822caac62c693e15517729ce29d4bcebc9dc9c99384490",
        rawAssertionDigest:
          "9ed2028f64524a6c174f8a808babfc84fc07056c055c683c0db55ea9c596f534",
        auditRecordDigest:
          "f7bafeb781b86511679cb913dda22b825fc11336e8faae6423e49c8bac9883e2",
        candidateRecordDigest:
          "03a756318bfbde61cb4e898d51e6aac9a82842eb7571a45fe4fce91c2171c7b7",
        stepAnchorDigest:
          "7df04e1d5240d551724a5b432acc55c25c998c5102185a283f8f5c34b2bea260",
        firstAuditRecordDigest:
          "28fac7ae4d35ebebe69e369f8a31c260c458b118d113a59ca225daedfa2567ba"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "3e188801ce3e46ba26822caac62c693e15517729ce29d4bcebc9dc9c99384490",
        reason:
          "The specific and legacy sections are mutually coherent and accurately describe Putiel in Exodus 6:25."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:q.ao.ad":
          "5442fba60b0a6ef05a559caf10a31b5c0d00cfad3a0fb5c349338f53c45601ac",
        "OpenScriptures-HebrewStrong:H6317":
          "1815696cf2b016ca67b2f6dc426ac6427c29df64aa3432a346127035a92e5074",
        "OpenScriptures-LexicalIndex:kbs":
          "461cce1f2d47a0c80a00b63f780450232bc079186f7dad682f90aea51199d84f",
        "STEP-gloss-anchor:19616":
          "7df04e1d5240d551724a5b432acc55c25c998c5102185a283f8f5c34b2bea260"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "38c7331e98ea72602bf59724d34c0a415916b963b75052ece72495185711e2bd"
      }
    },
    {
      key: "H6358",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19665,
        eStrong: "H6358",
        dStrong: "H6358 = a form of",
        uStrong: "H6362"
      },
      input: {
        rawHtmlDigest:
          "73c80d961cf78a9b066995f94855557fff10b25e3538a691d3d049354b93a02d",
        rawAssertionDigest:
          "9c06b7726bdc614e721af583a88ae225ede62ee455a799a72887363debb3db84",
        auditRecordDigest:
          "781b4a13dbaf9275a6d986d2f480b0f26382523dc4cb3e5571ca1488455dd594",
        candidateRecordDigest:
          "efdaa9bf74a64a15f7d1ea2da681fa95b4911c5ba522e17cba018f808f6e078e",
        stepAnchorDigest:
          "d47395350e4b26b6209997b8531f6e50ddbb01e8eb90c09066218769b7b99795",
        firstAuditRecordDigest:
          "9a717071b095fd0021a28ab670fd4b83954f93aa61eae6f4e1e5d84531ff1d30"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "7db836d6eda73c00c4d67e48bcbdcd1e35fdd01c14c5558aa0ec731411a90fa9",
        reason:
          "The raw notice imports the root's conjugations; the exact companion identifies the passive participle opened, substantivized as bud."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H6358":
          "a48ef4babea707de065726ab871da2a731c8c58c5e2233254d11138669660ad9",
        "OpenScriptures-HebrewStrong:H6362":
          "309384a8b470d8419c20686216f6b8501f0f93eb7a42cf24ad5f398ca24ad95f",
        "OpenScriptures-LexicalIndex:kdn":
          "c1efe010c76a4cedbf50666a2b87f597e7b35cf75a52bce58b503da258ce801e",
        "STEP-gloss-anchor:19665":
          "d47395350e4b26b6209997b8531f6e50ddbb01e8eb90c09066218769b7b99795"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "14cbc5bf7fffc808794737b1c97c086b553a7cfcd5c3b54bee7eeeee324d5e15"
      }
    },
    {
      key: "H6423",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19741,
        eStrong: "H6423",
        dStrong: "H6423 =",
        uStrong: "H6423"
      },
      input: {
        rawHtmlDigest:
          "35bddacabdd218fdbab24c8197b9322a36efc44fe3a76f3787708c43ff704533",
        rawAssertionDigest:
          "9ff938338a92959ab7c5ff93521125ecadecc30c9d0b259c0d4a57f05e4f90ec",
        auditRecordDigest:
          "f26f835ae1f88d0e3ec68ea7536fd808badbd6c537a12f52e75022e0238838cd",
        candidateRecordDigest:
          "eed255df785b204f6de2005f950058910156108cc3d8b2a0974d33498dd6f54b",
        stepAnchorDigest:
          "49961f7da6cedf3966f9dcc1bb0ec586f3c08db447fe5ad3583388f992eadfe3",
        firstAuditRecordDigest:
          "45ba09c62d223c6d3b86f4f85add0d85452bf4d41357242d3dfbe39f656770d3"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "35bddacabdd218fdbab24c8197b9322a36efc44fe3a76f3787708c43ff704533",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H6423":
          "e393f5376c2688bdb2feb0ae5bf986611d7b8afe74873a547e1a516d0486d411",
        "OpenScriptures-LexicalIndex:kgc":
          "0c8424d28721aec2cfed25dcb9440167bd0a9d97016beaae78bc838544eda3aa",
        "STEP-gloss-anchor:19741":
          "49961f7da6cedf3966f9dcc1bb0ec586f3c08db447fe5ad3583388f992eadfe3"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "5ee72f73c042511e64d21c45644479a8d64ea7d228bb2a4943f0a356d11568bc"
      }
    },
    {
      key: "H6430G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19748,
        eStrong: "H6430",
        dStrong: "H6430G = a Spelling of",
        uStrong: "H6429"
      },
      input: {
        rawHtmlDigest:
          "997048246910b193d45fb5495a3fee845c7306b146a2b2bb5e08633d2e47efa6",
        rawAssertionDigest:
          "387f9c02a0f9552e6b21834e6f05d21c1d58635589a00591f933aa43b0f6eff8",
        auditRecordDigest:
          "8143b086fe8fa0d170e0c76bf145249611fd9cee75295cd99d62f16b1d9d26d9",
        candidateRecordDigest:
          "f197b9baa06c421b74fec78b19c57e898228401c2a6dc371d0a8caf630bb933a",
        stepAnchorDigest:
          "77aa27b138ab50d1ee6fcbd5eebcf147f381fa2e1771f1aa16afe4577f301469",
        firstAuditRecordDigest:
          "5df665f8ad4fd07a33cd8028c08934de7b5cf88ec1d5026d995bd259f975421a"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "997048246910b193d45fb5495a3fee845c7306b146a2b2bb5e08633d2e47efa6",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19748":
          "77aa27b138ab50d1ee6fcbd5eebcf147f381fa2e1771f1aa16afe4577f301469",
        "STEPBible-TIPNR:H6430G:entity:3881":
          "6adecc9aac8b9c7e21eb528b00686e7859d2e23785c48b75bdd227a6d4b84af0"
      },
      occurrenceProof: {
        count: 285,
        occurrenceCorpusDigest:
          "601d5e45185d27a3027cb5a76d0b9305623d1b32f82222acb5eee140b541d7dc"
      }
    },
    {
      key: "H6549",
      counterAudit: "raw",
      identity: {
        stepEntryId: 19905,
        eStrong: "H6549",
        dStrong: "H6549 = a Part of",
        uStrong: "H5224G"
      },
      input: {
        rawHtmlDigest:
          "0e1b9e58d32b0225170685af2384c717447c4a29d47d63190f594dec80aa5854",
        rawAssertionDigest:
          "26038b032d452770aed5f970e4c2eaae18598b1aae3788100bd9fce7e80fe278",
        auditRecordDigest:
          "9096871cbdd8e8987343a090a04471a217ab1db277d71e5501eacf4d7a1858f3",
        candidateRecordDigest:
          "915cbe92c21441e29dddc53239c4dc2b7c093986988f7e5dfc350ee082ceba9e",
        stepAnchorDigest:
          "904045e24db9649cabd44b38cfbad7302818486384e2eccfebcae79d30ec7bb3",
        firstAuditRecordDigest:
          "c90c1ce9ee9b8321933f00acc76618578c4ba93f160d92c6689d893afc890d46"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "0e1b9e58d32b0225170685af2384c717447c4a29d47d63190f594dec80aa5854",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:19905":
          "904045e24db9649cabd44b38cfbad7302818486384e2eccfebcae79d30ec7bb3",
        "STEPBible-TIPNR:H6549:entity:2153":
          "97a40f25e38008d5898ec2e64875a7158a13b3b9bbed5ccdd990db744b44d337"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "2e0603bcb07782e98819437367b50844179f4aff038d750f668a0a07f938f7ce"
      }
    },
    {
      key: "H6649G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 20030,
        eStrong: "H6649",
        dStrong: "H6649G =",
        uStrong: "H6649G"
      },
      input: {
        rawHtmlDigest:
          "e25e77a700a89e316af8917570308c43964aab969e631a531ab090c0be298f13",
        rawAssertionDigest:
          "232d5fd613faa4dda24e3a8cafcc3c11eb88c8c35535bad28cc6f32d06efe87d",
        auditRecordDigest:
          "e3e2b472b33e2652ebf9950ea3054f18c4fb4a8227b6d9ad8aaeea1216484e90",
        candidateRecordDigest:
          "886eeb6e6691a4733f352517b453cb00e2b5008921c50e38dec54d3587e1d5b0",
        stepAnchorDigest:
          "f7db08a2e60580588a7e36bcdc4d1d1457407d45c575960791a5075834f38e48",
        firstAuditRecordDigest:
          "d7137be747a6d03bd2fb68209c1b0067f91da59d09b172cc7d851d3001b4143f"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "0101a2b448be8829dcca62415fb64a3435ff8acbe3d3a826e24b61165e11f19e",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H6649":
          "a764883896e51156a693a795277f2affe356c2b02daf6463aff644df12345e15",
        "OpenScriptures-LexicalIndex:kpu":
          "a17ff1797f375374eb51884820fa7073313e7f3cbdbd0e1d7cf950eb9db11f3c",
        "STEP-gloss-anchor:20030":
          "f7db08a2e60580588a7e36bcdc4d1d1457407d45c575960791a5075834f38e48"
      },
      occurrenceProof: {
        count: 2,
        occurrenceCorpusDigest:
          "4c7374690cd3c3da5ed070d20bfcfcf08794afe32ea77bd8e6867238ba6217ad"
      }
    },
    {
      key: "H6649H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 20031,
        eStrong: "H6649",
        dStrong: "H6649H =",
        uStrong: "H6649H"
      },
      input: {
        rawHtmlDigest:
          "4a40b41608d8348a15e000bb151cae20a6fddef90a8cab4dac90451dd895daa3",
        rawAssertionDigest:
          "9aa4b0c08262c8e785d2f0d52f774629b85280794b83cdb1df3e1b9af458520c",
        auditRecordDigest:
          "64bb4d5a7c087cd556e056b1b6fd291a6d9c2146661f76e40ebb20100dc0f260",
        candidateRecordDigest:
          "bb4a41cc053a4d8e48c1ab96b01203be41d3f9748c47515557c3d5591e7bc55c",
        stepAnchorDigest:
          "f7db08a2e60580588a7e36bcdc4d1d1457407d45c575960791a5075834f38e48",
        firstAuditRecordDigest:
          "1195d54675bfb3abefec179202bb2577e18583626e34e42c96580ac64fc710ea"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "a997b82114195cb44a1c8c555939e6277794f72a60f33280a2e1cbe56401ebf6",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H6649":
          "a764883896e51156a693a795277f2affe356c2b02daf6463aff644df12345e15",
        "OpenScriptures-LexicalIndex:kpu":
          "a17ff1797f375374eb51884820fa7073313e7f3cbdbd0e1d7cf950eb9db11f3c",
        "STEP-gloss-anchor:20031":
          "f7db08a2e60580588a7e36bcdc4d1d1457407d45c575960791a5075834f38e48"
      },
      occurrenceProof: {
        count: 6,
        occurrenceCorpusDigest:
          "f5a5fbdb9c14e3157a52fa673c5cdc96193ab7b2c3745335cf574befad114be0"
      }
    },
    {
      key: "H6697G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 20103,
        eStrong: "H6697",
        dStrong: "H6697G = a Part of",
        uStrong: "H3277G"
      },
      input: {
        rawHtmlDigest:
          "b3c6ef3fc417086b6b6af7a936456799a3da8b91b6f67ac5f1f2570bbf3b2902",
        rawAssertionDigest:
          "939892b4919401e7f02959d0c3b2d7bd7a003f4456c047e41ee9b8863f65a6a4",
        auditRecordDigest:
          "448ed0bb8cddd4fccf124da33b7ad643b35a5c4bb4b252e592dabc83d5eaf8ea",
        candidateRecordDigest:
          "ee9220b50053c5acd4e493ff3dea2b07c13a5283fc697358ce4af79f030c56a5",
        stepAnchorDigest:
          "6018b6431a988ae7e268d26c16469a0953076f9192abd6acdf11bc3ebfba5f34",
        firstAuditRecordDigest:
          "667db4f6b7e002bbb864e78c087275f19514f0e18f986ce6d08669b6e5c601fa"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "b3c6ef3fc417086b6b6af7a936456799a3da8b91b6f67ac5f1f2570bbf3b2902",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:20103":
          "6018b6431a988ae7e268d26c16469a0953076f9192abd6acdf11bc3ebfba5f34",
        "STEPBible-TIPNR:H6697G:entity:4092":
          "425671d784a7436bc89d6131a55dce1fb07f9115bccbe455692e13bd858d858a"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "a78d8bd58683c88c32ee01ed8c19a99f12896d5f379b4dedde35165a704e6e97"
      }
    },
    {
      key: "H6713",
      counterAudit: "raw",
      identity: {
        stepEntryId: 20122,
        eStrong: "H6713",
        dStrong: "H6713 =",
        uStrong: "H6713"
      },
      input: {
        rawHtmlDigest:
          "b4b218b4aa123bcbb3f6beab270904bb04cddfac549bb21c7cd084931142e13c",
        rawAssertionDigest:
          "69ea6fb68b8063bd2ba838526dbb25b553588970aa44b72758b8778358fbdb90",
        auditRecordDigest:
          "0525ee86c72a112e2636bfff8b7ecdebf5ffcc75870457d488eef4294942a773",
        candidateRecordDigest:
          "4c330e30b077c0663ed38fc8f76bae6485db454aea615a099ea76bceab5e53b6",
        stepAnchorDigest:
          "00619a6647640b1c31d5698146cc3c751008315d29df52c8b9dd4b3364f4d941",
        firstAuditRecordDigest:
          "e36e0f55d4e4c71c5f5232ab0476e7179c3871a248a00e0a3ae7021d6d33e442"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "b4b218b4aa123bcbb3f6beab270904bb04cddfac549bb21c7cd084931142e13c",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:20122":
          "00619a6647640b1c31d5698146cc3c751008315d29df52c8b9dd4b3364f4d941",
        "STEPBible-TIPNR:H6713:entity:3931":
          "504134e29cb9c27a8e9f7aa3b373b7c3f574a4a6ba1fece546f3a93da9751def"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "48aecc711d4305e1a9f0190b72122d64ae2d8654de4bc1097899fcb1a6be71f7"
      }
    },
    {
      key: "H6870",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 20310,
        eStrong: "H6870",
        dStrong: "H6870 =",
        uStrong: "H6870"
      },
      input: {
        rawHtmlDigest:
          "221ddbd048f56194c052744c04afc787811089fd910c806deca21ede17a5943e",
        rawAssertionDigest:
          "d7827906f3ea72555bc92d55e04ba2e9aae8368b7208d1fd13d63b5d7fc629cd",
        auditRecordDigest:
          "0be725cd3c8a6998c6d8785b5ef245a27955fb6fbdeb48c5bcaf3b7aed0824b9",
        candidateRecordDigest:
          "6c44ee72f724c57d250b77f847fe6a170827035a3b247d530fb3f4b846fa53a5",
        stepAnchorDigest:
          "108c6c1bcf500bc8f4d11e317a15cfd6de13fa349309eaf6b31188ec4eaf88eb",
        firstAuditRecordDigest:
          "a8a110bee4bb8842206b25caf28329a0b5ea049a27c5c448beec578368a8ef81"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "f0fb7e30617c3104cf819824f733b58218525b17310f37bc69c713da6cd04e9f",
        reconstructionHtml:
          "<p><strong>Zeruiah:</strong> David’s sister and the mother of Abishai, Joab, and Asahel; 1 Chronicles 2:16 places her in Jesse’s family.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:r.dt.ad":
          "287a6dd771fdae9407551f0239ac78c30eed1e984b786e598693df6d59b93f25",
        "OpenScriptures-HebrewStrong:H6870":
          "c2764ed529d3e9e1b0b1a3419d903032eafa1b4dde013e86f09cb24aae04ebba",
        "OpenScriptures-LexicalIndex:lam":
          "6e6d67677792f6a63d40440064bcc3a8c02a4aedd1c6770df320b1e875d8cdb5",
        "STEP-gloss-anchor:20310":
          "108c6c1bcf500bc8f4d11e317a15cfd6de13fa349309eaf6b31188ec4eaf88eb"
      },
      occurrenceProof: {
        count: 26,
        occurrenceCorpusDigest:
          "2bc1f34a8210fd72224a567be4bad1ef9b8c125a281aff1d6461d8d4525f78b7"
      }
    },
    {
      key: "H6887B",
      counterAudit: "raw",
      identity: {
        stepEntryId: 20330,
        eStrong: "H6887b",
        dStrong: "H6887B = a Spelling of",
        uStrong: "H6696A"
      },
      input: {
        rawHtmlDigest:
          "a649bd9cfc92f0062d6e3ba61f67823fe62e2c4cddc49e34b8d89b95d7c4e3f2",
        rawAssertionDigest:
          "e305873e7a35cbd3ff0f15b7c9891ebfbfeb515af36c724905baa1f32da38347",
        auditRecordDigest:
          "1c0e3db0ac3297768624952ee8baff7a77f9a67d5325a4ea4afba687b778799b",
        candidateRecordDigest:
          "c6fc2a5d1c1ea869b9fcd54fe1bc79178e8839e9d5b5db263c7832aa3f07c9e1",
        stepAnchorDigest:
          "4c9eefa5c4b8c95a580dfac3f16f7479139590db147a6ba398a2a8cfcf3d78c0",
        firstAuditRecordDigest:
          "cf33f38623c6d05bf59e91f10f962f59ce1d84d20c66ae35b57c9132d0372d8a"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a649bd9cfc92f0062d6e3ba61f67823fe62e2c4cddc49e34b8d89b95d7c4e3f2",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H6887b":
          "78eaf7f52360a03a301ce40a47d6a252e0d2a7ab50c3fd4991d3d2b30104d43e",
        "OpenScriptures-BrownDriverBriggs:r.dz.aa":
          "e985872b055494f3657b0cf7cca756378473fe0d08e658aec22d212f90fb9eb6",
        "OpenScriptures-HebrewStrong:H6887":
          "49ecb97be633c3809e421a14162f9870161bfd9c2b058dd7e23f955ae7787098",
        "OpenScriptures-LexicalIndex:lbk":
          "c7a2dd037de2891da36466c31d09e157d89a863bc89a2ba5f1e227416344046a",
        "STEP-gloss-anchor:20330":
          "4c9eefa5c4b8c95a580dfac3f16f7479139590db147a6ba398a2a8cfcf3d78c0"
      },
      occurrenceProof: {
        count: 23,
        occurrenceCorpusDigest:
          "4783758c7d426eec4a8b67db57cd4c94b53ee8b51dbf0a5ab462d5c5c8840133"
      }
    },
    {
      key: "H6905G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 20353,
        eStrong: "H6905",
        dStrong: "H6905G = a Spelling of",
        uStrong: "H2991"
      },
      input: {
        rawHtmlDigest:
          "4476d830fd7f4bfa80a6ebd41e4f43d21c39c1c26a8a347d764535df7e5193a9",
        rawAssertionDigest:
          "19bd3959ffb5ca7ead79c8e62be9ac5442bbfb076b7963aa8b26369ce850dfc6",
        auditRecordDigest:
          "6bc6a43e94a7bacbb9391691a51ba8dfa68510e9b99fd7592cc9b7fe3a4e6db1",
        candidateRecordDigest:
          "2c65a77c7176211648d43d027feb801dc23c1ff92842d6ca32e51e853e4c2d15",
        stepAnchorDigest:
          "45960e96662ef2961607f381bcdd3d6fa08ce47488c274c3883216e1429b0666",
        firstAuditRecordDigest:
          "07def123134f1e352ad0c552b306800a2cb04c52d8bf1325ff1cc23f4b65a5f4"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "4476d830fd7f4bfa80a6ebd41e4f43d21c39c1c26a8a347d764535df7e5193a9",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:20353":
          "45960e96662ef2961607f381bcdd3d6fa08ce47488c274c3883216e1429b0666",
        "STEPBible-TIPNR:H6905G:entity:3618":
          "6a9c4c867784dc23c01201f2bae9821c16dbb1c82c4b2fb7ed1a85fd9e3a1b42"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "512c4e7f2cf771fd0dde2d0579da46705296a52587f5824425810a424cc5a0b3"
      }
    },
    {
      key: "H7073J",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 20589,
        eStrong: "H7073",
        dStrong: "H7073J =",
        uStrong: "H7073J"
      },
      input: {
        rawHtmlDigest:
          "875e11cc3424da123332ceba4bb06d009fe8030e291b2af26818a59ee6b742f3",
        rawAssertionDigest:
          "829563377de8d78c0bfc848096849423e2c4ff717113730096077d7d702a1a34",
        auditRecordDigest:
          "48830176ea3d86323a0b9b8286962845182e84a7f016641360bf51c96d923638",
        candidateRecordDigest:
          "89986ca15d65513296d4a068e72f4b62a3951ce7f7eda44ccc293e9433347283",
        stepAnchorDigest:
          "8e15fa118576d42f5684b669f26972e316dc6f67590854594ec6a72b4e8dcea7",
        firstAuditRecordDigest:
          "6ce9276bf750a746051b7ca63334f26aca7238c1231d7a68bf388a0fd700d95b"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "8c4ba2b2056e537e85b2f0bb1a539c7633208aadea2e318758367920b1d5a4eb",
        reconstructionHtml:
          "<p><strong>Kenaz:</strong> the son of Elah named in 1 Chronicles 4:15. Current STEP identifies this occurrence as H7073H.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7073":
          "7446e2f8f79adf19e86063622e9eaac9468251044156124e53c375c011832151",
        "OpenScriptures-LexicalIndex:ljf":
          "ad37ca2b650e9356224b7d674f5b2eec6c04ca80ee66ee14a9117d0134d47138",
        "STEP-gloss-anchor:20589":
          "8e15fa118576d42f5684b669f26972e316dc6f67590854594ec6a72b4e8dcea7"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "739fb1994a586e868b38b9c21209a6d314f9492f8a9ed79fd03828d1a436c770"
      }
    },
    {
      key: "H7156H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 20693,
        eStrong: "H7178",
        dStrong: "H7156H =",
        uStrong: "H7156H"
      },
      input: {
        rawHtmlDigest:
          "de3ca0744fdaa057975fdb301e086b6be67ccfa16d36c15907fe73d4c1e881be",
        rawAssertionDigest:
          "912b5e9bc6a156d73533614fd2cc745c155343d9a30d706440da86b27a984e2e",
        auditRecordDigest:
          "f07b5a7454cd6bad18e00b972b67558224e1dc970d285107b1ab307b7b49bcc2",
        candidateRecordDigest:
          "5b73b33fdcd12f172033a83b40c67d240b519da3b84715b8a126935a4730f980",
        stepAnchorDigest:
          "d2f93b4e6bd0d3565d53c38a64ba153d2440595312c738a63ff875741533c866",
        firstAuditRecordDigest:
          "677d02f1924b07494a5647118f10e3cc933ba076a874b719b1fec809ac75e0c8"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "1feeeef021d4e0b09ae3b2fed6aa9fbb08ad4629f1e339e72dafb0f9721d1c78",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7178":
          "2e28deee3ea9a075245043793ef3f285fbdd165c90706e29ffdab740f4e12e70",
        "OpenScriptures-LexicalIndex:lnw":
          "36e251c0d7a4041894c9c9becee78ae2377ef7e3c98ea0a4b6f84595d3d1c249",
        "STEP-gloss-anchor:20693":
          "d2f93b4e6bd0d3565d53c38a64ba153d2440595312c738a63ff875741533c866"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "e1d0cefd0ec1e44d45f7332827ecb695dd9060bfe9d081e37678b1aded1bfe24"
      }
    },
    {
      key: "H7200N",
      counterAudit: "raw",
      identity: {
        stepEntryId: 20749,
        eStrong: "H7200",
        dStrong: "H7200N = a Name of",
        uStrong: "H3068G"
      },
      input: {
        rawHtmlDigest:
          "6d3b9c2dfd85c2b43d19d28b88bde2689a333b52677a6d43ee26a95fa3f224cf",
        rawAssertionDigest:
          "f671df045707108c0d42eccf6e41b24e1a11dc3f2c74bb381b581137b04259e5",
        auditRecordDigest:
          "9a6d168cd16e9ca2398bb2ae0b9479f6656828f5ae577267910b85bbdc2bea8a",
        candidateRecordDigest:
          "4904f2d5e3a6e348008013c2d780d969dfa47711577798304a5e6892f27e6ac8",
        stepAnchorDigest:
          "cbc047d6749ef50a31f1570357d11af9f2012e752b0071f65e9aed63cd3e04f4",
        firstAuditRecordDigest:
          "9bdb5d417e49f66536932c03079534188dbab28bf9514288a6ec73a5f43c8f27"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "6d3b9c2dfd85c2b43d19d28b88bde2689a333b52677a6d43ee26a95fa3f224cf",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:20749":
          "cbc047d6749ef50a31f1570357d11af9f2012e752b0071f65e9aed63cd3e04f4",
        "STEPBible-TIPNR:H7200N:entity:4174":
          "a718935d9e1115b944cf40531bc09fce9adbd3ca717d60303c5acd2049d69733"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "f538de4112f71106a54c0249ff2b685fc2f5bbd0d19ace44ac1be9283e2fa898"
      }
    },
    {
      key: "H7202",
      counterAudit: "raw",
      identity: {
        stepEntryId: 20751,
        eStrong: "H7202",
        dStrong: "H7202 =",
        uStrong: "H7202"
      },
      input: {
        rawHtmlDigest:
          "008850570aae05e8eb0d32514868ea4e7472225c956cb18ea42e85f98265f203",
        rawAssertionDigest:
          "d021e824182f19a8b3106f4e378a0a22256bb9f2c11bce9d31fb5dd95533f449",
        auditRecordDigest:
          "7ddd9913cc4457f82ef3ed12679dd631fab055489bcc382c211d793298bea5f3",
        candidateRecordDigest:
          "805621a7a27222f453198c5376a7334680192f7a86ced4472955f0c628d910ab",
        stepAnchorDigest:
          "e5d5703c7d9798b6e4998b5fe908ee58491eb0d2f3c683b4e355d40cff04d8a3",
        firstAuditRecordDigest:
          "6f4de4bccbc5027bcaf0831773741e98009ee9c10ef734f7ae5e6944e7c1322f"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "008850570aae05e8eb0d32514868ea4e7472225c956cb18ea42e85f98265f203",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7202":
          "12143ceaa35778ecf04366f0707931cafd0c0da14997cabc89c1ec1aab9cbb79",
        "OpenScriptures-LexicalIndex:lpc":
          "3321f8d6424b5f10f10f79b3163b34e12046e65f27171e5c17cfdce3ffb3d864",
        "STEP-gloss-anchor:20751":
          "e5d5703c7d9798b6e4998b5fe908ee58491eb0d2f3c683b4e355d40cff04d8a3"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "032c281380ecf6f5a3f1bcc798fcfd99d8489b9193882483353507576a3937d3"
      }
    },
    {
      key: "H7315",
      counterAudit: "raw",
      identity: {
        stepEntryId: 20891,
        eStrong: "H7315",
        dStrong: "H7315 =",
        uStrong: "H7315"
      },
      input: {
        rawHtmlDigest:
          "a9d1911741a9eaa6d905cbf7bf58ba157b05c563fde64a1c01dd0a76da910051",
        rawAssertionDigest:
          "1b7ff0dca889db7f372ddfed4a0eeca4797f7fb8bfcadd7b1703ef899074a08f",
        auditRecordDigest:
          "5d9e7e5c9a4721705fdde835b6316f2471dbf7f0a50dedc63a5fa187790fd926",
        candidateRecordDigest:
          "2a1793c5c20c9f48e1ee70f710150b24a7c9392a20afe6929468b71c7c07f639",
        stepAnchorDigest:
          "8cba4fda8f8764a502047effa7d93a9d2a03846411eaa6d49080f40ff3f5f205",
        firstAuditRecordDigest:
          "a416f190506827a80124c981fc4ede26f8a26c351e5c741733553228d64bf6f1"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "a9d1911741a9eaa6d905cbf7bf58ba157b05c563fde64a1c01dd0a76da910051",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      key: "H7319",
      counterAudit: "raw",
      identity: {
        stepEntryId: 20896,
        eStrong: "H7319",
        dStrong: "H7319 = a Spelling of",
        uStrong: "H7318"
      },
      input: {
        rawHtmlDigest:
          "a2bdf57869ef368fa569f951ffc8b5c5a4562b7efb89c7f8586deed8ac0964d9",
        rawAssertionDigest:
          "ca8b12fe80325bf9d867a33acbacc0f71a4a076ba005ad3a4b544747d47061b1",
        auditRecordDigest:
          "b55cc27548754bb0b8796fc857b8c38eccaa5123bdffe99b07d178125aaccb45",
        candidateRecordDigest:
          "0fdc01cdfccaac195f00ec54e7f4f5ff3eabc4a443bf600fc9da3353318baec4",
        stepAnchorDigest:
          "0abbdbc94f00ea354411a2e7387924833be2b0e1d0d3f830624bb8029ba9cd2a",
        firstAuditRecordDigest:
          "d5333eb5e68dcabbe6a90d2fc2c2fce449bb144fb7b42c9803c9ad70408f8324"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "65c3dc21b8cacfc4063b6de043b069809805066b4365830f2ff4a1405437eb19",
        reason:
          "H7318/H7319, BDB, and Psalm 149:6 support extolling or praise rather than the raw notice's imprecise description."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:t.bm.an":
          "ed047370b155950b4e229e6504bddc7ceda1e5ffcd944238da6a1d1bb31296fe",
        "OpenScriptures-HebrewStrong:H7318":
          "0a09d3d5691f2d29d1d0aef8d676696e083efab71b5685736d0ac860ee30fcae",
        "OpenScriptures-HebrewStrong:H7319":
          "c18cba6dd18447e9cfda93e7251477993cc386a141e23a372646aa084be1ccbd",
        "OpenScriptures-LexicalIndex:ltv":
          "f5a797d088757151a49e4d8feb54c349a134b998b78e573a0363e3d0a0bdb5e2",
        "OpenScriptures-LexicalIndex:ltw":
          "92b15d8f7999586fbbc25100a6d3e58d3a1ed9f81a9bdb4c5969b70092044fc0",
        "STEP-gloss-anchor:20896":
          "0abbdbc94f00ea354411a2e7387924833be2b0e1d0d3f830624bb8029ba9cd2a",
        "STEP-relation-graph:20895":
          "b3947531dd6fe852fb8c9144d56f62fbfb7db095a7dfc07acf95cc6505ee04b9",
        "STEP-relation-graph:20896":
          "30e141f2fdd05ebf64319f850746974ac4edfd4938012bfe735bb87dbb42e508"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "c3794c5134ecd56b27c1cdc4c934f2ff3bf0b41e06a0ffe887201a69069ae418"
      }
    },
    {
      key: "H7462A",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21080,
        eStrong: "H7462a",
        dStrong: "H7462A =",
        uStrong: "H7462A"
      },
      input: {
        rawHtmlDigest:
          "9481e6ceb7368c38ee7f1fe68f778009290481f01f9618fd9efb19b255e5f6b4",
        rawAssertionDigest:
          "ba34bc074e6ed1058f535cdeaa9895b8f8bb3eb44673e5c7e71772ccb63122a0",
        auditRecordDigest:
          "8e873fc32cf0967048d26c61b06584e3740b7ba7ad01e166e62777a0189d2e93",
        candidateRecordDigest:
          "6e69907845a23ce6fd676ff874e273a0998aa787d6d08b9645df7a10d541fece",
        stepAnchorDigest:
          "3c237dfaea2049d98150da7d63fa50f49b4b83833e8458e0da4761d18c37672c",
        firstAuditRecordDigest:
          "ab4ab2b4f949c6bc8076dfeb60d4037bb25eac42fab6925f4606fa7be0ac03dc"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "9481e6ceb7368c38ee7f1fe68f778009290481f01f9618fd9efb19b255e5f6b4",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-AugIndex:H7462a":
          "4f85f22d3f7877b4cb5513b5aec7f0ee9bb9897f3c1b51127c2850ac3b56220a",
        "OpenScriptures-BrownDriverBriggs:b.bp.bn":
          "0006fa06d0d5a92cd3985757d2215e3769ab437d8ab981770ec8f9cccd300ce6",
        "OpenScriptures-HebrewStrong:H7462":
          "dbc17c7079c792c870b4c48557ccc107c2e7195502aa2afdd3c3cd134d31df24",
        "OpenScriptures-LexicalIndex:bqb":
          "73be25a877f248897729a92fb08ac80f76d53ac91b637f65ea42f629be079a29",
        "STEP-gloss-anchor:21080":
          "3c237dfaea2049d98150da7d63fa50f49b4b83833e8458e0da4761d18c37672c"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "0b539938021639dc6c720a71ef5bd10e2cbf5aaedf56fbfcde0812add480f197"
      }
    },
    {
      key: "H7641H",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21301,
        eStrong: "H7641a",
        dStrong: "H7641H =",
        uStrong: "H7641H"
      },
      input: {
        rawHtmlDigest:
          "8caa59de1e50b2dba0a47cad0ec81dddd60ca6dc3c43657e9afd8ceabd865562",
        rawAssertionDigest:
          "4f86db53293e651403760c186fab65d64aedb052c07899c73eb79bd54f28228f",
        auditRecordDigest:
          "691661f1d900160a9eda47a20e0ac7844c3a4c757d13cbada3f320a1723f7c39",
        candidateRecordDigest:
          "e5fd80c827f85adaaeb9c33f1c4eaa6a137c563a90db6af15f5280266ba2cd4a",
        stepAnchorDigest:
          "ac8232defd3f8b97fae44521f2d6ba30a9855e251cf18d46e4705e0390dc7ca3",
        firstAuditRecordDigest:
          "4211e668c58d3ff7904c8b8b61eeb0ec66c57373c810c4f249dca2280f891ac1"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "8caa59de1e50b2dba0a47cad0ec81dddd60ca6dc3c43657e9afd8ceabd865562",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:21301":
          "ac8232defd3f8b97fae44521f2d6ba30a9855e251cf18d46e4705e0390dc7ca3",
        "STEPBible-TIPNR:H7641H:entity:4206":
          "1b7f39b7a374e3ad89b147f0098bcc4829e3673e11af19a62a24aece0d576a22"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "d7f91a2b43bc812b41c1e0f8572695f41176a36c4cd438487e6d091df743089c"
      }
    },
    {
      key: "H7692G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21364,
        eStrong: "H7692",
        dStrong: "H7692G =",
        uStrong: "H7692G"
      },
      input: {
        rawHtmlDigest:
          "2d0affdf639365ee03b4bff13050413356b0b029bfacc9f5724a7c5e8d9697c5",
        rawAssertionDigest:
          "813803f1176cab3e7faacacf23d2b89fa4432dc07001af0c6834b4ba3462c92a",
        auditRecordDigest:
          "31c90d5c05b0708e6c88e9d1ed4fb80b4ee1d9b06349a6aff205bb356dbb5f08",
        candidateRecordDigest:
          "65b89b4c4dba9d5bb2d6bb96aa4ae79a6ef3b7455cfcbbf7832312111eb553f6",
        stepAnchorDigest:
          "df9c77fb29cb5bfc909a0f2fb09a0d7b5d443fff29f2595627572915c2da5ab3",
        firstAuditRecordDigest:
          "4296864aaa9c4dfb05865203c5c72c7df5e77713f1da63965211009fefc65235"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "2d0affdf639365ee03b4bff13050413356b0b029bfacc9f5724a7c5e8d9697c5",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:21364":
          "df9c77fb29cb5bfc909a0f2fb09a0d7b5d443fff29f2595627572915c2da5ab3",
        "STEPBible-TIPNR:H7692G:entity:4207":
          "8965708b711ed91c81d9bce7301b750467bbd9ee961201f930d5ebda02e431e0"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "0a4cdad1c660fa91ae15945786fe778c1119da7778bcd7f04f34570622652567"
      }
    },
    {
      key: "H7704A",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21378,
        eStrong: "H7704a",
        dStrong: "H7704A = a Spelling of",
        uStrong: "H2768"
      },
      input: {
        rawHtmlDigest:
          "f1a3b3c886c88eff49d65c0b8747010a7cc1f823d1c88b51427b87b714b1368b",
        rawAssertionDigest:
          "5c80fea6a4f1cc0725934094681c193c4a7c0b961f5ee18f0fad5add85a8fbac",
        auditRecordDigest:
          "13270f02934297ac30489b95764156d7246dc026d693b27d1cef11091a4bb2de",
        candidateRecordDigest:
          "e74802e67be0fd43e1b43c958372f565beb32d05d597d780a57b7aff05fc37d8",
        stepAnchorDigest:
          "642fd217ec564033613f5158572d7fb94eebd966d89f408a097ccf9919491d43",
        firstAuditRecordDigest:
          "7449837a735f8151b5de21e362ef88578f208692ca5fe0670f711aefc7b8da4f"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "f1a3b3c886c88eff49d65c0b8747010a7cc1f823d1c88b51427b87b714b1368b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:21378":
          "642fd217ec564033613f5158572d7fb94eebd966d89f408a097ccf9919491d43",
        "STEPBible-TIPNR:H7704A:entity:3598":
          "f5835a968db72b979b672c3c7867609f09507f37f82d60d8a6f1dc56ff9f25ba"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "94fde828f2be1481136311030d1989c5cfc439643273f2cf57c5c9b203a77a02"
      }
    },
    {
      key: "H7721",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21401,
        eStrong: "H7721",
        dStrong: "H7721 = a form of",
        uStrong: "H5375G"
      },
      input: {
        rawHtmlDigest:
          "3f93f835d69dd854b01787393840f508e99410086c7279f387d5ed653fe68037",
        rawAssertionDigest:
          "f018c4245c09035b8909e4c08944c27fe241bb11e647bd396ac827ce8326b7df",
        auditRecordDigest:
          "5223147ee247359b379d4d03858170492279b0e2b6afff288c6255ef3a087777",
        candidateRecordDigest:
          "51a15dbeead93b5bc46c8c9fa98395e5b616af08d91abc1610ab0d9509a42e7e",
        stepAnchorDigest:
          "66985435afed66a6c1228eb95094084f193e58e5ebe3d5634f83c025781c09b8",
        firstAuditRecordDigest:
          "dc8dc9be88079ef524d43b322625a1bb270a62500eaf76048046e3947e03836e"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "3f93f835d69dd854b01787393840f508e99410086c7279f387d5ed653fe68037",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:n.fm.aa":
          "5eeb0b26b438fa71124310e77f8b29976fb9ae0bb185c382146e37848d95e230",
        "OpenScriptures-HebrewStrong:H7721":
          "f9fb25f5026d251c0b9aed790a64c3d11412e03c2192a571a8b1262428d7ce94",
        "OpenScriptures-LexicalIndex:mli":
          "51df75bfa36177597c5358d7eb65f5640c6ee7edc278c8b9e6909fb96f2195fb",
        "STEP-gloss-anchor:21401":
          "66985435afed66a6c1228eb95094084f193e58e5ebe3d5634f83c025781c09b8"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "39857633d51359c3994a0e6429635925c6187038ec2e7e57f26a6ebb5ad4b034"
      }
    },
    {
      key: "H7736",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21429,
        eStrong: "H7736",
        dStrong: "H7736 = a form of",
        uStrong: "H7703"
      },
      input: {
        rawHtmlDigest:
          "c5663ec2858dd451d9c14d791ebb85645a0119d56dafb2b0a25118499421adda",
        rawAssertionDigest:
          "0199a8ee2bb12c85a942b11fb66a6ac37dd13aac581f8901a4bb205d4e2e62ca",
        auditRecordDigest:
          "a16d4ac4e90855ef4a549962f28f173b5bdeb0e4d92f092a25b3bddb35b915f3",
        candidateRecordDigest:
          "df421e3ff8cd13c8afa99d569bc5110b90f6ed3538efd39524778cbe5450d10d",
        stepAnchorDigest:
          "168aaab5c36669f84206cc062b578ab48e62ec6e3e4caf40ae61986fb88d7b77",
        firstAuditRecordDigest:
          "60a8096b594964dbb395a779560f107d1f1a947bf4e57a013855af159f04b301"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "c5663ec2858dd451d9c14d791ebb85645a0119d56dafb2b0a25118499421adda",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:v.bg.aa":
          "9d8fdabc287f10f1c1579a1d806fddbe05063e81a9468145b06a5b8d0c2e6cb0",
        "OpenScriptures-HebrewStrong:H7703":
          "32d0b66dfb1e05f6e9512bec38ad89e5908e658ae92713ddf81f8b553d90c13a",
        "OpenScriptures-HebrewStrong:H7736":
          "505a58e3cf62b18c59885e1e282b91c6d3bf1a53191f2b724c69833267a0468e",
        "OpenScriptures-LexicalIndex:mke":
          "dd867cda178f65242106b01c874bdc99f1a9d08c99384d32360e0a8a0b59c2ab",
        "OpenScriptures-LexicalIndex:mlw":
          "79bf8102bbf5c8690715bb543c5acbda5b04bc13d49c30d589503b394f26d72d",
        "STEP-gloss-anchor:21429":
          "168aaab5c36669f84206cc062b578ab48e62ec6e3e4caf40ae61986fb88d7b77",
        "STEP-relation-graph:21377":
          "d4f13a499c7cee34b54c6df96dcd7c38945e7ff075f7cf16a305625dffc87805",
        "STEP-relation-graph:21429":
          "9cd2244c33a4ef35d1ce5a0bc78c068aff1fd9eb0037e981db91f44a401eb141"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "39f4079c89b9336731ea89438e2a0f4e865cbde127f2c8e7f5424044375d08a9"
      }
    },
    {
      key: "H7741",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21436,
        eStrong: "H7741",
        dStrong: "H7741 = combination of",
        uStrong: "H7156G (H7740+H7156G)"
      },
      input: {
        rawHtmlDigest:
          "ad7415538068dce4e3eb87d9bd96ae34d4b2e99175885cc216f310f306dd52d2",
        rawAssertionDigest:
          "d840e9b9b19596adcef66b864133f2d3e8ef882731f0a15ff7630762ae9d3d66",
        auditRecordDigest:
          "a35906e6835082aa1642ac5f0b9a72609c53233d09c63d552a95f4dcf63bb9ea",
        candidateRecordDigest:
          "7f2c3d2a56178108a29408a751337426478099f1210224322821dced038dd755",
        stepAnchorDigest:
          "34b45620fc2669a3f234be41b071501d2be4c8dce40f371e78704e80178176c8",
        firstAuditRecordDigest:
          "5ba840c66a7e910750e9fa4a10d97569b823f7136508e6a9a12aca0b97a77a86"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "ad7415538068dce4e3eb87d9bd96ae34d4b2e99175885cc216f310f306dd52d2",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:21436":
          "34b45620fc2669a3f234be41b071501d2be4c8dce40f371e78704e80178176c8",
        "STEPBible-TIPNR:H7741:entity:3971":
          "334cadbe36e8a2fc4a22543fd606fb14b588c58d5108e07f40711104a3e93949"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "256f7b4d6f8d2ceda02a2014ec3706b755be590fb6a1a278a723d3119c25d75d"
      }
    },
    {
      key: "H7756",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21455,
        eStrong: "H7756",
        dStrong: "H7756 =",
        uStrong: "H7756"
      },
      input: {
        rawHtmlDigest:
          "89160f0278a378376d889fb26e8456c303711ca030daa6193a3b2e8c138bf2ad",
        rawAssertionDigest:
          "c8eeb2d662e2748a0e3c2a90d600c7baf98170cd06d11f1e4eed9f3acaae324c",
        auditRecordDigest:
          "2a5e2b197bee62e0ad0a17178e9418dc39213cb330bd22bd664e64242588a934",
        candidateRecordDigest:
          "9e639fe1d7f3b3c83ffa868864ab6728dc6cdcab8a92cfc810c601d051d7c6ba",
        stepAnchorDigest:
          "865a4a056d945c5f46adb00d3b4dba2de32a9ab2327b082eb44c868f87b182c7",
        firstAuditRecordDigest:
          "78425d906eae1cd88888d4383e61257268120fe5b4fb4ffdc79dc628c7d4ef7f"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "a31d03f200a5c8625fc59adc3aa58d6c116136897f30d1de96a0333258d62dd0",
        reconstructionHtml:
          "<p><strong>Sucathites:</strong> one of the families of scribes living at Jabez in 1 Chronicles 2:55. The verse identifies the Tirathites, Shimeathites, and Sucathites as Kenites; it does not establish descent from Judah through Caleb.</p>",
        reason:
          "The raw notice asserts a Judah/Caleb descent that 1 Chronicles 2:55 does not establish."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7756":
          "23ef60ccca795bbc645036ee23e10ff3f70a87b77875863181f97583595b5314",
        "OpenScriptures-LexicalIndex:mmu":
          "f57fa5a01bbf86eea167eee1d269199a2ea7cb304d6e34884af6fefb9f8649bc",
        "STEP-gloss-anchor:21455":
          "865a4a056d945c5f46adb00d3b4dba2de32a9ab2327b082eb44c868f87b182c7"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "e049143524e80feaa4ad151387611a18423d94c43da63d2467dd7e47fe57b031"
      }
    },
    {
      key: "H7774G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 21484,
        eStrong: "H7774",
        dStrong: "H7774G =",
        uStrong: "H7774G"
      },
      input: {
        rawHtmlDigest:
          "ef853a69e8e1ecc1fe915d4b9f6583ad0d4171bfe13e7535e3926ff911f33a5d",
        rawAssertionDigest:
          "56eab1e987337d743da1accc84dc191d51920fd933c62f17b5d0a6980b81757f",
        auditRecordDigest:
          "bf992f8b8891377bd276b162c444716dbdd2a576d725d51241f7e859060bb2f3",
        candidateRecordDigest:
          "2bc5e08cf289ba02aae13c029bf35ff80e892e537a2b4c0ed8b467ea6e607e5f",
        stepAnchorDigest:
          "ce7d4ae05bab8d43c4676744f00581862d02754e4d7018f87339376825b376cd",
        firstAuditRecordDigest:
          "6c90fe4e00c68c9326a845faf368fbc1c586bd140d33a98771ccff9e739601b5"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "b5e3a4cd6107d741f1e2e4616448e3beead6507756355f07a14413674ed09cff",
        reconstructionHtml:
          "<p><strong>Shua:</strong> Heber’s daughter and the sister of Japhlet, Shomer, and Hotham in 1 Chronicles 7:32. Current STEP uses H7774 for this occurrence.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7774":
          "b96d5cac1493f730963dff2299bcad07f5b940ed739dc6871352af6cc5f2668c",
        "OpenScriptures-LexicalIndex:mno":
          "fd8af9ea165aed947da2ff60f01af002793fcc3da1f4acee3e382f30ce08bdfc",
        "STEP-gloss-anchor:21484":
          "ce7d4ae05bab8d43c4676744f00581862d02754e4d7018f87339376825b376cd"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "c7f8cc4b6f295b1ea13492d7f9d783393aa10fcfb799c7884838e37db4e28584"
      }
    },
    {
      key: "H7774H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 21485,
        eStrong: "H7774",
        dStrong: "H7774H = a Spelling of",
        uStrong: "H7770"
      },
      input: {
        rawHtmlDigest:
          "1d2350e5e3dac1c6cd95a2de158c2c023e1a223ddbf4a32cf134f5cfb578f96c",
        rawAssertionDigest:
          "fa02d6def5a2ea5f7f9fb520c8f24e20393c83ee32eafcec9307cf1471600512",
        auditRecordDigest:
          "6547be7d0d575035a0c4dec76926ca60b7ea1f12ce658820671d9f9ed0f55405",
        candidateRecordDigest:
          "be9760c0a950f04c23ebf876da155b9fbf2288cef31cd954915dc0ddd0236dcd",
        stepAnchorDigest:
          "ce7d4ae05bab8d43c4676744f00581862d02754e4d7018f87339376825b376cd",
        firstAuditRecordDigest:
          "48d6b3a3acb87441f0c7335c6ec38650094641614b7c5e2080e80a297fb919d9"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "1725e6d9fe70f55b878d1e3232788290420ee531c3004334c25159f202210bfa",
        reconstructionHtml:
          "<p><strong>Shua:</strong> the Canaanite father of Judah’s wife in Genesis 38:2 and 12 and 1 Chronicles 2:3. Current STEP uses H7770 for these occurrences.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7774":
          "b96d5cac1493f730963dff2299bcad07f5b940ed739dc6871352af6cc5f2668c",
        "OpenScriptures-LexicalIndex:mno":
          "fd8af9ea165aed947da2ff60f01af002793fcc3da1f4acee3e382f30ce08bdfc",
        "STEP-gloss-anchor:21485":
          "ce7d4ae05bab8d43c4676744f00581862d02754e4d7018f87339376825b376cd"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "88044260343edb0b534ae274aa463494f23b24e273b605e6d05bb506576f8721"
      }
    },
    {
      key: "H7774I",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 21486,
        eStrong: "H7774",
        dStrong: "H7774I = a Part of",
        uStrong: "H1323I"
      },
      input: {
        rawHtmlDigest:
          "8160596c64fe34c38fca604ab311cfee1784ed75208b64711def9fddf2dd4c3e",
        rawAssertionDigest:
          "d19ed533bfd6cca43f9056c1dba54cdb7b1c176390fc8219f484fb8238181612",
        auditRecordDigest:
          "438711fed14cd8faad0989ec0cb21f3c4fe9d7ae0d9dd9e7d5f8a033aba597ba",
        candidateRecordDigest:
          "b35f058fa7af3127f7f5c3c3c8033918f21f53266acd9fdcaf85b12a186b3269",
        stepAnchorDigest:
          "b1d48a2e7ab98d02ba26a1db9298fcdfe409192b276f9830af348ffea73da9f7",
        firstAuditRecordDigest:
          "c4261c1f6d646cb12df17f72388d1ac6415bf25adb998d1a47cc0a444c22c860"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "b1e4061ab6bd1fe90336896ee3e3dc0dd7810a37632841e53b80dfbb6be7fffc",
        reconstructionHtml:
          "<p><strong>-shua:</strong> the Shua element in “daughter of Shua” (Genesis 38:2) and Bath-shua (1 Chronicles 2:3), referring to Judah’s wife. Current STEP uses H7770 for Shua and H1323I for the Bath-/daughter element.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7774":
          "b96d5cac1493f730963dff2299bcad07f5b940ed739dc6871352af6cc5f2668c",
        "OpenScriptures-LexicalIndex:mno":
          "fd8af9ea165aed947da2ff60f01af002793fcc3da1f4acee3e382f30ce08bdfc",
        "STEP-gloss-anchor:21486":
          "b1d48a2e7ab98d02ba26a1db9298fcdfe409192b276f9830af348ffea73da9f7"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "76e7011a1d69e3a7fc8bb3101b87b476a3de273c956bbd513d41bd04d45417f0"
      }
    },
    {
      key: "H7786",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21499,
        eStrong: "H7786",
        dStrong: "H7786 = a Spelling of",
        uStrong: "H8323A"
      },
      input: {
        rawHtmlDigest:
          "15d7a2538b288b6fab94fe9be2136f3931080e1910fbc58dfe5af0cf66a4322b",
        rawAssertionDigest:
          "93eeeff3dc339009fdad3045d53004f8d97b1410ae64b89c885aa52c756639c6",
        auditRecordDigest:
          "b89db304ee44e33b446275330df513a5a87027c43076dcf3fe614f2450e14506",
        candidateRecordDigest:
          "9494c5586f1248297e6681c1580180039ad26d5b2909e7e43625c70c93561446",
        stepAnchorDigest:
          "6bb31b33e021fbd54d750e1d81424f07023b2358e3bb049c5e9ccc08532dd090",
        firstAuditRecordDigest:
          "fe8a1cdd7c63bf1787885e20bd4ed892710abd4901ba2920c423fa1e72eed5c7"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "15d7a2538b288b6fab94fe9be2136f3931080e1910fbc58dfe5af0cf66a4322b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:u.cm.ac":
          "a050b5caccabcdcafdaa6f253df9075a448ceb261e21cb36eb90c2bda6fe5c23",
        "OpenScriptures-HebrewStrong:H7786":
          "d7750f239ef9a5089703b03b2b75849bf8f15601111af05eef965b126b142fe7",
        "OpenScriptures-LexicalIndex:moi":
          "c2853629070a64ca95f191f7ce68b1c2d06ea82155b309a648475250ffd81f23",
        "STEP-gloss-anchor:21499":
          "6bb31b33e021fbd54d750e1d81424f07023b2358e3bb049c5e9ccc08532dd090"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "83d509f8c7199a96f76a92e43e2ad70844db028ed0b8d2c8745b71621bb9e883"
      }
    },
    {
      key: "H7802",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21516,
        eStrong: "H7802",
        dStrong: "H7802 =",
        uStrong: "H7802"
      },
      input: {
        rawHtmlDigest:
          "3fa1022af5516ef238a2561ca1ed2df05025a9aeab963c026dbfbdae6146bbce",
        rawAssertionDigest:
          "b11a04b5392780e6445c9f91568642b535b9701b79d2c3ebeb77cb0dabd7607f",
        auditRecordDigest:
          "fa43847998ae49480f4918d05c99817f38bf320221f2a122fbfac60a76cbc6f1",
        candidateRecordDigest:
          "6b59274c12934822f9291f3a045a808864b2e24a6c5b7065982bf683c258ff82",
        stepAnchorDigest:
          "4043c1a372a7e88c845c773fae24f500cf95a170e8a817b69da4e8cc4cae7840",
        firstAuditRecordDigest:
          "3bb12b3474e86a1f23a09c229b8620081a450464b42e3a8f0ecf6f09259a6094"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "3fa1022af5516ef238a2561ca1ed2df05025a9aeab963c026dbfbdae6146bbce",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:21516":
          "4043c1a372a7e88c845c773fae24f500cf95a170e8a817b69da4e8cc4cae7840",
        "STEPBible-TIPNR:H7802:entity:4209":
          "de3fee9e34d1b33e1cd3873e1ae917f1328602b17961e28ef29b1656fab5df78"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "675e17875d0be31ecbe49ee3cf725f5b8e50665f1cb633966ea1eac722595be4"
      }
    },
    {
      key: "H7804",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21519,
        eStrong: "H7804",
        dStrong: "H7804 = in Aramaic of",
        uStrong: "H7725G"
      },
      input: {
        rawHtmlDigest:
          "27e0c5d4c856dbcd403d89017fc55ce62a94011340182d82a548d347ff0bccfe",
        rawAssertionDigest:
          "a42d71b3a7d99e6867807a2384f396d62bb735f8aacf1662bc9411bebfa3f044",
        auditRecordDigest:
          "14db19dd0b9475e7bb74baa7151b56dafc77825664438ce9538462d9addcd820",
        candidateRecordDigest:
          "cac5f2b73c815cf16900dd15f47d1cff4dfba79f19e7f0753ba490eae0d56dd3",
        stepAnchorDigest:
          "e44a1eef9da1c9b2ee61d5cef59dc66871b0cb7f679ea1616dd9b4d9d1efdfdc",
        firstAuditRecordDigest:
          "d4139925b70088e47f26bcead8515d7c095c6bdf777d3bd08dc02149328f810c"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "5a0e95066e26ec0fee0ddf8ac6072cda1d7988d7764b0241dee1c58b41339fef",
        reconstructionHtml:
          "<p><strong>To rescue/deliver:</strong> an Aramaic verb meaning to leave or free, hence to deliver or rescue.</p>",
        reason:
          "Nine exact occurrences support deliver/rescue; the disputed STEP relation to return is omitted."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:xv.al.ab":
          "b4420a6b429eac9b2f705b14967882118ba625430166560b3bef02196045baed",
        "OpenScriptures-HebrewStrong:H7804":
          "e57a54aec2833b515c3ae6dd4695a2535ca2ec2c3e05369a983402d34d22a929",
        "OpenScriptures-LexicalIndex:ozw":
          "ed47239c806b6b8f6b7a379a23b648e3f8248c7c81386ff8b1439b18d7f096a9",
        "STEP-gloss-anchor:21519":
          "e44a1eef9da1c9b2ee61d5cef59dc66871b0cb7f679ea1616dd9b4d9d1efdfdc"
      },
      occurrenceProof: {
        count: 9,
        occurrenceCorpusDigest:
          "50e4b01648bf020aa1b4c18827cb21b59aa4e09f68f8718bb49204f5f71add94"
      }
    },
    {
      key: "H7934",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21666,
        eStrong: "H7934",
        dStrong: "H7934 =",
        uStrong: "H7934"
      },
      input: {
        rawHtmlDigest:
          "6bd72a821ee4af3f649821b1268717fad2dc29201cae353ba0a5d29707cbd48c",
        rawAssertionDigest:
          "c891998f5314bc7c315f929441133bbb2cc378b2fd67cf7f0d09c941ec0f824f",
        auditRecordDigest:
          "f5cd57442efe089271c40785361071fafb9efba6c0ccdc674d1351f8650151b5",
        candidateRecordDigest:
          "919b926b087ef1d421f349e748f3506232a82ff8de25335836d02e2658aa38f7",
        stepAnchorDigest:
          "de9dbef7f632387a4433a3eca36d02b33810de8c580a225ff0620c262c135aa7",
        firstAuditRecordDigest:
          "cabd784cc6c637f9061b605d5ee63a6e95ff02171c2dc9d83fdbb74e6059fe40"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "6bd72a821ee4af3f649821b1268717fad2dc29201cae353ba0a5d29707cbd48c",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
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
      key: "H7954",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21695,
        eStrong: "H7954",
        dStrong: "H7954 = in Aramaic of",
        uStrong: "H7951"
      },
      input: {
        rawHtmlDigest:
          "42ffe5489797f0d439a6c93337b51edbba57bd251bd4a88362dc19bb19034ef2",
        rawAssertionDigest:
          "a42d802f57077e162713d264cb867d69de95fc27a614ccf6a23e5290e8baa62a",
        auditRecordDigest:
          "4a8cc7866fca467ffb547d9b38af2b9a39b25b7b9fc3800dd4ed45e68b4c3dfe",
        candidateRecordDigest:
          "b8d6568bcd7518496ef4cf54554e0a58656070997d8e04d1eb1aca15e88eab77",
        stepAnchorDigest:
          "4612fc500c1f955ee517354a6da233485276de3be84901d651003c8fb0df6c35",
        firstAuditRecordDigest:
          "633f3e81dd83aeece4ee0414a7f3aa295a70ee69752a6c79310a8d93795abe27"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "42ffe5489797f0d439a6c93337b51edbba57bd251bd4a88362dc19bb19034ef2",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H7951":
          "f0b375157eb4da321b15c194c12b1fd59526bc3a415b4eafe47731798bf269e9",
        "OpenScriptures-HebrewStrong:H7954":
          "25146ef5c350b222b3224eb19d48ead7d8bf5749912367a00a922d9b2bcb27cc",
        "OpenScriptures-LexicalIndex:pae":
          "2d121ad955fe645298215c60425520df3600c9a6c2c4a372573a272734f8db2a",
        "STEP-gloss-anchor:21695":
          "4612fc500c1f955ee517354a6da233485276de3be84901d651003c8fb0df6c35"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "e0d5212822fcab7a855c10fa1f41678cf3baf67e280ae2ec2065a16b51b37071"
      }
    },
    {
      key: "H8013G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 21785,
        eStrong: "H8013",
        dStrong: "H8013G =",
        uStrong: "H8013G"
      },
      input: {
        rawHtmlDigest:
          "467440bc41111daeb347addb44e98bd5cfdf8c14359ef30123cb6661671a1b7c",
        rawAssertionDigest:
          "059db933cd18a29569aca292ec6d6aeea72037be677fdd7f31d41a6bdd341f87",
        auditRecordDigest:
          "d7ea3176a95f60457298abf29eaff22c38fa2a0f8c15bd613df736767b392485",
        candidateRecordDigest:
          "84fda358cc62f9cb63b8694d810a8784738180b56322ed8bf04f77723a1cf362",
        stepAnchorDigest:
          "cbdd0b3290b1f020c171848309d5b15c314581e8a79d86a07a761738ecaaa913",
        firstAuditRecordDigest:
          "d7022af2734fa17a30e91aebc03da67f9dc991be798704e3faaa1706bd5f264b"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "dbef5c45e8d5cbe891f32105650525faf8cb723733c5a8522ab0690428a3f755",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:21785":
          "cbdd0b3290b1f020c171848309d5b15c314581e8a79d86a07a761738ecaaa913",
        "STEPBible-TIPNR:H8013G:entity:2603":
          "5e6689c2c75e222fc2cf98849265a016bf0bc8fd1316f9d5382a8228cce547ac"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "46eff3dce05e685cc75791cb24385786102e5b38767a749bd5eca58f16c6acbe"
      }
    },
    {
      key: "H8077G",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21886,
        eStrong: "H8077a",
        dStrong: "H8077G = a Name of",
        uStrong: "H3389"
      },
      input: {
        rawHtmlDigest:
          "d6c9d0c9b08bf105f382a06210b16d64b5f001a0608162c46880ce71e7fad2d8",
        rawAssertionDigest:
          "60e176ad905c2e66934dee314f58d58fe094050356c1e06818bcd5ca54143808",
        auditRecordDigest:
          "070c6270a090be94f36419ff020e8fc8bf088a69674ad90908c4fd95e588b014",
        candidateRecordDigest:
          "849296b9f8dfabc20dba5c84e04f6037334ecf1a42f1ca6b8986a57037988a68",
        stepAnchorDigest:
          "8af9f5942e578d0d9164bdaabccc2118b56d2d2e1ad1107a7e0582d50e5f5901",
        firstAuditRecordDigest:
          "645f46cb670e9abfd965e7ffb118af96d343669eaecc390768cde8b449e6b841"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "d6c9d0c9b08bf105f382a06210b16d64b5f001a0608162c46880ce71e7fad2d8",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:21886":
          "8af9f5942e578d0d9164bdaabccc2118b56d2d2e1ad1107a7e0582d50e5f5901",
        "STEPBible-TIPNR:H8077G:entity:3661":
          "5b11506280b668a50e832a1fd63ea1c853d734f8c55e96cb3a88cf49d9fbea39"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "2afcab6c6a55f2b40a0ae3f51969603283a97b1db67c92968a44faf487550061"
      }
    },
    {
      key: "H8096Y",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 21935,
        eStrong: "H8096",
        dStrong: "H8096Y = a Name of",
        uStrong: "H8093"
      },
      input: {
        rawHtmlDigest:
          "fffd26399a6eb3c38dbdb2421e254eb977d03b96014b0d4471e93f611b25a580",
        rawAssertionDigest:
          "dd300f78dee3aa3991e0108aec5fb5295f1730739d434e3becdf4b223b11a3c7",
        auditRecordDigest:
          "37f7b5bc05c120be855b67d6727f2d07cc55cba2fd2df0a5793c9b3e815a300e",
        candidateRecordDigest:
          "8a67573c7cdec68f72b5987cd5573912f57d10acbf584485c088c2090a55ae85",
        stepAnchorDigest:
          "99aea5f49f70cbddea000d4430f643a1e6f44c7775e55ccba8695cceb36eb98a",
        firstAuditRecordDigest:
          "0393dece552aaaa9616d566283c2a6c3f4fde24e8fb1569dfcac451659b95849"
      },
      decision: {
        finalAction: "publish_step_specific",
        selectedHtmlDigest:
          "40cbafa8ac17704ffecc009744181e79bdbe620aa97359d61907a788a760d681",
        reason:
          "Independent counter-audit confirmed that the exact STEP-specific section belongs to this entry and the legacy tail does not."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:21935":
          "99aea5f49f70cbddea000d4430f643a1e6f44c7775e55ccba8695cceb36eb98a",
        "STEPBible-TIPNR:H8096Y:entity:2677":
          "37e72c5484547d4ab3a7590d06ffe0dc9c0e30c0303689f9c6cb209ec553ed2f"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "92b96cd1dd3e876dc3908c040f702c1b6636eea88df1cb3e91275e72bac58e64"
      }
    },
    {
      key: "H8101",
      counterAudit: "raw",
      identity: {
        stepEntryId: 21965,
        eStrong: "H8101",
        dStrong: "H8101 =",
        uStrong: "H8101"
      },
      input: {
        rawHtmlDigest:
          "ecf3bb5adfb235c3cdb55dc31d1f8a2445126d3a3183a3c60360fe5df686cb8b",
        rawAssertionDigest:
          "4315bdbfd2f77110694c5c23c45df78ee7e1dbdb4c1f9ef692172412bdc89c4a",
        auditRecordDigest:
          "359e5fde5cec7295004b42f1a6bd7d7c03de2d117fa2c4d933dd62e28cc088fd",
        candidateRecordDigest:
          "edc713d9f5f0b488b92fbc38d6786556fcc6cc71f203d5df5a91565f50fa6916",
        stepAnchorDigest:
          "bb61196b74a1187e6c0ddd40dc56a33a1693b16126f042265fc07d486d5433f0",
        firstAuditRecordDigest:
          "9bc4c11969d8780e2d368bd9bdc4488d285dd768c291e21a2688d8eb1db84ac6"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "ecf3bb5adfb235c3cdb55dc31d1f8a2445126d3a3183a3c60360fe5df686cb8b",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H8101":
          "032b4823ba632e19a98d35ab2349c99501aa9b70b1b73694e84ad5ffa265836e",
        "OpenScriptures-LexicalIndex:nay":
          "6c5e4d2318eca2731da5c6ab1fe3e4b7616a7cbf988d71691faa6620195a6ae8",
        "STEP-gloss-anchor:21965":
          "bb61196b74a1187e6c0ddd40dc56a33a1693b16126f042265fc07d486d5433f0"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "9a8f487258c7b9863977b4a0d9b71824d9fb8a42163d44161d57542651270b1b"
      }
    },
    {
      key: "H8472",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 22423,
        eStrong: "H8472",
        dStrong: "H8472 =",
        uStrong: "H8472"
      },
      input: {
        rawHtmlDigest:
          "b42c79d954faf92db85fa4d418d79b683154f41082e00e29ef465a1bc52079e5",
        rawAssertionDigest:
          "12739b7646d00ed5051a9e2a965cb275211e24e98c6cf06a52025ee7c4751e4d",
        auditRecordDigest:
          "1de127c9d24a3760453a06792aaf33e83b5b8fa436afd9337c0a7bcb18242811",
        candidateRecordDigest:
          "615d1e16acbf6fc895c0ce347ed66a88ab7a91c362ff16563b0361e26e890724",
        stepAnchorDigest:
          "8528962bd759a4cf4e619f375d619fa439c7d1ef511250c3de324f5ef9b66bdb",
        firstAuditRecordDigest:
          "c47f7893790854dd333bfedfebb912fbba67f00d8178861d10270de9ab22b8ff"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "1745323c082afa14eee37f4f6f28886c81df44e2188f10980e53dc189bda1630",
        reconstructionHtml:
          "<p><strong>Tahpenes:</strong> an Egyptian queen, wife of the Pharaoh who sheltered Hadad; her sister married Hadad and bore Genubath (1 Kings 11:19–20).</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:w.am.ao":
          "b7da4b8f5df79583ad706a5357ad646e42081f8cf515bf989defc2e59623074d",
        "OpenScriptures-HebrewStrong:H8472":
          "d59c5b926704dfc3e43d215d11d5b835682a1abc094c9f11a4b8584897fe6994",
        "OpenScriptures-LexicalIndex:nqv":
          "a22e72ec5889121baa71c5ae55d43048ba53f2073f43e0d6bca83c170dd4aefc",
        "STEP-gloss-anchor:22423":
          "8528962bd759a4cf4e619f375d619fa439c7d1ef511250c3de324f5ef9b66bdb"
      },
      occurrenceProof: {
        count: 3,
        occurrenceCorpusDigest:
          "d8ed1a59b3de1d06a57373e1bb4948075142a202a45318f837563761831bd7ad"
      }
    },
    {
      key: "H8501",
      counterAudit: "raw",
      identity: {
        stepEntryId: 22463,
        eStrong: "H8501",
        dStrong: "H8501 = a Spelling of",
        uStrong: "H8496"
      },
      input: {
        rawHtmlDigest:
          "ba9ac8528d0a56fd784273b3208cd37da3cd2983c5bdc4b98037e454a8503215",
        rawAssertionDigest:
          "467af96b194b411d82bab81068a75ff8344b9626cc1d2cbf9bfb30d44a9371f7",
        auditRecordDigest:
          "c4314ab3e40c627675e3f4bd2fb5cb3e56935f1834b2fd62c889709d2c107357",
        candidateRecordDigest:
          "70f972c1335691e8cbf02a97cf081c90e96a9777169bca2345ea93bf1ba1871d",
        stepAnchorDigest:
          "a683edd922328c3ea49ace848223cd4e906686e5edc09e55ae2f8e91ee66b9f0",
        firstAuditRecordDigest:
          "db81657ff72b78f1fc0ccb3b4276c411837872a52869e6faada50d02c0c56b2b"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "ba9ac8528d0a56fd784273b3208cd37da3cd2983c5bdc4b98037e454a8503215",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:w.ap.ab":
          "3a48b3147107cc347fb5df818f04653282884ae742a90d2c630ab1210000c3e0",
        "OpenScriptures-HebrewStrong:H8496":
          "36aaf61a15a3a245ba2aeec33d3a4b9433b064ce894d95383079e91ce860915f",
        "OpenScriptures-HebrewStrong:H8501":
          "79ee2512999f1a2292777de6d134b574bea0fdb42d01f04b1f946e1abdaaaf72",
        "OpenScriptures-LexicalIndex:nrt":
          "fdb61bd0bc4256f0ec478bd58d2ac90d56677f8c0438881ee9330211d6d3216f",
        "OpenScriptures-LexicalIndex:nry":
          "0dcec2a3d4ff1d6abb612d00b9b8c697dc35d4287f7bc5fc45eeac9e3569e997",
        "STEP-gloss-anchor:22463":
          "a683edd922328c3ea49ace848223cd4e906686e5edc09e55ae2f8e91ee66b9f0",
        "STEP-relation-graph:22458":
          "ee2dbf0e2a51a3ad1f6e5c35dbad68c211df8e4615ee4cbb30c047026da5b5e5",
        "STEP-relation-graph:22463":
          "b6f3860a32fdaa97c5a2b3fbabc8adca362ef171d39184bfff4f0c2253461641"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "af969174639033153acf6849caddb16cd5f7dbd8e7b5721a16e247bda67e5bb2"
      }
    },
    {
      key: "H8555G",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 22523,
        eStrong: "H8555",
        dStrong: "H8555G =",
        uStrong: "H8555G"
      },
      input: {
        rawHtmlDigest:
          "32242b65d109cb3b466894ed64afbab668b9900bcdd6dd5e209321e603e2c829",
        rawAssertionDigest:
          "220dceaf82d3752cf1703eb6c46e97b7bdbf60f75c48eeb42f6fddf95497cf71",
        auditRecordDigest:
          "0f6bc3b838455837defaa346b95b0849ff5a298ed3bb3c67ca93c1a6e9de2164",
        candidateRecordDigest:
          "5a0dbce25537606fc6cdeb90ac2641d19f601c61e3b6da4c13d4f625edad2eb5",
        stepAnchorDigest:
          "83ebd0b4fa0a399d816554db5109274cbe5aa64510877a4192821a9b11265152",
        firstAuditRecordDigest:
          "3785b63b28f64858429f393189e5492bba6fafafef4764e302cdb80b19613860"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "3b55c88a84726897845271446e0942912fe98b955a9a804625f1536d5ee95dd0",
        reconstructionHtml:
          "<p><strong>Timna:</strong> Eliphaz’s concubine and Amalek’s mother in Genesis 36:12. Current STEP merges this legacy sub-entry into H8555.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H8555":
          "33205bd6543b4dce3b3266077dcbacaddd3778cd50cdea7ed7e63d814e60b0d2",
        "OpenScriptures-LexicalIndex:nty":
          "464e954acae011d63ff6fe2b561197ca337d710b5f9f63cdfc4b16a8763b0333",
        "STEP-gloss-anchor:22523":
          "83ebd0b4fa0a399d816554db5109274cbe5aa64510877a4192821a9b11265152"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "b8a8a244e7dc888debbd86741a70653aa779500d386f692ce348031ec80dacf5"
      }
    },
    {
      key: "H8555H",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 22524,
        eStrong: "H8555",
        dStrong: "H8555H =",
        uStrong: "H8555H"
      },
      input: {
        rawHtmlDigest:
          "4a17e938f34f41f2e48c5e06ee22356f1351ab151206021041d85ad2abb17970",
        rawAssertionDigest:
          "39837466b01be4ed87c1fd0486e91e6e341dc7da37f8078a45e23a0e120591d1",
        auditRecordDigest:
          "24cf74d45b370839c30e5e3e5a78e5fb8b3639fdce38cff8d6aedc599ab82449",
        candidateRecordDigest:
          "32622e2b67a3445e76f120afe02241b4633683d1cf2372561739723757ac3780",
        stepAnchorDigest:
          "83ebd0b4fa0a399d816554db5109274cbe5aa64510877a4192821a9b11265152",
        firstAuditRecordDigest:
          "2fa675d361dec64ad6e8809c3f8ee3debf11285dc0ddc8c5319b0f7e2b59f340"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "a1fc3218a56b520440ad44a57dc6644618c6022588e2e08098db3d4d4c32d622",
        reconstructionHtml:
          "<p><strong>Timna:</strong> Lotan’s sister in Genesis 36:22, within the genealogy of Seir. Current STEP merges this legacy sub-entry into H8555.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H8555":
          "33205bd6543b4dce3b3266077dcbacaddd3778cd50cdea7ed7e63d814e60b0d2",
        "OpenScriptures-LexicalIndex:nty":
          "464e954acae011d63ff6fe2b561197ca337d710b5f9f63cdfc4b16a8763b0333",
        "STEP-gloss-anchor:22524":
          "83ebd0b4fa0a399d816554db5109274cbe5aa64510877a4192821a9b11265152"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "bf89b4d0e102db9e4b286021cf35a957fc7caafa4b2cc09da988c638950444c7"
      }
    },
    {
      key: "H8555I",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 22525,
        eStrong: "H8555",
        dStrong: "H8555I =",
        uStrong: "H8555I"
      },
      input: {
        rawHtmlDigest:
          "f088783ee4e3db57e914293f0126ebf063446abfac086d3cfda1b127376d34a8",
        rawAssertionDigest:
          "0d3189cb0494aa9d51545bed7b9fa998a501769387fd2396d1002762e0f89988",
        auditRecordDigest:
          "9be63e9849970514a2e91ccdc0bd7fcdf0960046af2c20238554fee62d78d199",
        candidateRecordDigest:
          "f89ce72832d7485f4da773d7d1ad89b3465bae8631bc9485bb9f74f6e6b33e94",
        stepAnchorDigest:
          "a2eab6ad30558d753be1433888615ba6a3f72ccf8526d041e1d860f80ff53cf1",
        firstAuditRecordDigest:
          "af3e0a4d287d19cdba5921d6daf527e58a6eeade0945c4941b61f0068460b252"
      },
      decision: {
        finalAction: "editorial_reconstruction",
        selectedHtmlDigest:
          "30638a26fa6d02d4ffe59e3a1c9aeeef49c076884bdf88ff29cf41f1e82f2534",
        reconstructionHtml:
          "<p><strong>Timna:</strong> a name in the list of Edomite chiefs or clans in Genesis 36:40 and 1 Chronicles 1:51. Current STEP merges this legacy sub-entry into H8555.</p>",
        reason:
          "Independent counter-audit replaced a factually wrong, fused, or obsolete sub-entry notice with a minimal evidence-bounded notice."
      },
      exactSourceAttestations: {
        "OpenScriptures-HebrewStrong:H8555":
          "33205bd6543b4dce3b3266077dcbacaddd3778cd50cdea7ed7e63d814e60b0d2",
        "OpenScriptures-LexicalIndex:nty":
          "464e954acae011d63ff6fe2b561197ca337d710b5f9f63cdfc4b16a8763b0333",
        "STEP-gloss-anchor:22525":
          "a2eab6ad30558d753be1433888615ba6a3f72ccf8526d041e1d860f80ff53cf1"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "7cf2389654bec16d6191b0b3834b00ac71ac155d38509b72edff24639236e88e"
      }
    },
    {
      key: "H8559K",
      counterAudit: "nonraw",
      identity: {
        stepEntryId: 22534,
        eStrong: "H8559",
        dStrong: "H8559K = a Name of",
        uStrong: "H8412"
      },
      input: {
        rawHtmlDigest:
          "fb28b4a415db112c1c0e33c44af0dd4bf424f3f45ce1f134c07992dcdf6c7563",
        rawAssertionDigest:
          "108fe3c266f42f9e209a7617bc8e3d69f0f756c78755ca43604883e23c54852f",
        auditRecordDigest:
          "9824ff65bd580935fa0875047250a7ccffda3af306d93b5c92d8bd0bd60f9092",
        candidateRecordDigest:
          "b9fa707df322b66181e6935495d0af8291df20b057926305f7e53d4de883c071",
        stepAnchorDigest:
          "4fa9a4c50d48da019286afc9d7b963ee733d7eb54bd3fc59d730a53b181cc211",
        firstAuditRecordDigest:
          "037283df39789791dbb3b897215775ab4d982cbc53a1ac2e7c7e170c9d236f2a"
      },
      decision: {
        finalAction: "replace_exact_companion",
        selectedHtmlDigest:
          "7e2561f74cfae697640ffe3550097a5b37aa3ccdafa92e5ce8755be9bdf0efe5",
        reason:
          "Independent counter-audit selected the exact corroborating companion over the conflicted STEP notice."
      },
      exactSourceAttestations: {
        "STEP-gloss-anchor:22534":
          "4fa9a4c50d48da019286afc9d7b963ee733d7eb54bd3fc59d730a53b181cc211",
        "STEPBible-TIPNR:H8559K:entity:4030":
          "4368d9352c89a83e26a81870f5ea3f658903d7a688c85110c77c5c13d91a5f35"
      },
      occurrenceProof: {
        count: 0,
        occurrenceCorpusDigest:
          "0bf9ee4eb6f4b766bded379dd08f01f87fed23392de9d02bc091b120118080e0"
      }
    },
    {
      key: "H8654",
      counterAudit: "raw",
      identity: {
        stepEntryId: 22644,
        eStrong: "H8654",
        dStrong: "H8654 =",
        uStrong: "H8654"
      },
      input: {
        rawHtmlDigest:
          "3ee1970eec508917952ee7a7690eab487e45c61c78ae48f1ac2dc209e4b77dd1",
        rawAssertionDigest:
          "66bb786b6db6b917612b3ab32d1e4198182a06c82b780541b8d352edafc44d14",
        auditRecordDigest:
          "9c489b446be675f1f9c02de86ed79df685da3428bc7b3eeaccf594e974f8f923",
        candidateRecordDigest:
          "d3e1a10e526bcbb8e9162b6b24c983094e9065c98fe32b0a79060bc0a8495683",
        stepAnchorDigest:
          "0c48721a06704315ca62b6a4483d075596f18aa6698238b68f74a71abfaf6e22",
        firstAuditRecordDigest:
          "1ee19e299f25cd7edf7c59242ba09f5f301cb7b6b41a45103a58d09ab566bae3"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "3ee1970eec508917952ee7a7690eab487e45c61c78ae48f1ac2dc209e4b77dd1",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:w.bq.at":
          "eea8a0b022a54ecc36811e4b1f0a1c8ee5f5f7e9fe4d079b3f45a485b6a350dc",
        "OpenScriptures-HebrewStrong:H8654":
          "2a927d3e483fcfbdfae2f6a0d05f23fa4ea3f20528dc57c2539030633ce9a980",
        "OpenScriptures-LexicalIndex:nxz":
          "d4813471a104c1578159b3277e3af75e7be648284d3ee185efbb2271d41f17ed",
        "STEP-gloss-anchor:22644":
          "0c48721a06704315ca62b6a4483d075596f18aa6698238b68f74a71abfaf6e22"
      },
      occurrenceProof: {
        count: 1,
        occurrenceCorpusDigest:
          "1b5ff04ec4ec6517d26cc83af8dfeb45c6742d4ada92a79659b860d265249477"
      }
    },
    {
      key: "H8660",
      counterAudit: "raw",
      identity: {
        stepEntryId: 22653,
        eStrong: "H8660",
        dStrong: "H8660 =",
        uStrong: "H8660"
      },
      input: {
        rawHtmlDigest:
          "606e3c5a4861637914e8fea002eb3d5f92da88434221714fd000eaa8c53090d1",
        rawAssertionDigest:
          "02b3890aee793c90a6a2f225a24856c460941f72a3674f2583dab22b3195850f",
        auditRecordDigest:
          "e2f8d7524ed2e8ce9426ac9ed9d12a30aaca9333d8b71a9627528f42a9526153",
        candidateRecordDigest:
          "2db6c12bbc748c9bff9721b17cf0ebb8b009e26a1a88cfaffe67f95d4cecc4a6",
        stepAnchorDigest:
          "723075acbc4538bcf1017925cec2f34bc7f3e66d5617f6b37f06517122b2a9ca",
        firstAuditRecordDigest:
          "e36cd4e7eeab5e14147d133e3ef7139685254aeb697200250f3fc59fe508df3c"
      },
      decision: {
        finalAction: "keep_raw",
        selectedHtmlDigest:
          "606e3c5a4861637914e8fea002eb3d5f92da88434221714fd000eaa8c53090d1",
        reason:
          "Independent semantic audit confirmed the complete STEP notice for this exact entry."
      },
      exactSourceAttestations: {
        "OpenScriptures-BrownDriverBriggs:w.bq.az":
          "c057b3bb43c214f19d4e56520701b8ad6c881c20b75d19414c7d702359567015",
        "OpenScriptures-HebrewStrong:H8660":
          "1ff10b6b5d4255ceafa68a8b9732d2a06e41b106f61f561c51bccf750a10061f",
        "OpenScriptures-LexicalIndex:nyf":
          "6ac49e19da87deaedec170b5ae05ed1d2e843a3107f8866661c7c026173d2b5a",
        "STEP-gloss-anchor:22653":
          "723075acbc4538bcf1017925cec2f34bc7f3e66d5617f6b37f06517122b2a9ca"
      },
      occurrenceProof: {
        count: 5,
        occurrenceCorpusDigest:
          "e1b440cf321e91d82f354136a219b6e9b19d7fd0d96d31d718d3defc66404320"
      }
    }
  ],
  registryDigest:
    "f088e435398d2ee86b55d7a4fe65b5047596470125b6bfeebcec81fadd956c75"
} as const;
