export const AUDITED_TBESH_SECTION_SOURCE_DIGEST =
  "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31";

export type TbeshSectionLedgerCategory =
  | "verified_context"
  | "foreign_sibling"
  | "source_conflict"
  | "empty_tail";

export type TbeshSectionLedgerUnreviewedReason =
  | "tbesh-digest-mismatch"
  | "entry-not-reviewed"
  | "raw-html-digest-mismatch";

interface TbeshSectionLedgerRecord {
  category: TbeshSectionLedgerCategory;
  rawHtmlDigest: string;
}

export interface TbeshSectionLedgerEntry extends TbeshSectionLedgerRecord {
  entryKey: string;
}

export interface ResolveTbeshSectionLedgerInput {
  entryKey: string;
  rawHtmlDigest: string;
  tbeshDigest: string;
}

export type TbeshSectionLedgerResolution =
  | {
      reviewed: true;
      category: TbeshSectionLedgerCategory;
      entryKey: string;
      rawHtmlDigest: string;
    }
  | {
      reviewed: false;
      category: "unreviewed";
      entryKey: string;
      reason: TbeshSectionLedgerUnreviewedReason;
    };

const TBESH_SECTION_LEDGER = {
  "hebrew:H0144": {
    category: "verified_context",
    rawHtmlDigest:
      "1c325baa4ab8f8c0ce89e8035851d2053d1215d100d5813491468d4dbae7faad"
  },
  "hebrew:H0516": {
    category: "verified_context",
    rawHtmlDigest:
      "7d9dc45bec8ec1615cb5ca9cca45d08756a3ed28174cce1196f1ac894b3a9816"
  },
  "hebrew:H0762": {
    category: "verified_context",
    rawHtmlDigest:
      "a69d3a3edb9e28598687d1deb640ee850b2bf42a612e77daaf78cdf0fad62afd"
  },
  "hebrew:H1121G": {
    category: "verified_context",
    rawHtmlDigest:
      "349971a3634b589c7e88e3e697cfb52c34c297079ce341f38558ccf9838d97d6"
  },
  "hebrew:H1121H": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "dd136b97f8293fd54f26e7c6f4828ff56ec13b71ea010d1ff1fb10d30ffcd8b8"
  },
  "hebrew:H1121I": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "80579ba1799b721a39e207b289a04f91f5d1c98c1d9960524a543b1b18b2048c"
  },
  "hebrew:H1166H": {
    category: "verified_context",
    rawHtmlDigest:
      "1fcb5cdff9a3e12b1948421b49df8d4adbaef3f4e4a1d98922e38f534b7f6b93"
  },
  "hebrew:H1419A": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "e2e3f728b1fbace83b7ec4c8453cfef359bb2c0fc36aa29e763c018a0f6e1e8c"
  },
  "hebrew:H1419K": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "2ef1428c1090657427222858bc97c8eb95c28672fa8aca5154b25ec0bfdaf2e5"
  },
  "hebrew:H1516K": {
    category: "verified_context",
    rawHtmlDigest:
      "9c541db1495328a8106a2cf75a10d60c020484bbf026b109115541009d205c39"
  },
  "hebrew:H1516M": {
    category: "verified_context",
    rawHtmlDigest:
      "9c541db1495328a8106a2cf75a10d60c020484bbf026b109115541009d205c39"
  },
  "hebrew:H1516O": {
    category: "verified_context",
    rawHtmlDigest:
      "9c541db1495328a8106a2cf75a10d60c020484bbf026b109115541009d205c39"
  },
  "hebrew:H1902G": {
    category: "verified_context",
    rawHtmlDigest:
      "b1342e281613fffbd045cd30f91d95ab81287f7d6bd3296e252a4526e16c171a"
  },
  "hebrew:H2256M": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "cdbf57c75d24a0e5cf4a69770a929109966990dd1922ff7c1017c1da0102a8bf"
  },
  "hebrew:H2319G": {
    category: "verified_context",
    rawHtmlDigest:
      "110c6fb5ea3b0e8a31159f44035a77e958f184e5b7cbc8e5713facc02554c2c9"
  },
  "hebrew:H3066G": {
    category: "source_conflict",
    rawHtmlDigest:
      "5652709dcc439e9ba9513aa1111dccce2bcb74386ac9b369abe7524fea15943b"
  },
  "hebrew:H3066H": {
    category: "verified_context",
    rawHtmlDigest:
      "0b692cb9fbb3551d5991ffccc1cca5254c42a3f140b346782fe931db0b9b0abe"
  },
  "hebrew:H3128": {
    category: "verified_context",
    rawHtmlDigest:
      "8f5a2330952676c525028392d31a507c0198bd7388c5939cc12542bcb1a31690"
  },
  "hebrew:H3277G": {
    category: "verified_context",
    rawHtmlDigest:
      "f8e83009fb95040f750652b853388305d377c95c9ee299466db6481d7117b082"
  },
  "hebrew:H3293H": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "e764ec834726b623304d59320d937d9c7dcd0492103c5fcbb65339761fcb11f0"
  },
  "hebrew:H3293I": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "c032a7e19f30071fcd6fc4ec01f1608b834332f1e3d717846d123b2b7dc68006"
  },
  "hebrew:H3452G": {
    category: "verified_context",
    rawHtmlDigest:
      "611765d62ac700a42f4c4672d44cb1c8c8ae995548a86a40b7e76b113e008639"
  },
  "hebrew:H3723G": {
    category: "verified_context",
    rawHtmlDigest:
      "6d0e3a93c5afcad99ed5a50db0fb1004f2cfb7cc3b594b3904b3652b3156928b"
  },
  "hebrew:H3820B": {
    category: "verified_context",
    rawHtmlDigest:
      "07ba08336c43e97760aebf8fc430917bb3f6a90578f784ecd1dd512f22a24c5f"
  },
  "hebrew:H3879": {
    category: "verified_context",
    rawHtmlDigest:
      "4a8200fbe506d5079f655ce4926159d6020d5e885a710157dd1a9ff71e3cc165"
  },
  "hebrew:H4417H": {
    category: "verified_context",
    rawHtmlDigest:
      "1ae31a133ac3470c190c2a052139ff38c31c528f430be9b0bc70895771574dd0"
  },
  "hebrew:H4428H": {
    category: "verified_context",
    rawHtmlDigest:
      "99a8fa839acd8dd91021c869e0f3520e0f57e02c3e2c3aed613e6af4e5b7a956"
  },
  "hebrew:H4430": {
    category: "verified_context",
    rawHtmlDigest:
      "37a77ea4ba4ce0c7704d8d5de3ca830de0b3711d5010b026ca282151e2916883"
  },
  "hebrew:H4436G": {
    category: "verified_context",
    rawHtmlDigest:
      "a1fc5de85fb3c77108599a285bf302a31d19bfcfecd14bc46642151caef6ab35"
  },
  "hebrew:H4566": {
    category: "verified_context",
    rawHtmlDigest:
      "bbc3548f21960377a36a6997b77014232f4d6f8f2dcfc93b8d7eb61ce4e28860"
  },
  "hebrew:H5081G": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "cb4a9a619699a568808e94b6765499159d5530f54831d8895c5f6663351cf462"
  },
  "hebrew:H5158G": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "99493d281c3393f536ba03e30d82763a97777ea5b2a217aae03d59a40780248c"
  },
  "hebrew:H5158H": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "b20be7248b493f6e9ff9169cbdece7727084a0ee7efcb6cb6a1d598fae84b205"
  },
  "hebrew:H5158I": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "99d8772c121eeaf20a0d3710d82998ae631fcbd68345e098ab686047a0891f5e"
  },
  "hebrew:H5158J": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "e41c883c0dc2afea56fd049d4347c860c5f0d076fec3060eb110d24d4871c12b"
  },
  "hebrew:H5158K": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "99493d281c3393f536ba03e30d82763a97777ea5b2a217aae03d59a40780248c"
  },
  "hebrew:H5168": {
    category: "verified_context",
    rawHtmlDigest:
      "46083d42f7a853e33436e09e26185d51126fca529bd305f7d4c409eec14fe668"
  },
  "hebrew:H5451": {
    category: "source_conflict",
    rawHtmlDigest:
      "8678ad596c98632e644733d34e8da6d22377687c551ed12a2afedc53f127cd89"
  },
  "hebrew:H5542": {
    category: "verified_context",
    rawHtmlDigest:
      "90d318f25e7354a1b0c29381b9a97e3a1b4b6f1a8eacf68516302fae253425bd"
  },
  "hebrew:H5697B": {
    category: "verified_context",
    rawHtmlDigest:
      "19437e676ded501a7e6afd4e117ecc7982f612b720a111cbff5250e0b3d08644"
  },
  "hebrew:H5869B": {
    category: "verified_context",
    rawHtmlDigest:
      "1b3d8367033b2d83e5c3cfc005c262f9c000b993ae44ae11f28516b34a0157e1"
  },
  "hebrew:H5869G": {
    category: "verified_context",
    rawHtmlDigest:
      "1b3d8367033b2d83e5c3cfc005c262f9c000b993ae44ae11f28516b34a0157e1"
  },
  "hebrew:H5945G": {
    category: "empty_tail",
    rawHtmlDigest:
      "ee0fb978a2a6cd0ae32e25c0f15a1e6c71fdf9015d06c91753329c117e4c31c9"
  },
  "hebrew:H5971G": {
    category: "source_conflict",
    rawHtmlDigest:
      "62dd2e05837d751e9b5059218efd486ce54f3e2179e8980f6caed098f21e1fdb"
  },
  "hebrew:H5971H": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "d5108e4612e8b4f84b7fe2eb56cf7096cb3f99b95731a06c87dde76d59117907"
  },
  "hebrew:H5971I": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "208ea214b0bebfac3a6a88c9cd6936bc26374b457af83c907f29e6f09a3e4ecc"
  },
  "hebrew:H5978": {
    category: "verified_context",
    rawHtmlDigest:
      "7dcca214d9892a49d7ef2f32bbe0520beb1f92a5dc00c38289009521246988ae"
  },
  "hebrew:H6010G": {
    category: "verified_context",
    rawHtmlDigest:
      "23a5c8dec7393a997feba63151017a33dbbf6989812c4d47ac4ef6b5fff5be12"
  },
  "hebrew:H6010H": {
    category: "verified_context",
    rawHtmlDigest:
      "a6a0c9a323af7f1edd3806190d275f44c53d1a71a90f97e3867d17e862a36dc5"
  },
  "hebrew:H6010I": {
    category: "verified_context",
    rawHtmlDigest:
      "3a8818ecbd0ac0f880d2feb3d7ef39ed87beac763485cfa2ea83f0c10ce8828b"
  },
  "hebrew:H6010J": {
    category: "verified_context",
    rawHtmlDigest:
      "1886d8d2731ec02aba7c4dbed875f6767351e92bbddff2f08545f784ad17fadf"
  },
  "hebrew:H6010K": {
    category: "verified_context",
    rawHtmlDigest:
      "bfeeef5296d739b914edad892c4b286bfc306d6c88d43e32af0f06ee5578916f"
  },
  "hebrew:H6010M": {
    category: "verified_context",
    rawHtmlDigest:
      "2d6a657198ad684777c7a1aa931a7b81487c1bc11cd10a61c968d22344a3f054"
  },
  "hebrew:H6010O": {
    category: "verified_context",
    rawHtmlDigest:
      "ccec2ba72a5ff72cc5049f67ada85b4334bf81b7c129022831c3c40359306048"
  },
  "hebrew:H6010P": {
    category: "verified_context",
    rawHtmlDigest:
      "8a90c9f2ef0093e2f9f9e36fd7c5c72c704c5c30bdb6509670499bc8de8a54fe"
  },
  "hebrew:H6010Q": {
    category: "verified_context",
    rawHtmlDigest:
      "dc3c0e77cadf0c0ed24f68c6a87e11e93ba0435ddc9dc618db7ddfd0936bb071"
  },
  "hebrew:H6154M": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "9bcbc4d4d3743848cf2112175c50ce4ab6901adf98ecd1b3d3755471c0015b59"
  },
  "hebrew:H6190G": {
    category: "source_conflict",
    rawHtmlDigest:
      "e953f814236cae139657e99879ad71cc95eb271304e7a6865e675cd85ac3be97"
  },
  "hebrew:H6332": {
    category: "verified_context",
    rawHtmlDigest:
      "a2afc0e6250ce5b813bcda8b37f1a31ded1c18e2e0b9f622f9bc57de9a7c4e19"
  },
  "hebrew:H6965A": {
    category: "verified_context",
    rawHtmlDigest:
      "00a2a526dc56f7164331967b1487e6788dbd8c6606357cf389813da986f2dd82"
  },
  "hebrew:H7227G": {
    category: "foreign_sibling",
    rawHtmlDigest:
      "f62026b833aeba84db9781101ec2e281662eaa0c131380bcea36c41ee7df39af"
  },
  "hebrew:H7342G": {
    category: "verified_context",
    rawHtmlDigest:
      "68bebde4649f12181b7c8a6e4a52789519db17d483ded000a30dc561f4218cb5"
  },
  "hebrew:H8481G": {
    category: "verified_context",
    rawHtmlDigest:
      "61a2156ca89a1b9f9f8ba27b2b3f5e1ecf9f8d897cc31d1bf9679653a7d59c7a"
  },
  "hebrew:H8550": {
    category: "verified_context",
    rawHtmlDigest:
      "49d30e991278689c983b52107135349a51040e7d4c71a0e39ea67e9ef5421dcd"
  },
  "hebrew:H8655": {
    category: "verified_context",
    rawHtmlDigest:
      "6dc813625657dae3ef5cc25209c9c8840d6a8f960950a2489f9f1b972873927f"
  }
} as const satisfies Record<string, TbeshSectionLedgerRecord>;

