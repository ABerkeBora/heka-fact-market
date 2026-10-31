# Third-party source

`server/airnode.ts` and `contracts/vendor/{AirnodeV2Attestation,ProjectedJson,IsoTimestamp}.sol` derive from the official API3 AirnodeHub hackathon starter, commit `52933ae1fb9371446a927338473466c3d320e19a`, MIT licensed:
https://github.com/api3dao/airnodehub-hackathon-starter/tree/52933ae1fb9371446a927338473466c3d320e19a

The upstream license is preserved at `contracts/vendor/LICENSE`. Contract dependency revisions and licenses are listed in `contracts/vendor/PROVENANCE.md` and `lib/README.md`. Vendored OpenZeppelin, Solady and forge-std retain their license files. There are no live imports of another Heka project's source.

JavaScript dependencies are pinned in `package.json` and the npm lockfile. Geist is loaded from Google Fonts; platform fallbacks remain available if the font service is offline.
