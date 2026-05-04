import { useNavigate } from "react-router-dom";

export default function FinalCta() {
  const navigate = useNavigate();
  const demoToken = import.meta.env.VITE_DEMO_ENTRY_TOKEN;

  const onJuryClick = (e) => {
    e.preventDefault();
    navigate(demoToken ? `/demo/eval?t=${demoToken}` : "/eval");
  };
  const onAdminClick = (e) => {
    e.preventDefault();
    navigate("/demo");
  };

  return (
    <section className="ed-final" id="begin">
      <div className="ed-wrap">
        <div className="ed-final-eyebrow">08 · Begin</div>
        <h2 className="ed-final-h2">
          <em>Open</em> the demo
          <span className="arr" aria-hidden="true">→</span>
        </h2>
        <div className="ed-final-cta">
          <span>No sign-up</span>
          <span aria-hidden="true">·</span>
          <a href="/eval" onClick={onJuryClick}>
            Be a juror
          </a>
          <span aria-hidden="true">·</span>
          <a href="/demo" onClick={onAdminClick}>
            Tour the admin panel
          </a>
          <span aria-hidden="true">·</span>
          <span>Sandbox · isolated</span>
        </div>
      </div>
    </section>
  );
}
