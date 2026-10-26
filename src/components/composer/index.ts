// S-01 · Public surface for openers (L-03, L-04, L-05, S-02). Openers render <MessageComposer>
// with a target id and nothing else; the server functions, hand-off and message writer are not
// exported (tests/composer/single-send-path.test.ts).
export { MessageComposer, type MessageComposerProps } from "./message-composer";
export type { ComposerTarget } from "./types";
