import { links } from "@/content/site";

export const metadata = { title: "Pay Annual Dues – Sixth Avenue West HOA" };

export default function PayDues() {
  return (
    <>
      <h1>Pay annual dues</h1>
      <p className="lede">
        Membership in the Sixth Avenue West HOA is voluntary. Your dues keep you a member for one
        year from the day you pay.
      </p>

      <div className="dues-box">
        <div className="price">$50 / year</div>
        <p>You can add an extra donation on the payment page if you&rsquo;d like.</p>
        {links.stripeDues ? (
          <a className="button big" href={links.stripeDues}>
            Pay securely with Stripe
          </a>
        ) : (
          <>
            <span className="button big disabled" aria-disabled="true">
              Pay securely with Stripe
            </span>
            <p className="hint">Prototype: the Stripe payment link isn&rsquo;t connected yet.</p>
          </>
        )}
      </div>

      <h2>What happens next</h2>
      <ol className="steps">
        <li>The button opens a secure payment page run by Stripe.</li>
        <li>Enter your name, street address, email and card. We never see or store your card.</li>
        <li>You see a confirmation right away and get a receipt by email.</li>
        <li>Your membership is recorded automatically. Nothing else to do.</li>
      </ol>
    </>
  );
}