export const AUDITED_TBESH_SECTION_LEDGER_SIZE = 65;

/**
 * The exhaustive ledger establishes ownership of a non-empty STEP prefix for
 * these categories. `source_conflict` deliberately never proves publication.
 */
export function tbeshSectionLedgerProvesSpecificScope(
  category: TbeshSectionLedgerCategory
): boolean {
  return ["verified_context", "foreign_sibling", "empty_tail"].includes(
    category
  );
}

export function listAuditedTbeshSectionLedgerEntries(): TbeshSectionLedgerEntry[] {
  return Object.entries(TBESH_SECTION_LEDGER).map(
    ([entryKey, record]): TbeshSectionLedgerEntry => ({
      entryKey,
      ...record
    })
  );
}

export function resolveTbeshSectionLedger(
  input: ResolveTbeshSectionLedgerInput
): TbeshSectionLedgerResolution {
  if (input.tbeshDigest !== AUDITED_TBESH_SECTION_SOURCE_DIGEST) {
    return unreviewed(input.entryKey, "tbesh-digest-mismatch");
  }

  const record = lookupLedgerRecord(input.entryKey);
  if (!record) {
    return unreviewed(input.entryKey, "entry-not-reviewed");
  }
  if (input.rawHtmlDigest !== record.rawHtmlDigest) {
    return unreviewed(input.entryKey, "raw-html-digest-mismatch");
  }

  return {
    reviewed: true,
    category: record.category,
    entryKey: input.entryKey,
    rawHtmlDigest: record.rawHtmlDigest
  };
}

function lookupLedgerRecord(entryKey: string): TbeshSectionLedgerRecord | null {
  if (!Object.hasOwn(TBESH_SECTION_LEDGER, entryKey)) return null;
  return TBESH_SECTION_LEDGER[entryKey as keyof typeof TBESH_SECTION_LEDGER];
}

function unreviewed(
  entryKey: string,
  reason: TbeshSectionLedgerUnreviewedReason
): TbeshSectionLedgerResolution {
  return {
    reviewed: false,
    category: "unreviewed",
    entryKey,
    reason
  };
}
