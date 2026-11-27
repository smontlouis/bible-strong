# Paratext versification tables

`eng.vrs` and `org.vrs` are copied unchanged from SIL's libpalaso,
`SIL.Scripture/Resources/eng.vrs.txt` and `org.vrs.txt`, at commit
`52360e007d7b92b613189bf7ea0e3cba161467e5` (the files' last change is
`f1f70e93a79d55b1769a4e20fb36047f2fa08d99`). They are distributed under the MIT licence in
[`LICENSE`](./LICENSE), copyright SIL Global.

`vul.vrs` (Vulgate, version 1.5) and `lxx.vrs` (Septuagint, version 1.7) are copied unchanged
from the United Bible Societies' `ubsicap/versification_json`, `examples/vul.vrs` and
`examples/lxx.vrs`, at commit `0833abd5252e810fc76e80919a3109ed9c9cc3ae` (the files' last
change is `71c66cb6ddfa6158919bc9798d124141a8168b14`). They are distributed under the MIT
licence in [`LICENSE-ubsicap`](./LICENSE-ubsicap), copyright 2019 United Bible Societies
Institute for Computer Assisted Publishing.

Only the 66 books of the Protestant canon are read. A verse these tables map to another book
(`DAN 3:24-90 = S3Y 1:1-67`) has no equivalent.

Do not edit them: a difference from our Bibles goes into an overlay under `../bible-strong/`.
After replacing one, run `yarn workspace @bible-strong/resource-domain versification:tables`.
