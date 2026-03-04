import Navbar from "../components/Navbar";
import PageWrapper from "../components/PageWrapper";
import "../styles/interior.css";

export default function About() {
  return (
    <PageWrapper>
      <Navbar />
      <div className="page-content">
        <h1>About</h1>
      </div>
    </PageWrapper>
  );
}
