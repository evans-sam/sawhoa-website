import { documentSections } from "@/content/site";

export const metadata = { title: "Documents – Sixth Avenue West HOA" };

export default function Documents() {
  return (
    <>
      <h1>Important documents</h1>
      {documentSections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.text && <p>{s.text}</p>}
          <ul className="files">
            {s.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.title} (PDF)
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
