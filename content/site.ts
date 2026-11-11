// PROTOTYPE STAND-IN DATA
// In the real build these come from Google tools the board already uses:
//   banner + announcements -> a Google Sheet
//   newsletters            -> a shared Google Drive folder
//   events                 -> a Google Calendar
// Everything marked SAMPLE below is invented so the layout has something to show.

const OLD = "https://sawhoa.com/wp-content/uploads";

export const images = {
  header: `${OLD}/2019/05/cropped-greenmountainsunset.jpg`,
  greenMountain: `${OLD}/2019/05/greenmountain-1024x683.jpg`,
};

// Set `show` to false to hide the banner.
export const banner = {
  show: true,
  text: "SAMPLE: Annual meeting is Tuesday, December 8 at 7:00 pm. All residents welcome.",
  linkText: "See the calendar",
  href: "/events",
};

export type Announcement = { date: string; title: string; body: string };

export const announcements: Announcement[] = [
  {
    date: "2026-11-02",
    title: "SAMPLE: Fall cleanup dumpster weekend",
    body: "Dumpsters will be at the school lot on Flora Way on Saturday and Sunday. Yard waste and household items only.",
  },
  {
    date: "2026-10-14",
    title: "SAMPLE: Board seat open",
    body: "We are looking for a volunteer to fill the Secretary role for the coming year. Email the board if you are interested.",
  },
  {
    date: "2026-05-20",
    title: "Spring 2026 newsletter is up",
    body: "The latest newsletter is on the Newsletters page.",
  },
];

export const newsletters = [
  { title: "Spring 2026", href: `${OLD}/2026/05/SAWHOA-Spring-2026-Newsletter.pdf` },
  { title: "Spring 2024", href: `${OLD}/2024/05/Spring-24-Newsletter_FINAL.pdf` },
  { title: "Fall 2023", href: `${OLD}/2024/01/Fall-23-Newsletter.pdf` },
  { title: "Spring 2023", href: `${OLD}/2024/01/11-x-17-April-2023-SAW-Newsletter-scanned-Proof.pdf` },
  { title: "Fall 2022", href: `${OLD}/2025/02/6th-Avenue-West-Fall-2022-Newsletter.pdf` },
  { title: "Spring 2022", href: `${OLD}/2024/01/Newsletter-scanned-proof.pdf` },
  { title: "Spring 2021", href: `${OLD}/2025/02/6th-Avenue-West-Spring-2021-Newsletter.pdf` },
];

const doc = (file: string) => `${OLD}/2024/01/${file}`;

export const documentSections = [
  {
    heading: "Filings & Covenants",
    text: "The Sixth Avenue West Neighborhood is divided up into 6 separate filings. The Protective Covenants that apply to each filing are specific to Sixth Avenue West and describe the guidelines for lot owners to follow with the purpose of maintaining an up-scale community. The covenants are also filed with Jefferson County. These covenants are binding and are enforceable by any member of the community.",
    links: [
      { title: "Map of Sixth Avenue West Filings", href: doc("SAWHOA-Map-of-Filings-1-6.pdf") },
      { title: "Protective Covenants for Filings 1-6", href: doc("SAWHOA-Protective-Covenants-for-Filings-1-6.pdf") },
      { title: "Covenant Enforcement Worksheet", href: doc("SAWHOA-Covenant-Enforcement-Worksheet.pdf") },
    ],
  },
  {
    heading: "Official Development Plan",
    text: "The Sixth Avenue West Neighborhood was created under an Official Development Plan or ODP. This ODP was created when the community was first established and filed with Jefferson County Planning and Zoning. It is the zoning document for the development of Sixth Avenue West, as well as several other communities, and is enforced by Jefferson County.",
    links: [{ title: "Official Development Plan", href: doc("SAWHOA-Official-Development-Plan.pdf") }],
  },
  {
    heading: "Architectural Control Guidelines",
    text: "The Architectural Control Guidelines contain more specific wording than the Covenants and are developed by the Architectural Control Committee (ACC). The intended purpose of the guidelines is to clarify and provide for a consistent interpretation of the Covenants, which is the underlying document to the guidelines.",
    links: [
      { title: "ACC Procedures", href: doc("SAWHOA-ACC-Operating-Procedures.pdf") },
      { title: "Neighborhood Guidelines", href: doc("SAWHOA-Neighborhood-Guidelines.pdf") },
    ],
  },
  {
    heading: "Bylaws",
    text: "The By-Laws are the rules governing the entity and operation of our Non-Profit Corporation called the 6th Avenue West Homeowners Association.",
    links: [{ title: "SAWHOA Bylaws (2011)", href: doc("SAWHOA-By-Laws-2011.pdf") }],
  },
  {
    heading: "Records Inspection Policy",
    text: "",
    links: [{ title: "Records Inspection Policy", href: doc("SAWHOA-Records-Inspection-Policy.pdf") }],
  },
  {
    heading: "Articles of Incorporation",
    text: "",
    links: [
      { title: "Articles of Incorporation (original)", href: doc("SAWHOA-Articles-of-Incorporation-original.pdf") },
      { title: "Articles of Incorporation (2002)", href: doc("SAWHOA-Articles-of-Incorporation-2002.pdf") },
      { title: "Certificate of Conversion (2003)", href: doc("SAWHOA-Certificate-of-Conversion-to-Nonprofit-2003.pdf") },
    ],
  },
  {
    heading: "Board Meeting Minutes",
    text: "",
    links: [{ title: "Board Meeting Minutes, Fall 2022", href: doc("SAWHOA-Final-Minutes-10.26.2022.pdf") }],
  },
];

