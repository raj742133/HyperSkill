// The product lives here: message text, rupee and date formatting, safety rules.
// Rule: nothing in src/core may import I/O, HTTP or DOM code, so the browser page and the tests can share it.
export { parseAmountToPaise, formatRupees, parseDate, formatDate, daysBetween, MAX_RUPEES } from "./format.js";
export { validateInput } from "./validate.js";
export { generateMessages, findForbidden, FORBIDDEN_PHRASES, whatsappLink, mailtoLink } from "./messages.js";
