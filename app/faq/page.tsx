import { faqs } from "@/content/site";

export const metadata = { title: "FAQ – Sixth Avenue West HOA" };

export default function Faq() {
  return (
    <>
      <h1>Frequently asked questions</h1>
      <p>
        If you have a question that isn&rsquo;t answered here, email the Board of Directors at{" "}
        <a href="mailto:board@sawhoa.com">board@sawhoa.com</a>.
      </p>
      {faqs.map((group) => (
        <section key={group.category}>
          <h2>{group.category}</h2>
          {group.items.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>
      ))}
    </>
  );
}
