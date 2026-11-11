import { newsletters } from "@/content/site";

export const metadata = { title: "Newsletters – Sixth Avenue West HOA" };

export default function Newsletters() {
  return (
    <>
      <h1>Newsletters</h1>
      <p>The newsletter is mailed to every home in Sixth Avenue West. Past issues are below.</p>
      <ul className="files">
        {newsletters.map((n) => (
          <li key={n.href}>
            <a href={n.href} target="_blank" rel="noreferrer">
              {n.title} Newsletter (PDF)
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
