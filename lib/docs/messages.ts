import type { Problem, ProblemKind } from "@/lib/docs/types";

const NOT_SHOWN = "The website won't show this change until it's fixed.";

/** `near "<quote>"`, or nothing when there is no quote. */
function near(quote: string): string {
  return quote ? ` near "${quote}"` : "";
}

const MESSAGES: Record<ProblemKind, (quote: string) => string> = {
  empty: () =>
    "this page is empty, so the website has nothing to show. Please add some text.",
  untitled: () =>
    "this document has no name yet, and the website uses the name as the page's heading. " +
    'Please click "Untitled document" at the top left and type a name.',
  table: (q) =>
    `this page has a table${near(q)}, and the website can't show tables. ` +
    "Please turn it into a list or plain paragraphs.",
  drawing: (q) =>
    `this page has a drawing${near(q)}, and the website can't show drawings. ` +
    "Please replace it with a picture, such as a screenshot of the drawing, or remove it.",
  chart: (q) =>
    `this page has a chart from Google Sheets${near(q)}, and the website can't show charts. ` +
    "Please replace it with a picture of the chart, or describe the numbers in words.",
  equation: (q) =>
    `this page has an equation${near(q)}, and the website can't show equations. ` +
    "Please type it out as ordinary text instead.",
  footnote: (q) =>
    `this page has a footnote${near(q)}, and the website can't show footnotes. ` +
    "Please move the footnote's words into the paragraph itself, or into brackets after the sentence.",
  embedded: (q) =>
    `this page has something inserted${near(q)} that the website can't show. ` +
    "Please remove it, or replace it with a picture or a link.",
  "floating-image": (q) =>
    `this page has a picture${near(q)} that is set to wrap around the text, ` +
    "and the website can only show pictures that sit in line with the text. " +
    'Please click the picture and choose "In line" in the bar that appears under it.',
  "image-unfetchable": (q) =>
    `this page has a picture${near(q)} that the website couldn't load. ` +
    "Please delete the picture and insert it again (Insert, then Image, then Upload from computer).",
  "bad-link": (q) =>
    `this page has a link${near(q)} that the website can't use. ` +
    "Please edit the link so it goes to a full web address (starting with https://), " +
    "an email address or a phone number.",
};

/** The comment posted on the doc for one problem: what is wrong and what to do. */
export function commentText(p: Problem): string {
  return `Website: ${MESSAGES[p.kind](p.quote)} ${NOT_SHOWN}`;
}
