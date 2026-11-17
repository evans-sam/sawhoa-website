import Link from "next/link";
import { announcements, images } from "@/content/site";

const fmt = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export default function Home() {
  return (
    <>
      <h1>Welcome to Sixth Avenue West</h1>
      <p className="lede">
        Sixth Avenue West is a wonderful community consisting of 532 single-family homes nestled up
        against Green Mountain just south of 6th Avenue West Freeway and east of Indiana Street.
        Sixth Avenue West has an active voluntary Homeowners&rsquo; Association and is also a
        covenant controlled community.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hero-img" src={images.greenMountain} alt="Trail on Green Mountain" />

      <h2>Announcements</h2>
      <ul className="feed">
        {announcements.map((a) => (
          <li key={a.date + a.title}>
            <time dateTime={a.date}>{fmt(a.date)}</time>
            <h3>{a.title}</h3>
            <p>{a.body}</p>
          </li>
        ))}
      </ul>

      <h2>Support the neighborhood</h2>
      <p>
        Membership is voluntary and costs $50 a year. Dues pay for the newsletter, community events
        and upkeep of shared spaces.
      </p>
      <Link href="/pay-dues" className="button">
        Pay annual dues
      </Link>
    </>
  );
}
