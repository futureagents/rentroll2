// Shared formatters (CLAUDE.md §5). Client-safe; imports nothing from src/server.
export {
  formatRupees,
  formatRupeesInWords,
  formatRupeesShort,
  groupIndian,
  numberToWordsIndian,
  parseRupees,
} from "./money";
export { formatDate, formatDateCsv, formatDateTime, formatMonth } from "./date";
export { formatPhone } from "./phone";
