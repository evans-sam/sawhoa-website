export default function Sidebar() {
  return (
    <aside className="sidebar">
      <section>
        <h2>Email updates</h2>
        <p>Get the newsletter and neighborhood notices by email.</p>
        {/* PROTOTYPE: this form will post to the mailing-list service once one is chosen. */}
        <form className="signup">
          <label>
            Name
            <input type="text" name="name" autoComplete="name" />
          </label>
          <label>
            Email
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <button type="button" className="button" disabled>
            Sign up
          </button>
          <p className="hint">Not connected yet in this prototype.</p>
        </form>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          <a href="mailto:board@sawhoa.com">board@sawhoa.com</a>
        </p>
        <p>
          P.O. Box 18111
          <br />
          Golden, CO 80402-6035
        </p>
      </section>
      <section>
        <h2>Good to know</h2>
        <ul className="plain">
          <li>
            Emergency: <a href="tel:911">911</a>
          </li>
          <li>
            Sheriff non-emergency: <a href="tel:303-271-0211">(303) 271-0211</a>
          </li>
          <li>
            Planning &amp; Zoning: <a href="tel:303-271-8700">(303) 271-8700</a>
          </li>
          <li>
            Animal Control: <a href="tel:303-271-5542">(303) 271-5542</a>
          </li>
          <li>
            Volunteer &amp; Youth Programs: <a href="tel:303-271-6579">(303) 271-6579</a>
          </li>
          <li>
            More at <a href="https://www.jeffco.us">www.jeffco.us</a>
          </li>
        </ul>
      </section>
    </aside>
  );
}
