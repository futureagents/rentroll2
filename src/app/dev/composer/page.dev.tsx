// Development-only (`.dev.tsx`, ignored by `next build`). S-01 composer with fixture context at
// /dev/composer, for checking layout and the hand-off flow without a database.
import { ComposerPreview } from "./preview";

export default function DevComposerPage() {
  return <ComposerPreview />;
}