export const faqs = [
  {
    category: "Architectural Control (ACC)",
    items: [
      {
        q: "Are there any restrictions regarding parking of my RV?",
        a: "Yes. Protective Covenant C-6 says no trailer, trailer camper, boat, truck camper or like mobile unit shall be permitted to remain upon any lot or public right-of-way, temporarily or permanently, unless hidden from view in such a way as to not be a public nuisance in the opinion of the Architectural Control Committee. Jefferson County ordinance 5.55.10.3 also limits parking a major recreational vehicle or trailer on a County highway in a residential district to two weeks in any one-year period. Some exceptions may apply to filings 4 & 5.",
      },
      {
        q: "Do I need a permit to do work on my home?",
        a: "Contact the Jefferson County Planning and Zoning Department before making any external or internal changes to your home. Work done without the proper permits can lead to penalties, fines and red-tagging. Architectural Control Committee approval is also required for many improvements. Some exceptions may apply to filings 4 & 5.",
      },
      {
        q: "Do I need approval to make improvements to my property?",
        a: "Yes, approval by the Architectural Control Committee is required for many external lot changes as set out in the Protective Covenants. Email the board to check whether your change needs approval. Some exceptions may apply to filings 4 & 5.",
      },
      {
        q: "What if I want to build a small shed or a playhouse?",
        a: "All structures must comply with section C-2 of the Protective Covenants: plans, specifications and location must be approved by the Architectural Control Committee before anything is erected, placed or altered. Jefferson County also regulates sheds and similar structures, and many need a building permit.",
      },
    ],
  },
  {
    category: "Association",
    items: [
      {
        q: "Does Sixth Avenue West have a Homeowners' Association?",
        a: "Yes, Sixth Avenue West has had an active Homeowners Association since 1973.",
      },
      {
        q: "How do I find out what's going on in the community?",
        a: "The Association meets monthly on the 2nd Tuesday of the month. Meeting announcements are posted on this website and usually at the entrances to the community. Meetings are open to all HOA members, who may speak and give input. Non-members may attend to observe.",
      },
    ],
  },
];

export const board = [
  { name: "Ken Last", role: "President" },
  { name: "Ellie Bau", role: "Membership" },
  { name: "Robert Wrigley", role: "ACC President" },
  { name: "Suzanne Wilson", role: "Treasurer" },
  { name: "Roslyn Kuzmich", role: "Secretary" },
];

// Replace with the real links once the accounts exist.
export const links = {
  stripeDues: "", // Stripe-hosted checkout link for annual dues
  calendarEmbed:
    // SAMPLE calendar (US holidays) standing in for the HOA's Google Calendar
    "https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FDenver&showTitle=0&showPrint=0&showCalendars=0",
};
