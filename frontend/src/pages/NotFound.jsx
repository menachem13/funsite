import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container" style={{ padding: "100px 24px", textAlign: "center" }}>
      <h1>Page not found</h1>
      <p>That page doesn't exist, or has moved.</p>
      <Link className="btn btn-primary" to="/">
        Back home
      </Link>
    </div>
  );
}
