import { board } from "@/content/site";

export const metadata = { title: "About – Sixth Avenue West HOA" };

export default function About() {
  return (
    <>
      <h1>About SAWHOA</h1>
      <p>
        The 6th Avenue West Homeowners Association has a voluntary membership and current dues to
        become a member are $50.00 annually.
      </p>
      <p>
        To promote the general welfare of its members in all community problems, relating to
        health, education, recreation, safety, shopping facilities, zoning regulations, housing
        facilities, utility, sanitation, road and transportation services or facilities, and such
        other community matters that may be brought to its attention by the members; to promote
        the physical and moral well-being of its members and to foster good will and social
        relations in the community.
      </p>
      <p>
        To promote the proper aggregate social and cultural conditions that influence the life of
        an individual or community and to promote an ecological conscientious community.
      </p>

      <h2>Board of Directors</h2>
      <ul className="plain">
        {board.map((b) => (
          <li key={b.name}>
            <strong>{b.name}</strong>: {b.role}
          </li>
        ))}
      </ul>
      <p>Special thanks to neighbors &amp; friends who volunteer for special assignments!</p>

      <h2>The unique history of Sixth Avenue West</h2>
      <p>
        <em>Provided by Anita Lamprell</em>
      </p>
      <p>
        In 1963, there were approximately 100 houses on Green Mountain. The subdivision was
        developed by Richard Kelly and the McKendry brothers. It was reported that Kelly told home
        buyers on Center drive that they would never have a water bill. He constructed water
        hookups to a house and then would run lines from that house downhill to several other
        homes, thus only one water bill would be issued to the first unlucky buyer. There was no
        sewer connection.
      </p>
      <p>
        We watched Sixth Ave. West being built and at first felt it was a great improvement. We
        finally decided to buy due to the need of having a walk out basement. Richard Hummell built
        our house. At that time there were 5 builders in the 4th filing.
      </p>
      <p className="note">
        Prototype: the full history from the current site carries over unchanged in the real build.
      </p>
    </>
  );
}
