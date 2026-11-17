import { links } from "@/content/site";

export const metadata = { title: "Events – Sixth Avenue West HOA" };

export default function Events() {
  return (
    <>
      <h1>Upcoming events</h1>
      <p>
        We look forward to seeing you at these upcoming events and fostering the sense of community
        that makes our neighborhood so special. If you have any questions or suggestions, please
        reach out to the HOA board.
      </p>
      <p className="note">
        Prototype: this is a sample Google Calendar (US holidays). The real one will be the
        board&rsquo;s shared calendar, so adding an event there updates this page.
      </p>
      <iframe className="calendar" src={links.calendarEmbed} title="HOA events calendar" />
    </>
  );
}
